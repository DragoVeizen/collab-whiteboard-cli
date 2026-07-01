// M3 stub: interfaces are real. Impl throws — the M3 loop fills these in.

import type { WebSocket } from "ws";
import type { ServerEvent } from "@whiteboard/shared";

export class Room {
  private sockets: Set<WebSocket> = new Set();

  add(_ws: WebSocket): void {
    throw new Error("M3 not implemented: Room.add");
  }

  remove(_ws: WebSocket): void {
    throw new Error("M3 not implemented: Room.remove");
  }

  broadcast(_event: ServerEvent, _opts?: { except?: WebSocket }): void {
    throw new Error("M3 not implemented: Room.broadcast");
  }

  get size(): number {
    return this.sockets.size;
  }
}

export class RoomRegistry {
  private rooms: Map<string, Room> = new Map();

  get(_canvasId: string): Room {
    throw new Error("M3 not implemented: RoomRegistry.get");
  }

  removeIfEmpty(_canvasId: string): void {
    throw new Error("M3 not implemented: RoomRegistry.removeIfEmpty");
  }
}
