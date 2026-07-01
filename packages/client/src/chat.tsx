import React from "react";
import { Box, Text } from "ink";
import type { ChatState } from "./state.js";
import { colorFor } from "./colors.js";

export type ChatProps = {
  state: ChatState;
  ownUserId: string;
  chatDraft: string;
  width: number;
  height: number;
};

function formatReaders(
  readers: Set<string> | undefined,
  senderId: string,
  state: ChatState,
): string {
  if (!readers) return "";
  const initials: string[] = [];
  for (const uid of readers) {
    if (uid === senderId) continue;
    const p = state.presence.get(uid);
    // fall back to the userId's first char if presence hasn't tracked
    // this user yet (e.g., they read then disconnected).
    const initial = (p?.name?.[0] ?? uid[0] ?? "?").toUpperCase();
    initials.push(initial);
  }
  return initials.join("");
}

export function Chat(props: ChatProps): React.ReactElement {
  const { state, ownUserId, chatDraft, height } = props;
  const messages = [...state.messages.values()];
  // Reserve 3 rows for border (top/bottom) + input line. Show the tail.
  const maxVisible = Math.max(1, height - 3);
  const shown = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" borderStyle="single" height={height}>
      <Box flexDirection="column" flexGrow={1}>
        {shown.map((msg) => {
          const isOwn = msg.userId === ownUserId;
          const initial = (msg.userName?.[0] ?? "?").toUpperCase();
          const readers = state.readReceipts.get(msg.id);
          const readByOthersLabel = isOwn
            ? formatReaders(readers, msg.userId, state)
            : "";
          return (
            <Text key={msg.id}>
              <Text color={colorFor(msg.userId)}>{initial}</Text>{" "}
              <Text color={colorFor(msg.userId)}>{msg.userName}</Text>
              <Text>{": "}</Text>
              <Text>{msg.text}</Text>
              {readByOthersLabel.length > 0 ? (
                <Text dimColor>{"  ✓" + readByOthersLabel}</Text>
              ) : null}
            </Text>
          );
        })}
      </Box>
      <Text>
        <Text dimColor>{"> "}</Text>
        {chatDraft}
        <Text color="yellow">{"█"}</Text>
      </Text>
    </Box>
  );
}
