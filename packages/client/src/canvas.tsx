// M4 stub: renders the ASCII grid. Impl throws.

import React from "react";
import type { CanvasState } from "./state.js";
import type { Coord } from "@whiteboard/shared";
import type { Viewport } from "./rendering.js";

export type CanvasProps = {
  state: CanvasState;
  ownCursor: Coord;
  viewport: Viewport;
  ownUserId: string;
};

export function Canvas(_props: CanvasProps): React.ReactElement {
  throw new Error("M4 not implemented: Canvas component");
}
