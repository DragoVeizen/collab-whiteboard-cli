import { describe, it, expect } from "vitest";
import {
  ClientMessageSchema,
  ServerEventSchema,
  type ClientMessage,
  type ServerEvent,
} from "./events.js";

describe("ClientMessageSchema", () => {
  it("draw message parses", () => {
    const msg: ClientMessage = {
      type: "draw",
      id: "abc-123",
      shape: { kind: "dot", at: { x: 3, y: 4 } },
    };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("undo message parses", () => {
    const msg: ClientMessage = { type: "undo", id: "u1", targetId: "e1" };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("clear message parses", () => {
    const msg: ClientMessage = { type: "clear", id: "c1" };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("cursor message parses", () => {
    const msg: ClientMessage = { type: "cursor", at: { x: 1, y: 2 } };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("circle draw message parses with radius", () => {
    const msg: ClientMessage = {
      type: "draw",
      id: "d1",
      shape: { kind: "circle", center: { x: 5, y: 5 }, radius: 3 },
    };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("square draw message parses with corners", () => {
    const msg: ClientMessage = {
      type: "draw",
      id: "d2",
      shape: { kind: "square", tl: { x: 1, y: 1 }, br: { x: 4, y: 4 } },
    };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("line draw message parses with endpoints", () => {
    const msg: ClientMessage = {
      type: "draw",
      id: "d3",
      shape: { kind: "line", from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
    };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("rejects unknown message type", () => {
    expect(() =>
      ClientMessageSchema.parse({ type: "nonsense", id: "x" }),
    ).toThrow();
  });

  it("rejects malformed shape kind", () => {
    expect(() =>
      ClientMessageSchema.parse({
        type: "draw",
        id: "d4",
        shape: { kind: "triangle", at: { x: 0, y: 0 } },
      }),
    ).toThrow();
  });

  it("rejects draw without id", () => {
    expect(() =>
      ClientMessageSchema.parse({
        type: "draw",
        shape: { kind: "dot", at: { x: 0, y: 0 } },
      }),
    ).toThrow();
  });

  it("rejects cursor without coord", () => {
    expect(() => ClientMessageSchema.parse({ type: "cursor" })).toThrow();
  });

  it("rejects extra ts field (client cannot forge server timestamps)", () => {
    // strict schemas should reject unknown top-level fields on draw
    const withTs = {
      type: "draw",
      id: "d5",
      shape: { kind: "dot", at: { x: 0, y: 0 } },
      ts: 9999,
    };
    expect(() => ClientMessageSchema.parse(withTs)).toThrow();
  });
});

describe("ServerEventSchema", () => {
  it("draw server event parses with server-stamped fields", () => {
    const ev: ServerEvent = {
      type: "draw",
      id: "e1",
      chatId: "c1",
      userId: "u1",
      ts: 1000,
      shape: { kind: "dot", at: { x: 0, y: 0 } },
    };
    expect(() => ServerEventSchema.parse(ev)).not.toThrow();
  });

  it("join server event parses", () => {
    const ev: ServerEvent = {
      type: "join",
      chatId: "c1",
      userId: "u1",
      userName: "vansh",
    };
    expect(() => ServerEventSchema.parse(ev)).not.toThrow();
  });

  it("history server event parses with nested events", () => {
    const ev: ServerEvent = {
      type: "history",
      events: [
        {
          type: "draw",
          id: "e1",
          chatId: "c1",
          userId: "u1",
          ts: 100,
          shape: { kind: "dot", at: { x: 1, y: 1 } },
        },
      ],
    };
    expect(() => ServerEventSchema.parse(ev)).not.toThrow();
  });

  it("error server event parses with code and msg", () => {
    const ev: ServerEvent = {
      type: "error",
      code: "undo_forbidden",
      msg: "cannot undo another user's event",
    };
    expect(() => ServerEventSchema.parse(ev)).not.toThrow();
  });

  it("rejects draw without server-stamped ts", () => {
    expect(() =>
      ServerEventSchema.parse({
        type: "draw",
        id: "e1",
        chatId: "c1",
        userId: "u1",
        shape: { kind: "dot", at: { x: 0, y: 0 } },
      }),
    ).toThrow();
  });

  it("chatMessage server event parses", () => {
    const ev: ServerEvent = {
      type: "chatMessage",
      id: "m1",
      chatId: "c1",
      userId: "u1",
      userName: "Vansh",
      ts: 100,
      text: "hello",
    };
    expect(() => ServerEventSchema.parse(ev)).not.toThrow();
  });

  it("read server event parses", () => {
    const ev: ServerEvent = {
      type: "read",
      id: "r1",
      chatId: "c1",
      userId: "u2",
      ts: 200,
      messageId: "m1",
    };
    expect(() => ServerEventSchema.parse(ev)).not.toThrow();
  });
});

describe("ClientMessage chat variants", () => {
  it("chatMessage message parses", () => {
    const msg: ClientMessage = { type: "chatMessage", id: "m1", text: "hi" };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("read message parses", () => {
    const msg: ClientMessage = { type: "read", messageId: "m1" };
    expect(() => ClientMessageSchema.parse(msg)).not.toThrow();
  });

  it("rejects chatMessage with server-stamped fields", () => {
    // Client cannot supply ts / userId / chatId / userName on outbound.
    expect(() =>
      ClientMessageSchema.parse({
        type: "chatMessage",
        id: "m1",
        text: "hi",
        ts: 999,
      }),
    ).toThrow();
  });

  it("rejects chatMessage with empty text", () => {
    expect(() =>
      ClientMessageSchema.parse({ type: "chatMessage", id: "m1", text: "" }),
    ).toThrow();
  });
});
