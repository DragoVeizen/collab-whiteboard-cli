import React from "react";
import { Box, Text } from "ink";
import type { ChatState } from "./state.js";
import type { ActiveTab, Mode } from "./input.js";
import type { Coord } from "@whiteboard/shared";
import { colorFor } from "./colors.js";

export type StatusBarProps = {
  chatId: string;
  mode: Mode;
  cursor: Coord;
  state: ChatState;
  ownUserId: string;
  wsStatus: "connecting" | "open" | "closed";
  activeTab: ActiveTab;
};

export function StatusBar(props: StatusBarProps): React.ReactElement {
  const { chatId, mode, cursor, state, ownUserId, wsStatus, activeTab } = props;
  const others = [...state.presence.entries()].filter(
    ([uid]) => uid !== ownUserId,
  );
  const tabLabel =
    activeTab === "canvas" ? "CANVAS" : "CHAT";
  return (
    <Box flexDirection="column">
      <Text>
        chat: <Text bold>{chatId}</Text> · view:{" "}
        <Text bold color="cyan">
          {tabLabel}
        </Text>{" "}
        · ws:{" "}
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
      {activeTab === "canvas" ? (
        <Text dimColor>
          [1]dot [2]circle [3]line [4]square · hjkl move · HJKL x5 · space
          place/anchor · esc cancel · u undo · x clear · tab chat · q quit
        </Text>
      ) : (
        <Text dimColor>
          type to compose · enter send · backspace delete · esc clear · tab
          canvas · q quit
        </Text>
      )}
    </Box>
  );
}
