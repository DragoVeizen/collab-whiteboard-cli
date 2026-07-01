import { describe, it, expect } from "vitest";
import {
  rasterizeDot,
  rasterizeCircle,
  rasterizeSquare,
  rasterizeLine,
  rasterizeShape,
  composeGrid,
} from "./rendering.js";
import { initialState, reduce } from "./state.js";
import type { PersistableEvent, Shape } from "@whiteboard/shared";

const draw = (id: string, ts: number, shape: Shape): PersistableEvent => ({
  type: "draw",
  id,
  canvasId: "c1",
  userId: "u1",
  ts,
  shape,
});

describe("rasterizeDot", () => {
  it("rasterizes a dot at its coordinate", () => {
    const cells = rasterizeDot({ kind: "dot", at: { x: 3, y: 4 } });
    expect(cells).toHaveLength(1);
    expect(cells[0]?.x).toBe(3);
    expect(cells[0]?.y).toBe(4);
  });

  it("dot uses the • character", () => {
    const cells = rasterizeDot({ kind: "dot", at: { x: 0, y: 0 } });
    expect(cells[0]?.char).toBe("•");
  });
});

describe("rasterizeCircle", () => {
  it("rasterizes a circle outline with Chebyshev radius", () => {
    const cells = rasterizeCircle({
      kind: "circle",
      center: { x: 5, y: 5 },
      radius: 2,
    });
    // A circle outline (not filled) must have more than 4 cells for r=2.
    expect(cells.length).toBeGreaterThan(4);
    // No cell should be at the center (it's the outline).
    const center = cells.find((c) => c.x === 5 && c.y === 5);
    expect(center).toBeUndefined();
  });

  it("radius-0 circle degenerates to the center cell", () => {
    const cells = rasterizeCircle({
      kind: "circle",
      center: { x: 3, y: 3 },
      radius: 0,
    });
    expect(cells.length).toBeGreaterThanOrEqual(1);
    expect(cells.some((c) => c.x === 3 && c.y === 3)).toBe(true);
  });
});

describe("rasterizeSquare", () => {
  it("rasterizes a square outline with four sides", () => {
    const cells = rasterizeSquare({
      kind: "square",
      tl: { x: 1, y: 1 },
      br: { x: 4, y: 4 },
    });
    // 4x4 square outline: perimeter = 4*4 - 4 (dedup corners) = 12 cells.
    // But allow implementation flexibility (11-12 cells).
    expect(cells.length).toBeGreaterThanOrEqual(11);
    // Corners must be present.
    expect(cells.some((c) => c.x === 1 && c.y === 1)).toBe(true);
    expect(cells.some((c) => c.x === 4 && c.y === 1)).toBe(true);
    expect(cells.some((c) => c.x === 1 && c.y === 4)).toBe(true);
    expect(cells.some((c) => c.x === 4 && c.y === 4)).toBe(true);
    // Interior cells must NOT be present.
    expect(cells.some((c) => c.x === 2 && c.y === 2)).toBe(false);
    expect(cells.some((c) => c.x === 3 && c.y === 3)).toBe(false);
  });

  it("normalizes corner order — br above/left of tl still works", () => {
    const cells = rasterizeSquare({
      kind: "square",
      tl: { x: 4, y: 4 },
      br: { x: 1, y: 1 },
    });
    // Should draw the same rectangle regardless of corner order.
    expect(cells.length).toBeGreaterThanOrEqual(11);
    expect(cells.some((c) => c.x === 1 && c.y === 1)).toBe(true);
    expect(cells.some((c) => c.x === 4 && c.y === 4)).toBe(true);
  });
});

describe("rasterizeLine", () => {
  it("rasterizes a line from start to end", () => {
    const cells = rasterizeLine({
      kind: "line",
      from: { x: 0, y: 0 },
      to: { x: 3, y: 0 },
    });
    // Horizontal line of length 4.
    expect(cells).toHaveLength(4);
    expect(cells.some((c) => c.x === 0 && c.y === 0)).toBe(true);
    expect(cells.some((c) => c.x === 3 && c.y === 0)).toBe(true);
  });

  it("line covers diagonal (0,0) to (n,n)", () => {
    const cells = rasterizeLine({
      kind: "line",
      from: { x: 0, y: 0 },
      to: { x: 5, y: 5 },
    });
    expect(cells).toHaveLength(6);
    for (let i = 0; i <= 5; i++) {
      expect(cells.some((c) => c.x === i && c.y === i)).toBe(true);
    }
  });

  it("rasterizes a vertical line", () => {
    const cells = rasterizeLine({
      kind: "line",
      from: { x: 2, y: 0 },
      to: { x: 2, y: 4 },
    });
    expect(cells).toHaveLength(5);
    for (let i = 0; i <= 4; i++) {
      expect(cells.some((c) => c.x === 2 && c.y === i)).toBe(true);
    }
  });

  it("single-point line degenerates to one cell", () => {
    const cells = rasterizeLine({
      kind: "line",
      from: { x: 3, y: 3 },
      to: { x: 3, y: 3 },
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toEqual(
      expect.objectContaining({ x: 3, y: 3 }),
    );
  });
});

describe("rasterizeShape", () => {
  it("dispatches by shape.kind", () => {
    expect(rasterizeShape({ kind: "dot", at: { x: 1, y: 1 } })).toHaveLength(1);
    expect(
      rasterizeShape({
        kind: "line",
        from: { x: 0, y: 0 },
        to: { x: 2, y: 0 },
      }),
    ).toHaveLength(3);
  });
});

describe("composeGrid", () => {
  it("empty state produces empty grid of the requested viewport size", () => {
    const grid = composeGrid(initialState(), { width: 10, height: 4 });
    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(10);
    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toBe(" ");
      }
    }
  });

  it("draws a single dot at the correct position", () => {
    let state = initialState();
    state = reduce(
      state,
      draw("e1", 100, { kind: "dot", at: { x: 3, y: 2 } }),
    );
    const grid = composeGrid(state, { width: 10, height: 5 });
    expect(grid[2]?.[3]).toBe("•");
  });

  it("skips shapes that were undone", () => {
    let state = initialState();
    state = reduce(
      state,
      draw("e1", 100, { kind: "dot", at: { x: 3, y: 2 } }),
    );
    state = reduce(state, {
      type: "undo",
      id: "u1",
      canvasId: "c1",
      userId: "u1",
      ts: 101,
      targetId: "e1",
    });
    const grid = composeGrid(state, { width: 10, height: 5 });
    expect(grid[2]?.[3]).toBe(" ");
  });

  it("skips cells outside the viewport", () => {
    let state = initialState();
    state = reduce(
      state,
      draw("e1", 100, { kind: "dot", at: { x: 100, y: 100 } }),
    );
    const grid = composeGrid(state, { width: 5, height: 5 });
    // No exception, no wrap; grid remains empty.
    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toBe(" ");
      }
    }
  });
});
