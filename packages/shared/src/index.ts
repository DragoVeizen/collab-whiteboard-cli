export const VERSION = "0.1.0";

export * from "./events.js";

import type { Coord } from "./events.js";
export function makeCoord(x: number, y: number): Coord {
  return { x, y };
}
