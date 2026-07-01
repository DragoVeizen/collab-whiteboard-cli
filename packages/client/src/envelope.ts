// M6 stub: envelope animation state. Impls throw — M6 impl fills them in.
// Envelopes are client-only, ephemeral state. When a chatMessage arrives from
// a peer while the canvas view is active, an envelope is spawned at the
// sender's last-known cursor and animates toward the chat-corner of the
// viewport.

import type { Coord } from "@whiteboard/shared";

export type Envelope = {
  id: string;
  from: Coord;
  to: Coord;
  progress: number; // 0..1
  senderId: string;
};

// Advance each envelope's progress; drop ones that have completed.
export function stepEnvelopes(_envs: Envelope[], _dt: number): Envelope[] {
  throw new Error("M6 not implemented: stepEnvelopes");
}

// Linear interpolation of the envelope's current cell.
export function envelopeCell(_env: Envelope): Coord {
  throw new Error("M6 not implemented: envelopeCell");
}
