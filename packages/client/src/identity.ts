// Load or create a per-name identity cached at ~/.whiteboard/identity-<name>.json.
// Storing one file per name means `--name Vansh` and `--name Riya` on the same
// machine get distinct userIds — otherwise both windows would collide on the
// single default identity and every message would look like "self".

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type Identity = { userId: string; name: string };

const CONFIG_DIR = join(homedir(), ".whiteboard");

function fileFor(name: string): string {
  // Sanitize name to filesystem-safe chars.
  const safe = name.replace(/[^A-Za-z0-9_-]/g, "_");
  return join(CONFIG_DIR, `identity-${safe}.json`);
}

export function loadOrCreateIdentity(defaultName?: string): Identity {
  const name = defaultName ?? `user-${Math.floor(Math.random() * 10_000)}`;
  const file = fileFor(name);

  if (existsSync(file)) {
    try {
      const raw = readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as Partial<Identity>;
      if (parsed.userId && parsed.name === name) {
        return { userId: parsed.userId, name };
      }
    } catch {
      // fall through — regenerate
    }
  }

  const identity: Identity = { userId: randomUUID(), name };
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(identity, null, 2));
  return identity;
}
