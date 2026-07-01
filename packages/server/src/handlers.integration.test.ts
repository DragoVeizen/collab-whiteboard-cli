import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { WebSocketServer, WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import type { ClientMessage, ServerEvent } from "@whiteboard/shared";
import { Store } from "./store.js";
import { RoomRegistry } from "./room.js";
import {
  handleConnect,
  handleMessage,
  handleDisconnect,
  type Session,
} from "./handlers.js";

const TEST_DB = "whiteboard_test_handlers";

let mongod: MongoMemoryServer;
let store: Store;
let registry: RoomRegistry;
let wss: WebSocketServer;
let serverPort: number;
let cleanupClient: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const url = mongod.getUri();
  store = new Store(url, TEST_DB);
  await store.connect();
  cleanupClient = new MongoClient(url);
  await cleanupClient.connect();

  registry = new RoomRegistry();
  wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) =>
    wss.once("listening", () => resolve()),
  );
  serverPort = (wss.address() as AddressInfo).port;

  wss.on("connection", (ws, req) => {
    const u = new URL(req.url ?? "", "ws://x");
    const canvasId = u.searchParams.get("canvasId") ?? "";
    const userId = u.searchParams.get("userId") ?? "";
    const userName = u.searchParams.get("name") ?? "anon";
    if (!canvasId || !userId) {
      ws.close(1008);
      return;
    }
    const session: Session = { ws, canvasId, userId, userName };
    handleConnect(session, registry, store, () => Date.now()).catch(() => {
      ws.close(1011);
    });
    ws.on("message", (raw) => {
      handleMessage(
        session,
        raw.toString(),
        registry,
        store,
        () => Date.now(),
      ).catch(() => {});
    });
    ws.on("close", () => handleDisconnect(session, registry));
  });
}, 90_000);

afterAll(async () => {
  wss.close();
  await store.close();
  await cleanupClient.close();
  await mongod.stop();
});

beforeEach(async () => {
  const db = cleanupClient.db(TEST_DB);
  await db.collection("events").deleteMany({});
  await db.collection("canvases").deleteMany({});
});

type Conn = {
  ws: WebSocket;
  messages: ServerEvent[];
  nextMatching: (
    predicate: (e: ServerEvent) => boolean,
    timeoutMs?: number,
  ) => Promise<ServerEvent>;
};

async function connect(
  canvasId: string,
  userId: string,
  name = userId,
): Promise<Conn> {
  const ws = new WebSocket(
    `ws://localhost:${serverPort}?canvasId=${canvasId}&userId=${userId}&name=${name}`,
  );
  const messages: ServerEvent[] = [];
  type Pending = {
    predicate: (e: ServerEvent) => boolean;
    resolve: (e: ServerEvent) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const pending: Pending[] = [];

  ws.on("message", (raw) => {
    const event = JSON.parse(raw.toString()) as ServerEvent;
    messages.push(event);
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]!;
      if (p.predicate(event)) {
        clearTimeout(p.timer);
        p.resolve(event);
        pending.splice(i, 1);
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  const nextMatching = (
    predicate: (e: ServerEvent) => boolean,
    timeoutMs = 3000,
  ): Promise<ServerEvent> => {
    const already = messages.find(predicate);
    if (already) return Promise.resolve(already);
    return new Promise<ServerEvent>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = pending.findIndex((p) => p.predicate === predicate);
        if (idx !== -1) pending.splice(idx, 1);
        reject(
          new Error(
            `timeout; received types: [${messages
              .map((m) => m.type)
              .join(", ")}]`,
          ),
        );
      }, timeoutMs);
      pending.push({ predicate, resolve, timer });
    });
  };

  return { ws, messages, nextMatching };
}

async function closeAll(...conns: Conn[]) {
  for (const c of conns) {
    if (
      c.ws.readyState === WebSocket.OPEN ||
      c.ws.readyState === WebSocket.CONNECTING
    ) {
      c.ws.close();
    }
  }
  await new Promise((r) => setTimeout(r, 50));
}

