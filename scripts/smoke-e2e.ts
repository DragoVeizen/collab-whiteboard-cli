// Headless end-to-end smoke. Drives real ws clients against the running
// server + mongo and verifies the whole event flow. Assumes:
//   - Mongo listening on 27017 (dev-mongo or docker)
//   - Server listening on ws://localhost:8787
// Run with: pnpm --filter server exec tsx ../../scripts/smoke-e2e.ts
// Or from the repo root: pnpm --filter server exec node --import tsx scripts/smoke-e2e.ts

import { WebSocket } from "ws";

const WS_URL = process.env.WS_URL ?? "ws://localhost:8787";
const CHAT_ID = `smoke-${Date.now()}`;

type AnyEvent = Record<string, unknown> & { type: string };

type Client = {
  ws: WebSocket;
  messages: AnyEvent[];
  waitFor: (
    predicate: (e: AnyEvent) => boolean,
    timeoutMs?: number,
  ) => Promise<AnyEvent>;
};

async function connect(userId: string, name: string): Promise<Client> {
  const url = `${WS_URL}?chatId=${encodeURIComponent(CHAT_ID)}&userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(name)}`;
  const ws = new WebSocket(url);
  const messages: AnyEvent[] = [];
  type Pending = {
    predicate: (e: AnyEvent) => boolean;
    resolve: (e: AnyEvent) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const pending: Pending[] = [];

  ws.on("message", (raw) => {
    try {
      const event = JSON.parse(raw.toString()) as AnyEvent;
      messages.push(event);
      for (let i = pending.length - 1; i >= 0; i--) {
        const p = pending[i]!;
        if (p.predicate(event)) {
          clearTimeout(p.timer);
          p.resolve(event);
          pending.splice(i, 1);
        }
      }
    } catch {
      // ignore malformed
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const waitFor = (
    predicate: (e: AnyEvent) => boolean,
    timeoutMs = 3000,
  ): Promise<AnyEvent> => {
    const already = messages.find(predicate);
    if (already) return Promise.resolve(already);
    return new Promise<AnyEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = pending.findIndex((p) => p.predicate === predicate);
        if (idx !== -1) pending.splice(idx, 1);
        reject(
          new Error(
            `timeout; received types: [${messages.map((m) => m.type).join(", ")}]`,
          ),
        );
      }, timeoutMs);
      pending.push({ predicate, resolve, timer });
    });
  };

  return { ws, messages, waitFor };
}

const closeAll = async (...clients: Client[]): Promise<void> => {
  for (const c of clients) {
    if (
      c.ws.readyState === WebSocket.OPEN ||
      c.ws.readyState === WebSocket.CONNECTING
    ) {
      c.ws.close();
    }
  }
  await new Promise((r) => setTimeout(r, 100));
};

// tiny test harness
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`FAIL  ${name} — ${msg}`);
    failed += 1;
  }
}

async function main(): Promise<void> {
  console.log(`smoke on canvas: ${CHAT_ID}\n`);

  const a = await connect("user-a", "A");
  const b = await connect("user-b", "B");

  await test("B receives history on connect", async () => {
    await b.waitFor((e) => e.type === "history");
  });

  await test("A receives its own history on connect", async () => {
    await a.waitFor((e) => e.type === "history");
  });

  await test("A sees B's join event", async () => {
    await a.waitFor(
      (e) => e.type === "join" && e["userId"] === "user-b",
    );
  });

  await test(
    "A draws dot → server stamps ts + userId, B receives it",
    async () => {
      a.ws.send(
        JSON.stringify({
          type: "draw",
          id: "d1",
          shape: { kind: "dot", at: { x: 5, y: 5 } },
        }),
      );
      const evt = await b.waitFor(
        (e) => e.type === "draw" && e["id"] === "d1",
      );
      if (evt["userId"] !== "user-a") {
        throw new Error(`expected userId user-a, got ${String(evt["userId"])}`);
      }
      if (typeof evt["ts"] !== "number" || (evt["ts"] as number) <= 0) {
        throw new Error("missing server-stamped ts");
      }
    },
  );

  await test("A gets its own draw echoed back", async () => {
    await a.waitFor((e) => e.type === "draw" && e["id"] === "d1");
  });

  await test("A draws circle, B receives it", async () => {
    a.ws.send(
      JSON.stringify({
        type: "draw",
        id: "d2",
        shape: { kind: "circle", center: { x: 10, y: 10 }, radius: 4 },
      }),
    );
    await b.waitFor((e) => e.type === "draw" && e["id"] === "d2");
  });

  await test("cursor from A broadcasts to B", async () => {
    a.ws.send(JSON.stringify({ type: "cursor", at: { x: 7, y: 8 } }));
    const evt = await b.waitFor(
      (e) => e.type === "cursor" && e["userId"] === "user-a",
    );
    const at = evt["at"] as { x: number; y: number };
    if (at.x !== 7 || at.y !== 8) throw new Error("cursor coord mismatch");
  });

  await test("A undoes own draw, B receives undo", async () => {
    a.ws.send(
      JSON.stringify({ type: "undo", id: "u1", targetId: "d1" }),
    );
    await b.waitFor((e) => e.type === "undo" && e["targetId"] === "d1");
  });

  await test("B cannot undo A's draw — receives error", async () => {
    b.ws.send(
      JSON.stringify({ type: "undo", id: "u2", targetId: "d2" }),
    );
    const evt = await b.waitFor((e) => e.type === "error");
    if (evt["code"] !== "undo_forbidden") {
      throw new Error(`expected code undo_forbidden, got ${String(evt["code"])}`);
    }
  });

  await test(
    "leave broadcasts when a socket disconnects",
    async () => {
      const c = await connect("user-c", "C");
      await a.waitFor(
        (e) => e.type === "join" && e["userId"] === "user-c",
      );
      c.ws.close();
      await a.waitFor(
        (e) => e.type === "leave" && e["userId"] === "user-c",
      );
    },
  );

  await test(
    "reconnect replays history (draw + undo persist, cursor does not)",
    async () => {
      await closeAll(a, b);
      const d = await connect("user-d", "D");
      const hist = await d.waitFor((e) => e.type === "history");
      const events = hist["events"] as AnyEvent[];
      const hasDraw1 = events.some(
        (e) => e.type === "draw" && e["id"] === "d1",
      );
      const hasDraw2 = events.some(
        (e) => e.type === "draw" && e["id"] === "d2",
      );
      const hasUndo1 = events.some(
        (e) => e.type === "undo" && e["targetId"] === "d1",
      );
      const hasCursor = events.some((e) => e.type === "cursor");
      if (!hasDraw1) throw new Error("draw d1 missing from history");
      if (!hasDraw2) throw new Error("draw d2 missing from history");
      if (!hasUndo1) throw new Error("undo of d1 missing from history");
      if (hasCursor) throw new Error("cursor persisted (should be ephemeral)");
      await closeAll(d);
    },
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
