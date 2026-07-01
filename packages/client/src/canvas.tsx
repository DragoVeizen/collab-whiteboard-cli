import React from "react";
import { Box, Text } from "ink";
import { composeGrid, type Viewport } from "./rendering.js";
import type { CanvasState } from "./state.js";
import type { Coord } from "@whiteboard/shared";

export type CanvasProps = {
  state: CanvasState;
  ownCursor: Coord;
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
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export function Canvas(props: CanvasProps): React.ReactElement {
  const { state, ownCursor, viewport, ownUserId } = props;
  const grid = composeGrid(state, viewport);

  const overlayed = grid.map((row) => row.slice());

  // Overlay other users' cursors as colored blocks.
  const otherCursors = new Map<string, string>();
  for (const [uid, presence] of state.presence) {
    if (uid === ownUserId) continue;
    const { x, y } = presence.cursor;
    if (y >= 0 && y < viewport.height && x >= 0 && x < viewport.width) {
      overlayed[y]![x] = "▓";
      otherCursors.set(`${x},${y}`, colorFor(uid));
    }
  }
  // Own cursor last (on top).
  if (
    ownCursor.y >= 0 &&
    ownCursor.y < viewport.height &&
    ownCursor.x >= 0 &&
    ownCursor.x < viewport.width
  ) {
    overlayed[ownCursor.y]![ownCursor.x] = "+";
  }

  return (
    <Box flexDirection="column" borderStyle="single">
      {overlayed.map((row, y) => (
        <Text key={y}>
          {row.map((cell, x) => {
            const color = otherCursors.get(`${x},${y}`);
            if (color) return <Text key={x} color={color}>{cell}</Text>;
            if (x === ownCursor.x && y === ownCursor.y) {
              return (
                <Text key={x} color="whiteBright" bold>
                  {cell}
                </Text>
              );
            }
            return <Text key={x}>{cell}</Text>;
          })}
        </Text>
      ))}
    </Box>
  );
}
