import React, { useState, useEffect, useMemo } from "react";
import { Box, useInput, useApp } from "ink";
import { randomUUID } from "node:crypto";
import { WsClient } from "./ws.js";
import { initialState, reduce, type CanvasState } from "./state.js";
import {
  initialInputState,
  reduceInput,
  type InputState,
} from "./input.js";
import { Canvas } from "./canvas.js";
import { StatusBar } from "./statusbar.js";

export type AppProps = {
  canvasId: string;
  userId: string;
  userName: string;
  wsUrl: string;
};

const VIEWPORT = { width: 60, height: 20 };

export function App(props: AppProps): React.ReactElement {
  const { canvasId, userId, userName, wsUrl } = props;
  const [canvasState, setCanvasState] = useState<CanvasState>(initialState());
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
        canvasId,
        userId,
        userName,
        onEvent: (e) => setCanvasState((s) => reduce(s, e)),
        onStatusChange: setWsStatus,
      }),
    [wsUrl, canvasId, userId, userName],
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
    if (r.quit) exit();
  });

  return (
    <Box flexDirection="column">
      <Canvas
        state={canvasState}
        ownCursor={inputState.cursor}
        viewport={VIEWPORT}
        ownUserId={userId}
      />
      <StatusBar
        canvasId={canvasId}
        mode={inputState.mode}
        cursor={inputState.cursor}
        state={canvasState}
        ownUserId={userId}
        wsStatus={wsStatus}
      />
    </Box>
  );
}
