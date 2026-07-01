// WS client — thin wrapper with reconnect + full-history replay on reconnect.
// Tests hand-verify this in M5 e2e; no unit tests here (hard to make deterministic).

import { WebSocket } from "ws";
import type { ClientMessage, ServerEvent } from "@whiteboard/shared";

export type WsClientOpts = {
  url: string;
  canvasId: string;
  userId: string;
  userName: string;
  onEvent: (e: ServerEvent) => void;
  onStatusChange?: (s: "connecting" | "open" | "closed") => void;
};

export class WsClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private backoffMs = 1000;
  private readonly maxBackoffMs = 30_000;

  constructor(private readonly opts: WsClientOpts) {}

  connect(): void {
    this.opts.onStatusChange?.("connecting");
    const { url, canvasId, userId, userName } = this.opts;
    const wsUrl = `${url}?canvasId=${encodeURIComponent(canvasId)}&userId=${encodeURIComponent(
      userId,
    )}&name=${encodeURIComponent(userName)}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;
    ws.on("open", () => {
      this.backoffMs = 1000;
      this.opts.onStatusChange?.("open");
    });
    ws.on("message", (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as ServerEvent;
        this.opts.onEvent(event);
      } catch {
        // ignore malformed frame
      }
    });
    ws.on("close", () => {
      this.opts.onStatusChange?.("closed");
      this.ws = null;
      if (this.closed) return;
      const wait = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      setTimeout(() => {
        if (!this.closed) this.connect();
      }, wait);
    });
    ws.on("error", () => {
      // errors surface via close; nothing to do here.
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
