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
  | { type: "cursor"; at: Coord }
  | { type: "chatMessage"; id: string; text: string }
  | { type: "read"; messageId: string };

// Events that are persisted to Mongo. Every one has id + chatId + userId + ts.
// This is a strict subset of ServerEvent — cursor / join / leave / history / error
// are ephemeral and never written to the event log.
export type PersistableEvent =
  | {
      type: "draw";
      id: string;
      chatId: string;
      userId: string;
      ts: number;
      shape: Shape;
    }
  | {
      type: "undo";
      id: string;
      chatId: string;
      userId: string;
      ts: number;
      targetId: string;
    }
  | {
      type: "clear";
      id: string;
      chatId: string;
      userId: string;
      ts: number;
    }
  | {
      type: "chatMessage";
      id: string;
      chatId: string;
      userId: string;
      userName: string;
      ts: number;
      text: string;
    }
  | {
      type: "read";
      id: string;
      chatId: string;
      userId: string;
      ts: number;
      messageId: string;
    };

export type ServerEvent =
  | PersistableEvent
  | {
      type: "cursor";
      chatId: string;
      userId: string;
      userName: string;
      at: Coord;
    }
  | { type: "join"; chatId: string; userId: string; userName: string }
  | { type: "leave"; chatId: string; userId: string }
  | { type: "history"; events: PersistableEvent[] }
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
    z
      .object({
        type: z.literal("chatMessage"),
        id: z.string(),
        text: z.string().min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal("read"),
        messageId: z.string(),
      })
      .strict(),
  ],
);

export const PersistableEventSchema: z.ZodType<PersistableEvent> = z.discriminatedUnion(
  "type",
  [
    z
      .object({
        type: z.literal("draw"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
        shape: ShapeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("undo"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
        targetId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("clear"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
      })
      .strict(),
    z
      .object({
        type: z.literal("chatMessage"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        userName: z.string(),
        ts: z.number(),
        text: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("read"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
        messageId: z.string(),
      })
      .strict(),
  ],
);

export const ServerEventSchema: z.ZodType<ServerEvent> = z.discriminatedUnion(
  "type",
  [
    z
      .object({
        type: z.literal("draw"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
        shape: ShapeSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("undo"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
        targetId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("clear"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
      })
      .strict(),
    z
      .object({
        type: z.literal("cursor"),
        chatId: z.string(),
        userId: z.string(),
        userName: z.string(),
        at: CoordSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("join"),
        chatId: z.string(),
        userId: z.string(),
        userName: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("leave"),
        chatId: z.string(),
        userId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("chatMessage"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        userName: z.string(),
        ts: z.number(),
        text: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("read"),
        id: z.string(),
        chatId: z.string(),
        userId: z.string(),
        ts: z.number(),
        messageId: z.string(),
      })
      .strict(),
    z
      .object({
        type: z.literal("history"),
        events: z.array(PersistableEventSchema),
      })
      .strict(),
    z
      .object({
        type: z.literal("error"),
        code: z.string(),
        msg: z.string(),
      })
      .strict(),
  ],
);
