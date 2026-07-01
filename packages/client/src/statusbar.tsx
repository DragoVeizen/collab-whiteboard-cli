import React from "react";
import { Box, Text } from "ink";
import type { CanvasState } from "./state.js";
import type { Mode } from "./input.js";
import type { Coord } from "@whiteboard/shared";

export type StatusBarProps = {
  canvasId: string;
  mode: Mode;
  cursor: Coord;
  state: CanvasState;
  ownUserId: string;
  wsStatus: "connecting" | "open" | "closed";
};

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const { canvasId, mode, cursor, state, wsStatus } = props;
  const online = state.presence.size;
  return (
    <Box flexDirection="column">
      <Text>
        canvas: <Text bold>{canvasId}</Text> · {online} online · ws:{" "}
        <Text color={wsStatus === "open" ? "green" : "yellow"}>
          {wsStatus}
        </Text>{" "}
        · mode: <Text bold>{mode.toUpperCase()}</Text> · cursor: (
        {cursor.x}, {cursor.y})
      </Text>
      <Text dimColor>
        [1]dot [2]circle [3]line [4]square · hjkl move · HJKL x5 · space
        place/anchor · esc cancel · u undo · x clear · q quit
      </Text>
    </Box>
  );
}
