export const VERSION = "0.1.0";

export type Coord = { x: number; y: number };

export function makeCoord(x: number, y: number): Coord {
  return { x, y };
}
