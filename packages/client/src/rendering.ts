import type { Shape } from "@whiteboard/shared";
import type { ChatState } from "./state.js";

export type Cell = { x: number; y: number; char: string };

export type Viewport = { width: number; height: number };

export function rasterizeDot(shape: Extract<Shape, { kind: "dot" }>): Cell[] {
  return [{ x: shape.at.x, y: shape.at.y, char: "•" }];
}

export function rasterizeCircle(
  shape: Extract<Shape, { kind: "circle" }>,
): Cell[] {
  const { center, radius } = shape;
  if (radius <= 0) {
    return [{ x: center.x, y: center.y, char: "o" }];
  }
  // Midpoint circle algorithm with 8-way symmetry, then dedup.
  const points = new Set<string>();
  const push = (x: number, y: number) => points.add(`${x},${y}`);
  let x = 0;
  let y = radius;
  let d = 1 - radius;
  while (x <= y) {
    push(center.x + x, center.y + y);
    push(center.x - x, center.y + y);
    push(center.x + x, center.y - y);
    push(center.x - x, center.y - y);
    push(center.x + y, center.y + x);
    push(center.x - y, center.y + x);
    push(center.x + y, center.y - x);
    push(center.x - y, center.y - x);
    if (d < 0) {
      d += 2 * x + 3;
    } else {
      d += 2 * (x - y) + 5;
      y -= 1;
    }
    x += 1;
  }
  const cells: Cell[] = [];
  for (const p of points) {
    const [sx, sy] = p.split(",");
    cells.push({ x: Number(sx), y: Number(sy), char: "o" });
  }
  return cells;
}

export function rasterizeSquare(
  shape: Extract<Shape, { kind: "square" }>,
): Cell[] {
  const tl = {
    x: Math.min(shape.tl.x, shape.br.x),
    y: Math.min(shape.tl.y, shape.br.y),
  };
  const br = {
    x: Math.max(shape.tl.x, shape.br.x),
    y: Math.max(shape.tl.y, shape.br.y),
  };
  const cells: Cell[] = [];

  // 1-tall / 1-wide degenerate: emit a single row or column of "─"/"│".
  if (tl.y === br.y && tl.x === br.x) {
    cells.push({ x: tl.x, y: tl.y, char: "┌" });
    return cells;
  }
  if (tl.y === br.y) {
    for (let x = tl.x; x <= br.x; x++) {
      cells.push({ x, y: tl.y, char: "─" });
    }
    return cells;
  }
  if (tl.x === br.x) {
    for (let y = tl.y; y <= br.y; y++) {
      cells.push({ x: tl.x, y, char: "│" });
    }
    return cells;
  }

  // Top row
  for (let x = tl.x; x <= br.x; x++) {
    let char = "─";
    if (x === tl.x) char = "┌";
    else if (x === br.x) char = "┐";
    cells.push({ x, y: tl.y, char });
  }
  // Bottom row
  for (let x = tl.x; x <= br.x; x++) {
    let char = "─";
    if (x === tl.x) char = "└";
    else if (x === br.x) char = "┘";
    cells.push({ x, y: br.y, char });
  }
  // Left/right columns (interior of the vertical span)
  for (let y = tl.y + 1; y < br.y; y++) {
    cells.push({ x: tl.x, y, char: "│" });
    cells.push({ x: br.x, y, char: "│" });
  }
  return cells;
}

export function rasterizeLine(
  shape: Extract<Shape, { kind: "line" }>,
): Cell[] {
  const { from, to } = shape;
  let char = "━";
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dy === 0 && dx === 0) char = "•";
  else if (dy === 0) char = "━";
  else if (dx === 0) char = "│";
  else char = (dx > 0) === (dy > 0) ? "╲" : "╱";

  // Bresenham
  const cells: Cell[] = [];
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = adx - ady;
  let x = from.x;
  let y = from.y;
  while (true) {
    cells.push({ x, y, char });
    if (x === to.x && y === to.y) break;
    const e2 = 2 * err;
    if (e2 > -ady) {
      err -= ady;
      x += sx;
    }
    if (e2 < adx) {
      err += adx;
      y += sy;
    }
  }
  return cells;
}

export function rasterizeShape(shape: Shape): Cell[] {
  switch (shape.kind) {
    case "dot": return rasterizeDot(shape);
    case "circle": return rasterizeCircle(shape);
    case "square": return rasterizeSquare(shape);
    case "line": return rasterizeLine(shape);
  }
}

// Per-cell result of the composer: the visible character plus, for cells that
// came from a real drawn shape, the userId of whoever drew it. The renderer
// uses userId to color the cell.
export type ColoredCell = { char: string; userId?: string };

export function composeColoredGrid(
  state: ChatState,
  viewport: Viewport,
): ColoredCell[][] {
  const { width, height } = viewport;
  const grid: ColoredCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: ColoredCell[] = [];
    for (let x = 0; x < width; x++) row.push({ char: " " });
    grid.push(row);
  }
  for (const [id, shape] of state.shapes) {
    if (state.undone.has(id)) continue;
    const author = state.shapeAuthors.get(id);
    for (const cell of rasterizeShape(shape)) {
      if (cell.x < 0 || cell.x >= width) continue;
      if (cell.y < 0 || cell.y >= height) continue;
      const row = grid[cell.y];
      if (row) row[cell.x] = { char: cell.char, userId: author };
    }
  }
  return grid;
}

export function composeGrid(
  state: ChatState,
  viewport: Viewport,
): string[][] {
  return composeColoredGrid(state, viewport).map((row) =>
    row.map((c) => c.char),
  );
}
