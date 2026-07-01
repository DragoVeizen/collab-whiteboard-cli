import React from "react";
import { Box, Text } from "ink";
import { composeGrid, rasterizeShape, type Viewport } from "./rendering.js";
import type { CanvasState } from "./state.js";
import type { Coord, Shape } from "@whiteboard/shared";
import type { Mode } from "./input.js";

export type CanvasProps = {
  state: CanvasState;
  ownCursor: Coord;
  anchor: Coord | null;
  mode: Mode;
  viewport: Viewport;
  ownUserId: string;
};

const PALETTE = [
  "cyan",
  "magenta",
  "yellow",
  "green",
  "blue",
  "red",
] as const;

function colorFor(userId: string): (typeof PALETTE)[number] {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

// If we're mid-anchor for a 2-anchor shape, compute what would be drawn
// if the user pressed space right now. Returns null in dot mode (no ghost
// needed — the cursor already shows where the dot lands).
function ghostShape(
  mode: Mode,
  anchor: Coord | null,
  cursor: Coord,
): Shape | null {
  if (mode === "dot" || anchor === null) return null;
  if (mode === "circle") {
    const dx = Math.abs(cursor.x - anchor.x);
    const dy = Math.abs(cursor.y - anchor.y);
    return { kind: "circle", center: anchor, radius: Math.max(dx, dy) };
  }
  if (mode === "line") {
    return { kind: "line", from: anchor, to: cursor };
  }
  return {
    kind: "square",
    tl: { x: Math.min(anchor.x, cursor.x), y: Math.min(anchor.y, cursor.y) },
    br: { x: Math.max(anchor.x, cursor.x), y: Math.max(anchor.y, cursor.y) },
  };
}

export function Canvas(props: CanvasProps): React.ReactElement {
  const { state, ownCursor, anchor, mode, viewport, ownUserId } = props;
  const grid = composeGrid(state, viewport);
  const overlayed = grid.map((row) => row.slice());

  // 1. Ghost preview — dim-colored outline of the pending 2-anchor shape.
  const ghostCells = new Set<string>();
  const ghost = ghostShape(mode, anchor, ownCursor);
  if (ghost) {
    for (const cell of rasterizeShape(ghost)) {
      if (cell.x < 0 || cell.x >= viewport.width) continue;
      if (cell.y < 0 || cell.y >= viewport.height) continue;
      // Ghost cells only appear where the grid is empty — never obscure
      // real drawn content.
      if (overlayed[cell.y]![cell.x] === " ") {
        overlayed[cell.y]![cell.x] = cell.char;
      }
      ghostCells.add(`${cell.x},${cell.y}`);
    }
  }

  // 2. Anchor marker — small • at the anchor point so the user sees it.
  if (
    anchor &&
    anchor.y >= 0 &&
    anchor.y < viewport.height &&
    anchor.x >= 0 &&
    anchor.x < viewport.width
  ) {
    overlayed[anchor.y]![anchor.x] = "◆";
    ghostCells.add(`${anchor.x},${anchor.y}`);
  }

  // 3. Other users' cursors as their first-initial in a per-user color,
  //    so you can tell who's who at a glance.
  const otherCursors = new Map<string, string>();
  for (const [uid, presence] of state.presence) {
    if (uid === ownUserId) continue;
    const { x, y } = presence.cursor;
    if (y >= 0 && y < viewport.height && x >= 0 && x < viewport.width) {
      const label = (presence.name?.[0] ?? "?").toUpperCase();
      overlayed[y]![x] = label;
      otherCursors.set(`${x},${y}`, colorFor(uid));
    }
  }

  // 4. Own cursor last so it always wins. Use a big glyph so it's impossible
  //    to miss, even on tiny fonts / low-contrast themes.
  if (
    ownCursor.y >= 0 &&
    ownCursor.y < viewport.height &&
    ownCursor.x >= 0 &&
    ownCursor.x < viewport.width
  ) {
    overlayed[ownCursor.y]![ownCursor.x] = "█";
  }

  return (
    <Box flexDirection="column" borderStyle="single">
      {overlayed.map((row, y) => (
        <Text key={y}>
          {row.map((cell, x) => {
            if (x === ownCursor.x && y === ownCursor.y) {
              // Own cursor: bright yellow block on inverse.
              return (
                <Text key={x} color="yellow" inverse bold>
                  {cell}
                </Text>
              );
            }
            const otherColor = otherCursors.get(`${x},${y}`);
            if (otherColor) {
              // Remote cursor: user's initial, inverse on their color, bold.
              return (
                <Text key={x} color={otherColor} inverse bold>
                  {cell}
                </Text>
              );
            }
            if (ghostCells.has(`${x},${y}`)) {
              return <Text key={x} dimColor>{cell}</Text>;
            }
            return <Text key={x}>{cell}</Text>;
          })}
        </Text>
      ))}
    </Box>
  );
}
