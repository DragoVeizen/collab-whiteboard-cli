// M3 stub: server bootstrap. Impl throws — the M3 loop wires it up.

export function envOrDefault(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw !== undefined && raw.length > 0 ? raw : fallback;
}

export const DEFAULT_WS_PORT = 8787;

async function main(): Promise<void> {
  throw new Error("M3 not implemented: server bootstrap");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("fatal:", err);
    process.exit(1);
  });
}
