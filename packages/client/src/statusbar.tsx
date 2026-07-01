// M4 stub: status bar (mode, cursor, presence list). Impl throws.

import React from "react";
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

export function StatusBar(_props: StatusBarProps): React.ReactElement {
  throw new Error("M4 not implemented: StatusBar component");
}
