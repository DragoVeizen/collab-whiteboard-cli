import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { loadOrCreateIdentity } from "./identity.js";

function parseArgs(argv: string[]): { chatId: string; name?: string } {
  const args = argv.slice(2);
  let chatId = "";
  let name: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    // Skip the "--" separator pnpm passes through for arg forwarding.
    if (a === "--") continue;
    if (a === "--name") {
      name = args[++i];
    } else if (!chatId) {
      chatId = a;
    }
  }
  return { chatId, name };
}

async function main(): Promise<void> {
  const { chatId, name } = parseArgs(process.argv);
  if (!chatId) {
    console.error("usage: whiteboard <chatId> [--name <name>]");
    process.exit(1);
  }
  const identity = loadOrCreateIdentity(name);
  const wsUrl = process.env.WS_URL ?? "ws://localhost:8787";
  render(
    React.createElement(App, {
      chatId,
      userId: identity.userId,
      userName: identity.name,
      wsUrl,
    }),
  );
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
