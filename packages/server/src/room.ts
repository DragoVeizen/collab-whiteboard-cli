import type { WebSocket } from "ws";
import type { ServerEvent } from "@whiteboard/shared";

// ws.WebSocket.OPEN = 1 — pinned here so room.ts can stay a type-only import
// of the ws lib. Any socket not in OPEN state is silently skipped by broadcast.
const OPEN = 1;

export class Room {
  private sockets: Set<WebSocket> = new Set();

  add(ws: WebSocket): void {
    this.sockets.add(ws);
  }

  remove(ws: WebSocket): void {
    this.sockets.delete(ws);
  }

  broadcast(event: ServerEvent, opts?: { except?: WebSocket }): void {
    const msg = JSON.stringify(event);
    for (const ws of this.sockets) {
      if (opts?.except === ws) continue;
      if (ws.readyState !== OPEN) continue;
      ws.send(msg);
    }
  }

  get size(): number {
    return this.sockets.size;
  }
}

export class RoomRegistry {
  private rooms: Map<string, Room> = new Map();

  get(chatId: string): Room {
    let room = this.rooms.get(chatId);
    if (!room) {
      room = new Room();
      this.rooms.set(chatId, room);
    }
    return room;
  }

  removeIfEmpty(chatId: string): void {
    const room = this.rooms.get(chatId);
    if (room && room.size === 0) {
      this.rooms.delete(chatId);
    }
  }
}
