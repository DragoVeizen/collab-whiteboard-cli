import { describe, it, expect } from "vitest";
import { clampCoord } from "./index.js";

describe("@whiteboard/client canary", () => {
  it("passes coordinates within bounds through unchanged", () => {
    expect(clampCoord(5, 5, 10, 10)).toEqual({ x: 5, y: 5 });
  });

  it("clamps negative coordinates to zero", () => {
    expect(clampCoord(-3, -1, 10, 10)).toEqual({ x: 0, y: 0 });
  });

  it("clamps out-of-bound coordinates to bound - 1", () => {
    expect(clampCoord(20, 30, 10, 10)).toEqual({ x: 9, y: 9 });
  });

  it("handles a 1x1 canvas", () => {
    expect(clampCoord(0, 0, 1, 1)).toEqual({ x: 0, y: 0 });
    expect(clampCoord(5, 5, 1, 1)).toEqual({ x: 0, y: 0 });
  });
});
