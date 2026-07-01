import type { Coord, Shape, ServerEvent } from "@whiteboard/shared";

export type Presence = { name: string; cursor: Coord };

export type ChatState = {
  shapes: Map<string, Shape>;
  // Parallel to shapes: eventId → userId of whoever drew it.
  // Used by the renderer to color shapes by author.
  shapeAuthors: Map<string, string>;
  undone: Set<string>;
  clearedAt: number;
  presence: Map<string, Presence>;
};

export function initialState(): ChatState {
  return {
    shapes: new Map(),
    shapeAuthors: new Map(),
    undone: new Set(),
    clearedAt: 0,
    presence: new Map(),
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
    case "history": {
      return event.events.reduce(reduce, state);
    }
    case "error": {
      return state;
    }
  }
}
