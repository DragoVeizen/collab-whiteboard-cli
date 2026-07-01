// Envelope animation state. Envelopes are client-only, ephemeral.
// When a chatMessage arrives from a peer while the canvas view is
// active, an envelope is spawned at the sender's last-known cursor
// and animates toward the chat-corner of the viewport.

import type { Coord } from "@whiteboard/shared";

export type Envelope = {
  id: string;
  from: Coord;
  to: Coord;
  progress: number; // 0..1
  senderId: string;
};

// Fraction of the animation completed per 100ms of real time.
// 0.15 → ~660ms total flight, quick but visible.
const SPEED_PER_100MS = 0.15;

export function stepEnvelopes(envs: Envelope[], dtMs: number): Envelope[] {
  const delta = SPEED_PER_100MS * (dtMs / 100);
  const next: Envelope[] = [];
  for (const e of envs) {
    const progress = e.progress + delta;
    if (progress < 1) next.push({ ...e, progress });
  }
  return next;
}

export function envelopeCell(env: Envelope): Coord {
  const t = Math.max(0, Math.min(1, env.progress));
  return {
    x: Math.round(env.from.x + (env.to.x - env.from.x) * t),
    y: Math.round(env.from.y + (env.to.y - env.from.y) * t),
  };
}
