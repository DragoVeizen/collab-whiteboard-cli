import React, { useState, useEffect, useMemo } from "react";
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
import { StatusBar } from "./statusbar.js";

export type AppProps = {
  chatId: string;
  userId: string;
  userName: string;
  wsUrl: string;
};

const VIEWPORT = { width: 60, height: 20 };

export function App(props: AppProps): React.ReactElement {
  const { chatId, userId, userName, wsUrl } = props;
  const [canvasState, setChatState] = useState<ChatState>(initialState());
  const [inputState, setInputState] = useState<InputState>(
    initialInputState(VIEWPORT.width, VIEWPORT.height),
  );
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const { exit } = useApp();

  const client = useMemo(
    () =>
      new WsClient({
        url: wsUrl,
        chatId,
        userId,
        userName,
        onEvent: (e) => setChatState((s) => reduce(s, e)),
        onStatusChange: setWsStatus,
      }),
    [wsUrl, chatId, userId, userName],
  );

  useEffect(() => {
    client.connect();
    return () => client.close();
  }, [client]);

  useInput((input, key) => {
    let k = input;
    if (key.escape) k = "escape";
    else if (key.upArrow) k = "k";
    else if (key.downArrow) k = "j";
    else if (key.leftArrow) k = "h";
    else if (key.rightArrow) k = "l";
    else if (input === " ") k = "space";

    const r = reduceInput(inputState, k, randomUUID);
    setInputState(r.state);
    if (r.emit) client.send(r.emit);
    // Broadcast cursor position on any move so other users see us.
    // Cursor events are ephemeral (server does not persist them).
    const moved =
      r.state.cursor.x !== inputState.cursor.x ||
      r.state.cursor.y !== inputState.cursor.y;
    if (moved) {
      client.send({ type: "cursor", at: r.state.cursor });
    }
    if (r.quit) exit();
  });

  return (
    <Box flexDirection="column">
      <Canvas
        state={canvasState}
        ownCursor={inputState.cursor}
        anchor={inputState.anchor}
        mode={inputState.mode}
        viewport={VIEWPORT}
        ownUserId={userId}
      />
      <StatusBar
        chatId={chatId}
        mode={inputState.mode}
        cursor={inputState.cursor}
        state={canvasState}
        ownUserId={userId}
        wsStatus={wsStatus}
      />
    </Box>
  );
}
