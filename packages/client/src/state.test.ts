import { describe, it, expect } from "vitest";
import { initialState, reduce } from "./state.js";
import type { PersistableEvent, ServerEvent, Shape } from "@whiteboard/shared";

const draw = (
  id: string,
  userId: string,
  ts: number,
  shape: Shape,
): PersistableEvent => ({
  type: "draw",
  id,
  chatId: "c1",
  userId,
  ts,
  shape,
});
const undo = (
  id: string,
  userId: string,
  ts: number,
  targetId: string,
): PersistableEvent => ({
  type: "undo",
  id,
  chatId: "c1",
  userId,
  ts,
  targetId,
});
const clear = (id: string, userId: string, ts: number): PersistableEvent => ({
  type: "clear",
  id,
  chatId: "c1",
  userId,
  ts,
});
const cursor = (userId: string, x: number, y: number): ServerEvent => ({
  type: "cursor",
  chatId: "c1",
  userId,
  userName: userId,
  at: { x, y },
});
const join = (userId: string): ServerEvent => ({
  type: "join",
  chatId: "c1",
  userId,
  userName: userId,
});
const leave = (userId: string): ServerEvent => ({
  type: "leave",
  chatId: "c1",
  userId,
});
const chatMessage = (
  id: string,
  userId: string,
  ts: number,
  text: string,
): PersistableEvent => ({
  type: "chatMessage",
  id,
  chatId: "c1",
  userId,
  userName: userId,
  ts,
  text,
});
const read = (
  id: string,
  userId: string,
  ts: number,
  messageId: string,
): PersistableEvent => ({
  type: "read",
  id,
  chatId: "c1",
  userId,
  ts,
  messageId,
});
const dot = (x: number, y: number): Shape => ({ kind: "dot", at: { x, y } });

describe("reducer: draw", () => {
  it("draw appends shape to state", () => {
    const s = reduce(initialState(), draw("e1", "u1", 100, dot(0, 0)));
    expect(s.shapes.has("e1")).toBe(true);
    expect(s.shapes.get("e1")).toEqual(dot(0, 0));
  });

  it("multiple draws all present", () => {
    let s = initialState();
    s = reduce(s, draw("e1", "u1", 100, dot(0, 0)));
    s = reduce(s, draw("e2", "u2", 101, dot(5, 5)));
    expect(s.shapes.size).toBe(2);
  });

  it("draw with same id is idempotent", () => {
    let s = initialState();
    s = reduce(s, draw("e1", "u1", 100, dot(0, 0)));
    s = reduce(s, draw("e1", "u1", 100, dot(0, 0)));
    expect(s.shapes.size).toBe(1);
  });
});

describe("reducer: undo", () => {
  it("undo suppresses own draw", () => {
    let s = initialState();
    s = reduce(s, draw("e1", "u1", 100, dot(0, 0)));
    s = reduce(s, undo("e2", "u1", 101, "e1"));
    expect(s.undone.has("e1")).toBe(true);
  });

  it("undo of unknown target still records the intent", () => {
    const s = reduce(
      initialState(),
      undo("e1", "u1", 100, "nonexistent"),
    );
    expect(s.undone.has("nonexistent")).toBe(true);
    expect(s.shapes.size).toBe(0);
  });
});

describe("reducer: clear", () => {
  it("clear tombstones all prior draws", () => {
    let s = initialState();
    s = reduce(s, draw("e1", "u1", 100, dot(0, 0)));
    s = reduce(s, draw("e2", "u1", 101, dot(1, 1)));
    s = reduce(s, clear("e3", "u1", 102));
    expect(s.shapes.size).toBe(0);
    expect(s.clearedAt).toBe(102);
  });

  it("draws after clear are visible", () => {
    let s = initialState();
    s = reduce(s, draw("e1", "u1", 100, dot(0, 0)));
    s = reduce(s, clear("e2", "u1", 101));
    s = reduce(s, draw("e3", "u1", 102, dot(5, 5)));
    expect(s.shapes.size).toBe(1);
    expect(s.shapes.has("e3")).toBe(true);
  });

  it("clear does not affect presence", () => {
    let s = initialState();
    s = reduce(s, join("u1"));
    s = reduce(s, clear("e1", "u1", 100));
    expect(s.presence.has("u1")).toBe(true);
  });
});

describe("reducer: presence", () => {
  it("join adds to presence", () => {
    const s = reduce(initialState(), join("u1"));
    expect(s.presence.has("u1")).toBe(true);
  });

  it("leave removes from presence", () => {
    let s = initialState();
    s = reduce(s, join("u1"));
    s = reduce(s, leave("u1"));
    expect(s.presence.has("u1")).toBe(false);
  });

  it("cursor updates presence position", () => {
    let s = initialState();
    s = reduce(s, join("u1"));
    s = reduce(s, cursor("u1", 5, 7));
    expect(s.presence.get("u1")?.cursor).toEqual({ x: 5, y: 7 });
  });

  it("cursor before join creates presence entry", () => {
    const s = reduce(initialState(), cursor("u1", 3, 4));
    expect(s.presence.has("u1")).toBe(true);
    expect(s.presence.get("u1")?.cursor).toEqual({ x: 3, y: 4 });
  });
});

