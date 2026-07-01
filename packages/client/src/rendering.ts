// M4 stub: rasterizer signatures are real. Impls throw — the M4 loop
// fills these with dot/circle/square/line algorithms.

import type { Shape } from "@whiteboard/shared";
import type { CanvasState } from "./state.js";

export type Cell = { x: number; y: number; char: string };

export type Viewport = { width: number; height: number };

export function rasterizeDot(_shape: Extract<Shape, { kind: "dot" }>): Cell[] {
  throw new Error("M4 not implemented: rasterizeDot");
}

export function rasterizeCircle(
  _shape: Extract<Shape, { kind: "circle" }>,
): Cell[] {
  throw new Error("M4 not implemented: rasterizeCircle");
}

export function rasterizeSquare(
  _shape: Extract<Shape, { kind: "square" }>,
): Cell[] {
  throw new Error("M4 not implemented: rasterizeSquare");
}

export function rasterizeLine(
  _shape: Extract<Shape, { kind: "line" }>,
): Cell[] {
  throw new Error("M4 not implemented: rasterizeLine");
}

export function rasterizeShape(_shape: Shape): Cell[] {
  throw new Error("M4 not implemented: rasterizeShape");
}

// Produces the char grid for the visible canvas — no cursors, no ghosts.
// Cursors and pending anchors are overlaid by the view layer (app.tsx).
export function composeGrid(
  _state: CanvasState,
  _viewport: Viewport,
): string[][] {
  throw new Error("M4 not implemented: composeGrid");
}
