import React, { useState, useEffect, useMemo, useRef } from "react";
import { Box, useInput, useApp } from "ink";
import { randomUUID } from "node:crypto";
import { WsClient } from "./ws.js";
import { initialState, reduce, type ChatState } from "./state.js";
import {
  initialInputState,
  reduceInput,
  type InputState,
} from "./input.js";
import { Canvas } from "./canvas.js";
import { Chat } from "./chat.js";
import { StatusBar } from "./statusbar.js";
import { stepEnvelopes, type Envelope } from "./envelope.js";

export type AppProps = {
  chatId: string;
  userId: string;
  userName: string;
  wsUrl: string;
};

const VIEWPORT = { width: 60, height: 20 };
// Envelope target: bottom-right of the canvas — where the chat drawer / tab
// would live if it were on-screen. Gives the animation a consistent
// destination regardless of who sent the message.
const ENVELOPE_TARGET = { x: VIEWPORT.width - 1, y: VIEWPORT.height - 1 };
const ENVELOPE_TICK_MS = 100;

export function App(props: AppProps): React.ReactElement {
  const { chatId, userId, userName, wsUrl } = props;
  const [chatState, setChatState] = useState<ChatState>(initialState());
  const [inputState, setInputState] = useState<InputState>(
    initialInputState(VIEWPORT.width, VIEWPORT.height),
  );
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "open" | "closed"
  >("connecting");
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const { exit } = useApp();

  // Refs used inside the ws.onEvent closure so we can read the latest
  // values without re-creating the WsClient every render.
  const chatStateRef = useRef(chatState);
  chatStateRef.current = chatState;
  const activeTabRef = useRef(inputState.activeTab);
  activeTabRef.current = inputState.activeTab;

  const client = useMemo(
    () =>
      new WsClient({
        url: wsUrl,
        chatId,
        userId,
        userName,
        onEvent: (e) => {
          setChatState((s) => reduce(s, e));
          if (e.type === "chatMessage" && e.userId !== userId) {
            // Auto-send read receipt for the peer's message.
            client.send({ type: "read", messageId: e.id });
            // Spawn an envelope on the canvas view; if we're on the chat
            // view, no animation (the message just arrives in the log).
            if (activeTabRef.current === "canvas") {
              const from =
                chatStateRef.current.presence.get(e.userId)?.cursor ?? {
                  x: 0,
                  y: 0,
                };
              setEnvelopes((prev) => [
                ...prev,
                {
                  id: e.id,
                  from,
                  to: ENVELOPE_TARGET,
                  progress: 0,
                  senderId: e.userId,
                },
              ]);
            }
          }
        },
        onStatusChange: setWsStatus,
      }),
    // Client is intentionally created once — its callback closes over
    // refs, not stale state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wsUrl, chatId, userId, userName],
  );

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  // Envelope animation tick.
  useEffect(() => {
    const timer = setInterval(() => {
      setEnvelopes((prev) => {
        if (prev.length === 0) return prev;
        return stepEnvelopes(prev, ENVELOPE_TICK_MS);
      });
    }, ENVELOPE_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useInput((input, key) => {
    let k = input;
    if (key.tab) k = "tab";
    else if (key.escape) k = "escape";
    else if (key.return) k = "enter";
    else if (key.backspace || key.delete) k = "backspace";
    else if (key.upArrow) k = "k";
    else if (key.downArrow) k = "j";
    else if (key.leftArrow) k = "h";
    else if (key.rightArrow) k = "l";
    else if (input === " ") k = "space";

    const r = reduceInput(inputState, k, randomUUID);
    setInputState(r.state);
    if (r.emit) client.send(r.emit);
    // Broadcast cursor moves so peers see us — only when we're on canvas.
    if (r.state.activeTab === "canvas") {
      const moved =
        r.state.cursor.x !== inputState.cursor.x ||
        r.state.cursor.y !== inputState.cursor.y;
      if (moved) client.send({ type: "cursor", at: r.state.cursor });
    }
    if (r.quit) exit();
  });

  return (
    <Box flexDirection="column">
      {inputState.activeTab === "canvas" ? (
        <Canvas
          state={chatState}
          ownCursor={inputState.cursor}
          anchor={inputState.anchor}
          mode={inputState.mode}
          viewport={VIEWPORT}
          ownUserId={userId}
          envelopes={envelopes}
        />
      ) : (
        <Chat
          state={chatState}
          ownUserId={userId}
          chatDraft={inputState.chatDraft}
          width={VIEWPORT.width}
          height={VIEWPORT.height}
        />
      )}
      <StatusBar
        chatId={chatId}
        mode={inputState.mode}
        cursor={inputState.cursor}
        state={chatState}
        ownUserId={userId}
        wsStatus={wsStatus}
        activeTab={inputState.activeTab}
      />
    </Box>
  );
}
