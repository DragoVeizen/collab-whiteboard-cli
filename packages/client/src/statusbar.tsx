import React from "react";
import { Box, Text } from "ink";
import type { ChatState } from "./state.js";
import type { Mode } from "./input.js";
import type { Coord } from "@whiteboard/shared";

export type StatusBarProps = {
  chatId: string;
  mode: Mode;
  cursor: Coord;
  state: ChatState;
  ownUserId: string;
  wsStatus: "connecting" | "open" | "closed";
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

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const { chatId, mode, cursor, state, ownUserId, wsStatus } = props;
  const others = [...state.presence.entries()].filter(
    ([uid]) => uid !== ownUserId,
  );
  return (
    <Box flexDirection="column">
      <Text>
        canvas: <Text bold>{chatId}</Text> · ws:{" "}
        <Text color={wsStatus === "open" ? "green" : "yellow"}>
          {wsStatus}
        </Text>{" "}
        · mode: <Text bold>{mode.toUpperCase()}</Text> · cursor: (
        {cursor.x}, {cursor.y})
      </Text>
      <Text>
        <Text color="yellow">█</Text> you
        {others.length > 0 ? " · " : ""}
        {others.map(([uid, p], i) => (
          <Text key={uid}>
            {i > 0 ? " · " : ""}
            <Text color={colorFor(uid)}>
              {(p.name?.[0] ?? "?").toUpperCase()}
            </Text>{" "}
            <Text color={colorFor(uid)}>{p.name}</Text>
          </Text>
        ))}
      </Text>
      <Text dimColor>
        [1]dot [2]circle [3]line [4]square · hjkl move · HJKL x5 · space
        place/anchor · esc cancel · u undo · x clear · q quit
      </Text>
    </Box>
  );
}
