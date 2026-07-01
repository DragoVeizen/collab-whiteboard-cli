import type { Coord, Shape, ServerEvent } from "@whiteboard/shared";

export type Presence = { name: string; cursor: Coord };

// One chat message, as tracked in client state.
export type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  ts: number;
  text: string;
};

export type ChatState = {
  shapes: Map<string, Shape>;
  // Parallel to shapes: eventId → userId of whoever drew it.
  // Used by the renderer to color shapes by author.
  shapeAuthors: Map<string, string>;
  undone: Set<string>;
  clearedAt: number;
  presence: Map<string, Presence>;
  // Chat log for this room. Keyed by message id; insertion order is
  // arrival order (which matches ts because the server stamps ts).
  messages: Map<string, ChatMessage>;
  // messageId → set of userIds who have read it.
  readReceipts: Map<string, Set<string>>;
};

export function initialState(): ChatState {
  return {
    shapes: new Map(),
    shapeAuthors: new Map(),
    undone: new Set(),
    clearedAt: 0,
    presence: new Map(),
    messages: new Map(),
    readReceipts: new Map(),
  };
}

export function reduce(state: ChatState, event: ServerEvent): ChatState {
  switch (event.type) {
    case "draw": {
      const shapes = new Map(state.shapes);
      const shapeAuthors = new Map(state.shapeAuthors);
      shapes.set(event.id, event.shape);
      shapeAuthors.set(event.id, event.userId);
      return { ...state, shapes, shapeAuthors };
    }
    case "undo": {
      const undone = new Set(state.undone);
      undone.add(event.targetId);
      return { ...state, undone };
    }
    case "clear": {
      return {
        ...state,
        shapes: new Map(),
        shapeAuthors: new Map(),
        undone: new Set(),
        clearedAt: event.ts,
      };
    }
    case "cursor": {
      const presence = new Map(state.presence);
      const existing = presence.get(event.userId);
      presence.set(event.userId, {
        name: existing?.name ?? event.userName,
        cursor: event.at,
      });
      return { ...state, presence };
    }
    case "join": {
      const presence = new Map(state.presence);
      const existing = presence.get(event.userId);
      presence.set(event.userId, {
        name: event.userName,
        cursor: existing?.cursor ?? { x: 0, y: 0 },
      });
      return { ...state, presence };
    }
    case "leave": {
      const presence = new Map(state.presence);
      presence.delete(event.userId);
      return { ...state, presence };
    }
    case "chatMessage": {
      const messages = new Map(state.messages);
      messages.set(event.id, {
        id: event.id,
        userId: event.userId,
        userName: event.userName,
        ts: event.ts,
        text: event.text,
      });
      return { ...state, messages };
    }
    case "read": {
      const readReceipts = new Map(state.readReceipts);
      const existing = readReceipts.get(event.messageId);
      const updated = new Set(existing ?? []);
      updated.add(event.userId);
      readReceipts.set(event.messageId, updated);
      return { ...state, readReceipts };
    }
    case "history": {
      return event.events.reduce(reduce, state);
    }
    case "error": {
      return state;
    }
  }
}
