// M2 stub: types are real. Reducer throws — the M2 loop implements it.

import type { Coord, Shape, ServerEvent } from "@whiteboard/shared";

export type Presence = { name: string; cursor: Coord };

export type CanvasState = {
  shapes: Map<string, Shape>;
  undone: Set<string>;
  clearedAt: number;
  presence: Map<string, Presence>;
};

export function initialState(): CanvasState {
  return {
    shapes: new Map(),
    undone: new Set(),
    clearedAt: 0,
    presence: new Map(),
  };
}

export function reduce(_state: CanvasState, _event: ServerEvent): CanvasState {
  throw new Error("M2 not implemented: reduce");
}
