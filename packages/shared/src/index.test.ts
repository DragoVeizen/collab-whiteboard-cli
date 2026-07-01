import { describe, it, expect } from "vitest";
import { VERSION, makeCoord } from "./index.js";

describe("@whiteboard/shared canary", () => {
  it("exports a semver-shaped VERSION", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("makeCoord builds a coordinate pair", () => {
    expect(makeCoord(3, 4)).toEqual({ x: 3, y: 4 });
  });

  it("makeCoord preserves negative and zero values", () => {
    expect(makeCoord(-5, 0)).toEqual({ x: -5, y: 0 });
  });
});
