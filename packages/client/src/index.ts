export function clampCoord(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, width - 1)),
    y: Math.max(0, Math.min(y, height - 1)),
  };
}
