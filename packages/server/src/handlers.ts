// M3 stub: signatures are real. Impl throws — the M3 loop fills these in.

import type { WebSocket } from "ws";
import type { RoomRegistry } from "./room.js";
import type { Store } from "./store.js";

export type Session = {
  ws: WebSocket;
  canvasId: string;
  userId: string;
  userName: string;
};

export async function handleConnect(
  _session: Session,
  _registry: RoomRegistry,
  _store: Store,
  _now: () => number,
): Promise<void> {
  throw new Error("M3 not implemented: handleConnect");
}

export async function handleMessage(
  _session: Session,
  _raw: string,
  _registry: RoomRegistry,
  _store: Store,
  _now: () => number,
): Promise<void> {
  throw new Error("M3 not implemented: handleMessage");
}

export function handleDisconnect(
  _session: Session,
  _registry: RoomRegistry,
): void {
  throw new Error("M3 not implemented: handleDisconnect");
}
