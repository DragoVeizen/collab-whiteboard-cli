// M2 stub: types are real (encode the wire-format spec §4).
// Zod schemas throw — the M2 loop implements them.

import { z } from "zod";

export type Coord = { x: number; y: number };

export type Shape =
  | { kind: "dot"; at: Coord }
  | { kind: "circle"; center: Coord; radius: number }
  | { kind: "square"; tl: Coord; br: Coord }
  | { kind: "line"; from: Coord; to: Coord };

export type ClientMessage =
  | { type: "draw"; id: string; shape: Shape }
  | { type: "undo"; id: string; targetId: string }
  | { type: "clear"; id: string }
  | { type: "cursor"; at: Coord };

export type ServerEvent =
  | {
      type: "draw";
      id: string;
      canvasId: string;
      userId: string;
      ts: number;
      shape: Shape;
    }
  | {
      type: "undo";
      id: string;
      canvasId: string;
      userId: string;
      ts: number;
      targetId: string;
    }
  | {
      type: "clear";
      id: string;
      canvasId: string;
      userId: string;
      ts: number;
    }
  | {
      type: "cursor";
      canvasId: string;
      userId: string;
      userName: string;
      at: Coord;
    }
  | { type: "join"; canvasId: string; userId: string; userName: string }
  | { type: "leave"; canvasId: string; userId: string }
  | { type: "history"; events: ServerEvent[] }
  | { type: "error"; code: string; msg: string };

// M2 loop must replace these with real zod schemas that match the types above.
export const ClientMessageSchema: z.ZodType<ClientMessage> = z.custom<ClientMessage>(
  () => {
    throw new Error("M2 not implemented: ClientMessageSchema");
  },
);

export const ServerEventSchema: z.ZodType<ServerEvent> = z.custom<ServerEvent>(
  () => {
    throw new Error("M2 not implemented: ServerEventSchema");
  },
);
