import { WebSocketServer, type WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { Store } from "./store.js";
import { RoomRegistry } from "./room.js";
import {
  handleConnect,
  handleMessage,
  handleDisconnect,
  type Session,
} from "./handlers.js";

export function envOrDefault(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw !== undefined && raw.length > 0 ? raw : fallback;
}

export const DEFAULT_WS_PORT = 8787;

async function main(): Promise<void> {
  const mongoUrl = envOrDefault("MONGO_URL", "mongodb://localhost:27017");
  const mongoDb = envOrDefault("MONGO_DB", "whiteboard");
  const wsPort = Number.parseInt(
    envOrDefault("WS_PORT", String(DEFAULT_WS_PORT)),
    10,
  );

  const store = new Store(mongoUrl, mongoDb);
  await store.connect();

  const registry = new RoomRegistry();
  const wss = new WebSocketServer({ port: wsPort });
  await new Promise<void>((resolve) =>
    wss.once("listening", () => resolve()),
  );
  console.log(`whiteboard server listening on ws://localhost:${wsPort}`);

  wss.on("connection", (ws: WebSocket, req) => {
    const u = new URL(req.url ?? "", "ws://x");
    const canvasId = u.searchParams.get("canvasId") ?? "";
    const userId = u.searchParams.get("userId") ?? "";
    const userName = u.searchParams.get("name") ?? "anon";
    if (!canvasId || !userId) {
      ws.close(1008, "missing canvasId or userId");
      return;
    }
    const session: Session = { ws, canvasId, userId, userName };
    handleConnect(session, registry, store, () => Date.now()).catch(
      (err) => {
        console.error("connect error:", err);
        ws.close(1011, "connect failed");
      },
    );
    ws.on("message", (raw) => {
      handleMessage(
        session,
        raw.toString(),
        registry,
        store,
        () => Date.now(),
      ).catch((err) => console.error("message error:", err));
    });
    ws.on("close", () => handleDisconnect(session, registry));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("fatal:", err);
    process.exit(1);
  });
}
