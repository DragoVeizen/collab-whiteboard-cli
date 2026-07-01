import { MongoClient, type Collection, type Db } from "mongodb";
import type { PersistableEvent } from "@whiteboard/shared";

export type { PersistableEvent };

type CanvasDoc = {
  _id: string;
  createdAt: number;
  lastActivityAt: number;
};

export class Store {
  private client: MongoClient;
  private db: Db | null = null;
  private events: Collection<PersistableEvent> | null = null;
  private canvases: Collection<CanvasDoc> | null = null;

  constructor(
    private readonly url: string,
    private readonly dbName: string,
  ) {
    this.client = new MongoClient(url);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.events = this.db.collection<PersistableEvent>("events");
    this.canvases = this.db.collection<CanvasDoc>("chats");
    await this.events.createIndex({ chatId: 1, ts: 1 });
  }

  async close(): Promise<void> {
    await this.client.close();
    this.db = null;
    this.events = null;
    this.canvases = null;
  }

  private requireEvents(): Collection<PersistableEvent> {
    if (!this.events) throw new Error("Store not connected");
    return this.events;
  }

  private requireCanvases(): Collection<CanvasDoc> {
    if (!this.canvases) throw new Error("Store not connected");
    return this.canvases;
  }

  async upsertChat(chatId: string, now: number): Promise<void> {
    await this.requireCanvases().updateOne(
      { _id: chatId },
      {
        $set: { lastActivityAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  async appendEvent(event: PersistableEvent): Promise<void> {
    await this.requireEvents().insertOne(event);
  }

  async loadHistory(chatId: string): Promise<PersistableEvent[]> {
    const docs = await this.requireEvents()
      .find({ chatId })
      .sort({ ts: 1 })
      .toArray();
    // strip the mongo-generated _id — clients only receive the wire shape.
    return docs.map(({ _id, ...rest }) => rest) as PersistableEvent[];
  }

  async findEventById(
    chatId: string,
    id: string,
  ): Promise<PersistableEvent | null> {
    const doc = await this.requireEvents().findOne({ chatId, id });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest as PersistableEvent;
  }
}
