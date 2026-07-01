import type { ClientMessage, Coord } from "@whiteboard/shared";

export type Mode = "dot" | "circle" | "line" | "square";

export type ActiveTab = "canvas" | "chat";

export type InputState = {
  mode: Mode;
  cursor: Coord;
  anchor: Coord | null;
  ownDraws: string[];
  width: number;
  height: number;
  activeTab: ActiveTab;
  chatDraft: string;
};

export type InputResult = {
  state: InputState;
  emit: ClientMessage | null;
  quit: boolean;
};

export function initialInputState(
  width: number,
  height: number,
): InputState {
  return {
    mode: "dot",
    cursor: { x: 0, y: 0 },
    anchor: null,
    ownDraws: [],
    width,
    height,
    activeTab: "canvas",
    chatDraft: "",
  };
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(v, hi));

const noEmit = (state: InputState): InputResult => ({
  state,
  emit: null,
  quit: false,
});

const modeKeys: Record<string, Mode> = {
  "1": "dot",
  "2": "circle",
  "3": "line",
  "4": "square",
};

export function reduceInput(
  state: InputState,
  key: string,
  idGen: () => string,
): InputResult {
  // Tab always toggles the active view, regardless of which view is up.
  // Leaves canvas: clear any pending anchor so it doesn't stick around.
  if (key === "tab") {
    const nextTab: ActiveTab =
      state.activeTab === "canvas" ? "chat" : "canvas";
    return noEmit({ ...state, activeTab: nextTab, anchor: null });
  }

  if (state.activeTab === "chat") {
    return reduceChatInput(state, key, idGen);
  }

  const newMode = modeKeys[key];
  if (newMode !== undefined) {
    return noEmit({ ...state, mode: newMode, anchor: null });
  }

  const move = (dx: number, dy: number): InputResult =>
    noEmit({
      ...state,
      cursor: {
        x: clamp(state.cursor.x + dx, 0, state.width - 1),
        y: clamp(state.cursor.y + dy, 0, state.height - 1),
      },
    });

  switch (key) {
    case "h": return move(-1, 0);
    case "j": return move(0, 1);
    case "k": return move(0, -1);
    case "l": return move(1, 0);
    case "H": return move(-5, 0);
    case "J": return move(0, 5);
    case "K": return move(0, -5);
    case "L": return move(5, 0);
    case "escape":
      return noEmit({ ...state, anchor: null });
    case "q":
      return { state, emit: null, quit: true };
    case "u": {
      if (state.ownDraws.length === 0) return noEmit(state);
      const target = state.ownDraws[state.ownDraws.length - 1]!;
      const ownDraws = state.ownDraws.slice(0, -1);
      return {
        state: { ...state, ownDraws },
        emit: { type: "undo", id: idGen(), targetId: target },
        quit: false,
      };
    }
    case "x":
      return {
        state,
        emit: { type: "clear", id: idGen() },
        quit: false,
      };
    case "space": {
      const { mode, cursor, anchor } = state;
      if (mode === "dot") {
        const id = idGen();
        return {
          state: { ...state, ownDraws: [...state.ownDraws, id] },
          emit: {
            type: "draw",
            id,
            shape: { kind: "dot", at: { x: cursor.x, y: cursor.y } },
          },
          quit: false,
        };
      }
      if (anchor === null) {
        return noEmit({ ...state, anchor: { x: cursor.x, y: cursor.y } });
      }
      const id = idGen();
      let shape;
      if (mode === "circle") {
        const dx = Math.abs(cursor.x - anchor.x);
        const dy = Math.abs(cursor.y - anchor.y);
        shape = {
          kind: "circle" as const,
          center: { x: anchor.x, y: anchor.y },
          radius: Math.max(dx, dy),
        };
      } else if (mode === "line") {
        shape = {
          kind: "line" as const,
          from: { x: anchor.x, y: anchor.y },
          to: { x: cursor.x, y: cursor.y },
        };
      } else {
        shape = {
          kind: "square" as const,
          tl: {
            x: Math.min(anchor.x, cursor.x),
            y: Math.min(anchor.y, cursor.y),
          },
          br: {
            x: Math.max(anchor.x, cursor.x),
            y: Math.max(anchor.y, cursor.y),
          },
        };
      }
      return {
        state: {
          ...state,
          anchor: null,
          ownDraws: [...state.ownDraws, id],
        },
        emit: { type: "draw", id, shape },
        quit: false,
      };
    }
    default:
      return noEmit(state);
  }
}

function reduceChatInput(
  state: InputState,
  key: string,
  idGen: () => string,
): InputResult {
  if (key === "enter") {
    if (state.chatDraft.length === 0) return noEmit(state);
    const text = state.chatDraft;
    return {
      state: { ...state, chatDraft: "" },
      emit: { type: "chatMessage", id: idGen(), text },
      quit: false,
    };
  }
  if (key === "backspace") {
    return noEmit({ ...state, chatDraft: state.chatDraft.slice(0, -1) });
  }
  if (key === "escape") {
    return noEmit({ ...state, chatDraft: "" });
  }
  // Any single printable character appends to draft. Ink passes multi-char
  // sequences (e.g. arrow keys, function keys) as key.<name>; those hit the
  // main mapper in app.tsx and never reach here as a single-char key. So
  // filtering by length === 1 is enough.
  if (key.length === 1) {
    return noEmit({ ...state, chatDraft: state.chatDraft + key });
  }
  return noEmit(state);
}
