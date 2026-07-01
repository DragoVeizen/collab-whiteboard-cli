import { describe, it, expect } from "vitest";
import type { WebSocket } from "ws";
import { Room, RoomRegistry } from "./room.js";
import type { ServerEvent } from "@whiteboard/shared";

// A minimal WebSocket-shaped test double. Not a mock of the ws lib —
// just a concrete class that satisfies the tiny surface Room needs.
class FakeSocket {
  sent: string[] = [];
  readyState = 1; // WebSocket.OPEN
  send(msg: string): void {
    this.sent.push(msg);
  }
}

const asWs = (s: FakeSocket): WebSocket => s as unknown as WebSocket;

const joinEvent = (userId: string): ServerEvent => ({
  type: "join",
  canvasId: "c1",
  userId,
  userName: userId,
});

describe("Room", () => {
  it("broadcast sends message to all connected sockets", () => {
    const room = new Room();
    const a = new FakeSocket();
    const b = new FakeSocket();
    room.add(asWs(a));
    room.add(asWs(b));
    room.broadcast(joinEvent("u1"));
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    const parsedA = JSON.parse(a.sent[0]!);
    expect(parsedA.type).toBe("join");
    expect(parsedA.userId).toBe("u1");
  });

  it("broadcast with except skips the excluded socket", () => {
    const room = new Room();
    const a = new FakeSocket();
    const b = new FakeSocket();
    room.add(asWs(a));
    room.add(asWs(b));
    room.broadcast(joinEvent("u1"), { except: asWs(a) });
    expect(a.sent).toHaveLength(0);
    expect(b.sent).toHaveLength(1);
  });

  it("remove takes a socket out of broadcast", () => {
    const room = new Room();
    const a = new FakeSocket();
    const b = new FakeSocket();
    room.add(asWs(a));
    room.add(asWs(b));
    room.remove(asWs(a));
    room.broadcast(joinEvent("u1"));
    expect(a.sent).toHaveLength(0);
    expect(b.sent).toHaveLength(1);
  });

  it("does not send to sockets in non-OPEN state", () => {
    const room = new Room();
    const closed = new FakeSocket();
    closed.readyState = 3; // CLOSED
    const open = new FakeSocket();
    room.add(asWs(closed));
    room.add(asWs(open));
    room.broadcast(joinEvent("u1"));
    expect(closed.sent).toHaveLength(0);
    expect(open.sent).toHaveLength(1);
  });
});

describe("RoomRegistry", () => {
  it("returns the same Room for the same canvasId", () => {
    const reg = new RoomRegistry();
    const r1 = reg.get("c1");
    const r2 = reg.get("c1");
    expect(r1).toBe(r2);
  });

  it("returns distinct Rooms for different canvasIds", () => {
    const reg = new RoomRegistry();
    const r1 = reg.get("c1");
    const r2 = reg.get("c2");
    expect(r1).not.toBe(r2);
  });

  it("removeIfEmpty drops the room only when size is zero", () => {
    const reg = new RoomRegistry();
    const r = reg.get("c1");
    r.add(asWs(new FakeSocket()));
    reg.removeIfEmpty("c1");
    // Room should still be here since it has a member.
    expect(reg.get("c1")).toBe(r);
    r.remove([...(r as unknown as { sockets: Set<WebSocket> }).sockets][0]!);
    reg.removeIfEmpty("c1");
    // After removal, a fresh get should return a new Room.
    expect(reg.get("c1")).not.toBe(r);
  });
});
