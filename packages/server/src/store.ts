// M3 stub: interfaces are real. Impl throws — the M3 loop fills these in.

import type { PersistableEvent } from "@whiteboard/shared";

// Re-export for consumers importing from server package.
export type { PersistableEvent };

export type CanvasMeta = {
  _id: string;
  createdAt: number;
  lastActivityAt: number;
};

export class Store {
  constructor(
    private readonly url: string,
    private readonly dbName: string,
  ) {
    void this.url;
    void this.dbName;
  }

  async connect(): Promise<void> {
    throw new Error("M3 not implemented: Store.connect");
  }

  async close(): Promise<void> {
    throw new Error("M3 not implemented: Store.close");
  }

  async upsertCanvas(_canvasId: string, _now: number): Promise<void> {
    throw new Error("M3 not implemented: Store.upsertCanvas");
  }

  async appendEvent(_event: PersistableEvent): Promise<void> {
    throw new Error("M3 not implemented: Store.appendEvent");
  }

  async loadHistory(_canvasId: string): Promise<PersistableEvent[]> {
    throw new Error("M3 not implemented: Store.loadHistory");
  }

  async findEventById(
    _canvasId: string,
    _id: string,
  ): Promise<PersistableEvent | null> {
    throw new Error("M3 not implemented: Store.findEventById");
  }
}