describe("reducer: history replay", () => {
  it("history folds equivalent to sequential reduces", () => {
    const events: PersistableEvent[] = [
      draw("e1", "u1", 100, dot(0, 0)),
      draw("e2", "u1", 101, dot(1, 1)),
      undo("e3", "u1", 102, "e1"),
    ];
    const foldedViaHistory = reduce(initialState(), {
      type: "history",
      events,
    });
    let foldedManually = initialState();
    for (const e of events) foldedManually = reduce(foldedManually, e);
    expect(foldedViaHistory.shapes.size).toBe(foldedManually.shapes.size);
    expect([...foldedViaHistory.undone]).toEqual([...foldedManually.undone]);
  });
});

describe("reducer: purity", () => {
  it("does not mutate input state on draw", () => {
    const s0 = initialState();
    const shapesBefore = s0.shapes;
    const undoneBefore = s0.undone;
    const presenceBefore = s0.presence;
    reduce(s0, draw("e1", "u1", 100, dot(0, 0)));
    // The original state's collections must not have been mutated.
    expect(shapesBefore.size).toBe(0);
    expect(undoneBefore.size).toBe(0);
    expect(presenceBefore.size).toBe(0);
  });

  it("produces identical output for identical input", () => {
    const a = reduce(initialState(), draw("e1", "u1", 100, dot(0, 0)));
    const b = reduce(initialState(), draw("e1", "u1", 100, dot(0, 0)));
    expect(a.shapes.get("e1")).toEqual(b.shapes.get("e1"));
    expect(a.clearedAt).toBe(b.clearedAt);
  });
});

describe("reducer: chatMessage", () => {
  it("chatMessage adds to messages map", () => {
    const s = reduce(initialState(), chatMessage("m1", "u1", 100, "hey"));
    expect(s.messages.has("m1")).toBe(true);
    const msg = s.messages.get("m1");
    expect(msg?.text).toBe("hey");
    expect(msg?.userId).toBe("u1");
    expect(msg?.ts).toBe(100);
  });

  it("multiple chatMessages preserve insertion order", () => {
    let s = initialState();
    s = reduce(s, chatMessage("m1", "u1", 100, "first"));
    s = reduce(s, chatMessage("m2", "u2", 101, "second"));
    s = reduce(s, chatMessage("m3", "u1", 102, "third"));
    const ids = [...s.messages.keys()];
    expect(ids).toEqual(["m1", "m2", "m3"]);
  });

  it("chatMessage does not mutate input state", () => {
    const s0 = initialState();
    const messagesBefore = s0.messages;
    reduce(s0, chatMessage("m1", "u1", 100, "hi"));
    expect(messagesBefore.size).toBe(0);
  });
});

describe("reducer: read", () => {
  it("read event adds userId to receipts set", () => {
    let s = initialState();
    s = reduce(s, chatMessage("m1", "u1", 100, "hi"));
    s = reduce(s, read("r1", "u2", 101, "m1"));
    const readers = s.readReceipts.get("m1");
    expect(readers).toBeDefined();
    expect(readers?.has("u2")).toBe(true);
  });

  it("multiple readers accumulate on same message", () => {
    let s = initialState();
    s = reduce(s, chatMessage("m1", "u1", 100, "hi"));
    s = reduce(s, read("r1", "u2", 101, "m1"));
    s = reduce(s, read("r2", "u3", 102, "m1"));
    const readers = s.readReceipts.get("m1");
    expect(readers?.size).toBe(2);
    expect(readers?.has("u2")).toBe(true);
    expect(readers?.has("u3")).toBe(true);
  });

  it("read of unknown message still records receipt", () => {
    const s = reduce(
      initialState(),
      read("r1", "u2", 100, "nonexistent"),
    );
    // The reducer accepts the read event even if the message isn't in
    // local state yet — history replay may deliver them out of order.
    expect(s.readReceipts.get("nonexistent")?.has("u2")).toBe(true);
  });

  it("read is idempotent for the same user/message", () => {
    let s = initialState();
    s = reduce(s, chatMessage("m1", "u1", 100, "hi"));
    s = reduce(s, read("r1", "u2", 101, "m1"));
    s = reduce(s, read("r2", "u2", 102, "m1"));
    expect(s.readReceipts.get("m1")?.size).toBe(1);
  });
});

describe("reducer: clear + chat interaction", () => {
  it("clear does not wipe messages", () => {
    let s = initialState();
    s = reduce(s, chatMessage("m1", "u1", 100, "hi"));
    s = reduce(s, draw("e1", "u1", 101, dot(0, 0)));
    s = reduce(s, clear("c1", "u1", 102));
    expect(s.shapes.size).toBe(0);
    expect(s.messages.has("m1")).toBe(true);
  });

  it("clear does not wipe readReceipts", () => {
    let s = initialState();
    s = reduce(s, chatMessage("m1", "u1", 100, "hi"));
    s = reduce(s, read("r1", "u2", 101, "m1"));
    s = reduce(s, clear("c1", "u1", 102));
    expect(s.readReceipts.get("m1")?.has("u2")).toBe(true);
  });
});
