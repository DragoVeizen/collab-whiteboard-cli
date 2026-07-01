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

const CoordSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

const ShapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dot"), at: CoordSchema }).strict(),
  z
    .object({
      kind: z.literal("circle"),
      center: CoordSchema,
      radius: z.number(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("square"),
      tl: CoordSchema,
      br: CoordSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("line"),
      from: CoordSchema,
      to: CoordSchema,
    })
    .strict(),
]);

export const ClientMessageSchema: z.ZodType<ClientMessage> = z.discriminatedUnion(
  "type",
  [
    z
      .object({
        type: z.literal("draw"),
        id: z.string(),
        shape: ShapeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("undo"),
        id: z.string(),
        targetId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("clear"),
        id: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("cursor"),
        at: CoordSchema,
      })
      .strict(),
  ],
);

export const ServerEventSchema: z.ZodType<ServerEvent> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("draw"),
        id: z.string(),
        canvasId: z.string(),
        userId: z.string(),
        ts: z.number(),
        shape: ShapeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("undo"),
        id: z.string(),
        canvasId: z.string(),
        userId: z.string(),
        ts: z.number(),
        targetId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("clear"),
        id: z.string(),
        canvasId: z.string(),
        userId: z.string(),
        ts: z.number(),
      })
      .strict(),
    z
      .object({
        type: z.literal("cursor"),
        canvasId: z.string(),
        userId: z.string(),
        userName: z.string(),
        at: CoordSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("join"),
        canvasId: z.string(),
        userId: z.string(),
        userName: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("leave"),
        canvasId: z.string(),
        userId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("history"),
        events: z.array(ServerEventSchema),
      })
      .strict(),
    z
      .object({
        type: z.literal("error"),
        code: z.string(),
        msg: z.string(),
      })
      .strict(),
  ]),
);
