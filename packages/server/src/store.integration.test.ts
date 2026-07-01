import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { Store, type PersistableEvent } from "./store.js";

let mongod: MongoMemoryServer;
let store: Store;
let cleanupClient: MongoClient;

const TEST_DB = "whiteboard_test_store";

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const url = mongod.getUri();
  store = new Store(url, TEST_DB);
  await store.connect();
  cleanupClient = new MongoClient(url);
  await cleanupClient.connect();
}, 90_000);

afterAll(async () => {
  await store.close();
  await cleanupClient.close();
  await mongod.stop();
});

beforeEach(async () => {
  const db = cleanupClient.db(TEST_DB);
  await db.collection("events").deleteMany({});
  await db.collection("canvases").deleteMany({});
});

const drawEvent = (
  id: string,
  canvasId: string,
  ts: number,
  userId = "u1",
): PersistableEvent => ({
  type: "draw",
  id,
  canvasId,
  userId,
  ts,
  shape: { kind: "dot", at: { x: 1, y: 1 } },
});

describe("Store persistence", () => {
  it("appendEvent persists a draw event", async () => {
    await store.appendEvent(drawEvent("e1", "c1", 100));
    const history = await store.loadHistory("c1");
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe("e1");
  });

  it("loadHistory returns events in ts order", async () => {
    await store.appendEvent(drawEvent("e2", "c1", 200));
    await store.appendEvent(drawEvent("e1", "c1", 100));
    await store.appendEvent(drawEvent("e3", "c1", 300));
    const history = await store.loadHistory("c1");
    expect(history.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("loadHistory filters by canvasId", async () => {
    await store.appendEvent(drawEvent("e1", "cx", 100));
    await store.appendEvent(drawEvent("e2", "cy", 200));
    const history = await store.loadHistory("cx");
    expect(history).toHaveLength(1);
    expect(history[0]?.canvasId).toBe("cx");
  });

  it("upsertCanvas creates and updates metadata", async () => {
    await store.upsertCanvas("c1", 100);
    await store.upsertCanvas("c1", 200);
    const db = cleanupClient.db(TEST_DB);
    const doc = await db.collection("canvases").findOne({ _id: "c1" as unknown as never });
    expect(doc).not.toBeNull();
    expect(doc?.createdAt).toBe(100);
    expect(doc?.lastActivityAt).toBe(200);
  });

  it("findEventById returns the event when it exists", async () => {
    await store.appendEvent(drawEvent("e1", "c1", 100));
    const found = await store.findEventById("c1", "e1");
    expect(found).not.toBeNull();
    expect(found?.id).toBe("e1");
  });

  it("findEventById returns null when missing", async () => {
    const found = await store.findEventById("c1", "nonexistent");
    expect(found).toBeNull();
  });

  it("findEventById scopes to canvasId", async () => {
    await store.appendEvent(drawEvent("e1", "cx", 100));
    const found = await store.findEventById("cy", "e1");
    expect(found).toBeNull();
  });
});
