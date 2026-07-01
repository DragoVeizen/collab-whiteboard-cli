// Load/create the local user identity cached at ~/.whiteboard/identity.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type Identity = { userId: string; name: string };

const CONFIG_DIR = join(homedir(), ".whiteboard");
const CONFIG_FILE = join(CONFIG_DIR, "identity.json");

export function loadOrCreateIdentity(defaultName?: string): Identity {
  if (existsSync(CONFIG_FILE)) {
    try {
      const raw = readFileSync(CONFIG_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<Identity>;
      if (parsed.userId && parsed.name) {
        return { userId: parsed.userId, name: parsed.name };
      }
    } catch {
      // fall through to create a new identity
    }
  }
  const identity: Identity = {
    userId: randomUUID(),
    name: defaultName ?? `user-${Math.floor(Math.random() * 10_000)}`,
  };
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(identity, null, 2));
  return identity;
}
