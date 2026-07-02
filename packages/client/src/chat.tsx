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
    const initial = (p?.name?.[0] ?? uid[0] ?? "?").toUpperCase();
    initials.push(initial);
  }
  return initials.join("");
}

export function Chat(props: ChatProps): React.ReactElement {
  const { state, ownUserId, chatDraft, height } = props;
  const messages = [...state.messages.values()];
  // Reserve rows for header + input + border. Show the tail.
  const maxVisible = Math.max(3, height - 5);
  const shown = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" borderStyle="single">
      <Text>
        <Text bold color="cyan">CHAT</Text>
        <Text dimColor>{" · " + state.messages.size + " messages"}</Text>
      </Text>
      {shown.length === 0 ? (
        <Text dimColor>(no messages yet — type to send)</Text>
      ) : (
        shown.map((msg) => {
          const isOwn = msg.userId === ownUserId;
          const initial = (msg.userName?.[0] ?? "?").toUpperCase();
          const readers = state.readReceipts.get(msg.id);
          const readByOthersLabel = isOwn
            ? formatReaders(readers, msg.userId, state)
            : "";
          return (
            <Text key={msg.id}>
              <Text color={colorFor(msg.userId)} bold>
                {initial}
              </Text>
              <Text>{" "}</Text>
              <Text color={colorFor(msg.userId)}>{msg.userName}</Text>
              <Text>{": "}</Text>
              <Text>{msg.text}</Text>
              {readByOthersLabel.length > 0 ? (
                <Text dimColor>{"  ✓" + readByOthersLabel}</Text>
              ) : null}
            </Text>
          );
        })
      )}
      <Text>
        <Text dimColor>{"> "}</Text>
        <Text>{chatDraft}</Text>
        <Text color="yellow">{"█"}</Text>
      </Text>
    </Box>
  );
}
