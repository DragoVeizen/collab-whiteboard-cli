import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import {
  ClientMessageSchema,
  type PersistableEvent,
  type ServerEvent,
} from "@whiteboard/shared";
import type { RoomRegistry } from "./room.js";
import type { Store } from "./store.js";

export type Session = {
  ws: WebSocket;
  chatId: string;
  userId: string;
  userName: string;
};

function safeSend(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export async function handleConnect(
  session: Session,
  registry: RoomRegistry,
  store: Store,
  now: () => number,
): Promise<void> {
  const { ws, chatId, userId, userName } = session;

  // Register room membership BEFORE any await. Otherwise a broadcast fired
  // during our mongo round-trips would miss this socket. The reducer is
  // idempotent on persisted events (Map.set by id, Set.add), so a client
  // seeing live events before its history is safe.
  const room = registry.get(chatId);
  room.add(ws);
  const joinEvent: ServerEvent = {
    type: "join",
    chatId,
    userId,
    userName,
  };
  room.broadcast(joinEvent);

  const nowTs = now();
  await store.upsertChat(chatId, nowTs);
  const history = await store.loadHistory(chatId);
  safeSend(ws, { type: "history", events: history });
}

export async function handleMessage(
  session: Session,
  raw: string,
  registry: RoomRegistry,
  store: Store,
  now: () => number,
): Promise<void> {
  const { ws, chatId, userId, userName } = session;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    ws.close(1003, "invalid json");
    return;
  }

  const result = ClientMessageSchema.safeParse(parsed);
  if (!result.success) {
    ws.close(1003, "invalid message");
    return;
  }

  const msg = result.data;
  const ts = now();
  const room = registry.get(chatId);

  switch (msg.type) {
    case "draw": {
      const event: PersistableEvent = {
        type: "draw",
        id: msg.id,
        chatId,
        userId,
        ts,
        shape: msg.shape,
      };
      try {
        await store.appendEvent(event);
      } catch (err) {
        safeSend(ws, {
          type: "error",
          code: "persist_failed",
          msg: String(err),
        });
        return;
      }
      await store.upsertChat(chatId, ts);
      room.broadcast(event);
      break;
    }
    case "undo": {
      const target = await store.findEventById(chatId, msg.targetId);
      if (target && target.userId !== userId) {
        safeSend(ws, {
          type: "error",
          code: "undo_forbidden",
          msg: "can only undo your own shapes",
        });
        return;
      }
      const event: PersistableEvent = {
        type: "undo",
        id: msg.id,
        chatId,
        userId,
        ts,
        targetId: msg.targetId,
      };
      await store.appendEvent(event);
      await store.upsertChat(chatId, ts);
      room.broadcast(event);
      break;
    }
    case "clear": {
      const event: PersistableEvent = {
        type: "clear",
        id: msg.id,
        chatId,
        userId,
        ts,
      };
      await store.appendEvent(event);
      await store.upsertChat(chatId, ts);
      room.broadcast(event);
      break;
    }
    case "cursor": {
      const event: ServerEvent = {
        type: "cursor",
        chatId,
        userId,
        userName,
        at: msg.at,
      };
      room.broadcast(event);
      break;
    }
    case "chatMessage": {
      const event: PersistableEvent = {
        type: "chatMessage",
        id: msg.id,
        chatId,
        userId,
        userName,
        ts,
        text: msg.text,
      };
      try {
        await store.appendEvent(event);
      } catch (err) {
        safeSend(ws, {
          type: "error",
          code: "persist_failed",
          msg: String(err),
        });
        return;
      }
      await store.upsertChat(chatId, ts);
      room.broadcast(event);
      break;
    }
    case "read": {
      const event: PersistableEvent = {
        type: "read",
        // Server generates a unique id for the receipt itself.
        id: randomUUID(),
        chatId,
        userId,
        ts,
        messageId: msg.messageId,
      };
      try {
        await store.appendEvent(event);
      } catch (err) {
        safeSend(ws, {
          type: "error",
          code: "persist_failed",
          msg: String(err),
        });
        return;
      }
      room.broadcast(event);
      break;
    }
  }
}

export function handleDisconnect(
  session: Session,
  registry: RoomRegistry,
): void {
  const { ws, chatId, userId } = session;
  const room = registry.get(chatId);
  room.remove(ws);
  const leaveEvent: ServerEvent = {
    type: "leave",
    chatId,
    userId,
  };
  room.broadcast(leaveEvent);
  registry.removeIfEmpty(chatId);
}
