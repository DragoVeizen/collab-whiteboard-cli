// M4 stub: pure vim-style input state machine. Impl throws.

import type { ClientMessage, Coord } from "@whiteboard/shared";

export type Mode = "dot" | "circle" | "line" | "square";

export type InputState = {
  mode: Mode;
  cursor: Coord;
  // Pending anchor for 2-anchor shapes (circle, line, square).
  // First press of space stores the anchor; second press emits the shape.
  anchor: Coord | null;
  // Stack of my own draw event ids in order — used by `u` (undo my last draw).
  ownDraws: string[];
  width: number;
  height: number;
};

export type InputResult = {
  state: InputState;
  emit: ClientMessage | null;
  quit: boolean;
};

export function initialInputState(
  width: number,
  height: number,
): InputState {
  return {
    mode: "dot",
    cursor: { x: 0, y: 0 },
    anchor: null,
    ownDraws: [],
    width,
    height,
  };
}

// Reduce a keystroke into a new input state plus an optional message to
// send to the server. `idGen` is passed in so tests can produce
// deterministic ids; production uses crypto.randomUUID.
export function reduceInput(
  _state: InputState,
  _key: string,
  _idGen: () => string,
): InputResult {
  throw new Error("M4 not implemented: reduceInput");
}
