import type { Coord, Shape, ServerEvent } from "@whiteboard/shared";

export type Presence = { name: string; cursor: Coord };

export type CanvasState = {
  shapes: Map<string, Shape>;
  undone: Set<string>;
  clearedAt: number;
  presence: Map<string, Presence>;
};

export function initialState(): CanvasState {
  return {
    shapes: new Map(),
    undone: new Set(),
    clearedAt: 0,
    presence: new Map(),
  };
}

export function reduce(state: CanvasState, event: ServerEvent): CanvasState {
  switch (event.type) {
    case "draw": {
      const shapes = new Map(state.shapes);
      shapes.set(event.id, event.shape);
      return { ...state, shapes };
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