describe("handlers integration", () => {
  it("draw broadcasts to all clients in the same canvas", async () => {
    const a = await connect("cx1", "ua", "A");
    const b = await connect("cx1", "ub", "B");
    a.ws.send(
      JSON.stringify({
        type: "draw",
        id: "d1",
        shape: { kind: "dot", at: { x: 1, y: 1 } },
      } satisfies ClientMessage),
    );
    const received = await b.nextMatching(
      (e) => e.type === "draw" && e.id === "d1",
    );
    expect(received.type).toBe("draw");
    if (received.type === "draw") {
      expect(received.userId).toBe("ua");
      expect(received.canvasId).toBe("cx1");
    }
    await closeAll(a, b);
  });

  it("draw is echoed back to the sender", async () => {
    const a = await connect("cx2", "ua", "A");
    a.ws.send(
      JSON.stringify({
        type: "draw",
        id: "d2",
        shape: { kind: "dot", at: { x: 2, y: 2 } },
      } satisfies ClientMessage),
    );
    const echo = await a.nextMatching(
      (e) => e.type === "draw" && e.id === "d2",
    );
    expect(echo.type).toBe("draw");
    await closeAll(a);
  });

  it("history replays on connect", async () => {
    const a = await connect("cx3", "ua", "A");
    a.ws.send(
      JSON.stringify({
        type: "draw",
        id: "d3",
        shape: { kind: "dot", at: { x: 5, y: 5 } },
      } satisfies ClientMessage),
    );
    await a.nextMatching((e) => e.type === "draw" && e.id === "d3");
    await closeAll(a);

    const b = await connect("cx3", "ub", "B");
    const hist = await b.nextMatching((e) => e.type === "history");
    expect(hist.type).toBe("history");
    if (hist.type === "history") {
      expect(hist.events).toHaveLength(1);
      expect(hist.events[0]?.id).toBe("d3");
    }
    await closeAll(b);
  });

  it("cursor is broadcast but not persisted", async () => {
    const a = await connect("cx4", "ua", "A");
    const b = await connect("cx4", "ub", "B");
    a.ws.send(
      JSON.stringify({
        type: "cursor",
        at: { x: 7, y: 8 },
      } satisfies ClientMessage),
    );
    const evt = await b.nextMatching(
      (e) => e.type === "cursor" && e.userId === "ua",
    );
    expect(evt.type).toBe("cursor");
    await closeAll(a, b);

    // After the cursor event, a fresh client's history must contain no cursor events.
    const c = await connect("cx4", "uc", "C");
    const hist = await c.nextMatching((e) => e.type === "history");
    if (hist.type === "history") {
      const cursorInHistory = hist.events.some(
        (e) => (e as { type: string }).type === "cursor",
      );
      expect(cursorInHistory).toBe(false);
    }
    await closeAll(c);
  });

  it("unknown message type closes the socket", async () => {
    const a = await connect("cx5", "ua", "A");
    a.ws.send(JSON.stringify({ type: "gibberish" }));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("socket did not close")),
        3000,
      );
      a.ws.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    expect(a.ws.readyState).toBe(WebSocket.CLOSED);
  });

  it("undo of another user's event is rejected", async () => {
    const a = await connect("cx6", "ua", "A");
    a.ws.send(
      JSON.stringify({
        type: "draw",
        id: "d6",
        shape: { kind: "dot", at: { x: 0, y: 0 } },
      } satisfies ClientMessage),
    );
    await a.nextMatching((e) => e.type === "draw" && e.id === "d6");

    const b = await connect("cx6", "ub", "B");
    await b.nextMatching((e) => e.type === "history");
    b.ws.send(
      JSON.stringify({
        type: "undo",
        id: "u1",
        targetId: "d6",
      } satisfies ClientMessage),
    );

    const err = await b.nextMatching((e) => e.type === "error");
    expect(err.type).toBe("error");
    if (err.type === "error") {
      expect(err.code).toBe("undo_forbidden");
    }
    await closeAll(a, b);
  });

  it("server stamps ts, client cannot forge", async () => {
    const a = await connect("cx7", "ua", "A");
    const t0 = Date.now();
    a.ws.send(
      JSON.stringify({
        type: "draw",
        id: "d7",
        shape: { kind: "dot", at: { x: 0, y: 0 } },
      } satisfies ClientMessage),
    );
    const evt = await a.nextMatching(
      (e) => e.type === "draw" && e.id === "d7",
    );
    if (evt.type === "draw") {
      expect(evt.ts).toBeGreaterThanOrEqual(t0);
      expect(evt.ts).toBeLessThanOrEqual(Date.now() + 1000);
      expect(evt.userId).toBe("ua");
    }
    await closeAll(a);
  });

  it("leave broadcasts when socket closes", async () => {
    const a = await connect("cx8", "ua", "A");
    const b = await connect("cx8", "ub", "B");
    await a.nextMatching((e) => e.type === "join" && e.userId === "ub");
    b.ws.close();
    const leave = await a.nextMatching(
      (e) => e.type === "leave" && e.userId === "ub",
    );
    expect(leave.type).toBe("leave");
    await closeAll(a);
  });
});
