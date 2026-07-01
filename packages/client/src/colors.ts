// Per-user color derived deterministically from userId.
// Same palette used by Canvas cursors and by StatusBar / Chat rosters
// so the on-canvas glyph matches the legend everywhere.

export const PALETTE = [
  "cyan",
  "magenta",
  "yellow",
  "green",
  "blue",
  "red",
] as const;

export type PaletteColor = (typeof PALETTE)[number];

export function colorFor(userId: string): PaletteColor {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}
