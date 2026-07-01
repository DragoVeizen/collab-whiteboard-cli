import React from "react";
import {
  composeColoredGrid,
  rasterizeShape,
  type ColoredCell,
  type Viewport,
} from "./rendering.js";
import { Box, Text } from "ink";
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
  const grid = composeColoredGrid(state, viewport);
  const overlayed: ColoredCell[][] = grid.map((row) =>
    row.map((c) => ({ ...c })),
  );

  // 1. Ghost preview — dim outline of the pending 2-anchor shape.
  const ghostCells = new Set<string>();
  const ghost = ghostShape(mode, anchor, ownCursor);
  if (ghost) {
    for (const cell of rasterizeShape(ghost)) {
      if (cell.x < 0 || cell.x >= viewport.width) continue;
      if (cell.y < 0 || cell.y >= viewport.height) continue;
      // Only fill cells that are still empty so we never obscure real shapes.
      if (overlayed[cell.y]![cell.x]!.char === " ") {
        overlayed[cell.y]![cell.x] = { char: cell.char };
      }
      ghostCells.add(`${cell.x},${cell.y}`);
    }
  }

  // 2. Anchor marker.
  if (
    anchor &&
    anchor.y >= 0 &&
    anchor.y < viewport.height &&
    anchor.x >= 0 &&
    anchor.x < viewport.width
  ) {
    overlayed[anchor.y]![anchor.x] = { char: "◆" };
    ghostCells.add(`${anchor.x},${anchor.y}`);
  }

  // 3. Other users' cursors — their initial in the peer color.
  const otherCursors = new Map<string, string>();
  for (const [uid, presence] of state.presence) {
    if (uid === ownUserId) continue;
    const { x, y } = presence.cursor;
    if (y >= 0 && y < viewport.height && x >= 0 && x < viewport.width) {
      const label = (presence.name?.[0] ?? "?").toUpperCase();
      overlayed[y]![x] = { char: label };
      otherCursors.set(`${x},${y}`, colorFor(uid));
    }
  }

  // 4. Own cursor wins.
  if (
    ownCursor.y >= 0 &&
    ownCursor.y < viewport.height &&
    ownCursor.x >= 0 &&
    ownCursor.x < viewport.width
  ) {
    overlayed[ownCursor.y]![ownCursor.x] = { char: "█" };
  }

  return (
    <Box flexDirection="column" borderStyle="single">
      {overlayed.map((row, y) => (
        <Text key={y}>
          {row.map((cell, x) => {
            if (x === ownCursor.x && y === ownCursor.y) {
              return (
                <Text key={x} color="yellow">
                  {cell.char}
                </Text>
              );
            }
            const otherColor = otherCursors.get(`${x},${y}`);
            if (otherColor) {
              return (
                <Text key={x} color={otherColor}>
                  {cell.char}
                </Text>
              );
            }
            if (ghostCells.has(`${x},${y}`)) {
              return (
                <Text key={x} dimColor>
                  {cell.char}
                </Text>
              );
            }
            // Shape cell — color by whoever drew it.
            if (cell.userId) {
              return (
                <Text key={x} color={colorFor(cell.userId)}>
                  {cell.char}
                </Text>
              );
            }
            return <Text key={x}>{cell.char}</Text>;
          })}
        </Text>
      ))}
    </Box>
  );
}
