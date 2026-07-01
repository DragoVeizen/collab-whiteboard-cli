// M6 stub: Chat panel component. Impl throws — M6 impl fills it in.

import React from "react";
import type { ChatState } from "./state.js";

export type ChatProps = {
  state: ChatState;
  ownUserId: string;
  chatDraft: string;
  width: number;
  height: number;
};

export function Chat(_props: ChatProps): React.ReactElement {
  throw new Error("M6 not implemented: Chat component");
}
