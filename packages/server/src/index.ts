export function envOrDefault(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw !== undefined && raw.length > 0 ? raw : fallback;
}

export const DEFAULT_WS_PORT = 8787;
