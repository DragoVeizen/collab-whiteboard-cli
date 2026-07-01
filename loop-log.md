# loop-log

## 2026-07-01 — M1 inline (no loop harness)

Scaffolded pnpm workspace + 3 packages + docker-compose + canary tests.

- Turn 1: wrote pnpm-workspace.yaml, root package.json, tsconfig.base.json,
  docker-compose.yml (mongo:7 on 27017), .nvmrc (22).
  Wrote 3 packages (shared/server/client) each with:
    package.json (vitest + typescript deps, typecheck/test/build scripts),
    tsconfig.json extending base,
    src/index.ts (real primitive: makeCoord, envOrDefault, clampCoord),
    src/index.test.ts (real assertions, not tautologies).
  Ran pnpm install (47 packages, 15.7s).
  Verifier: RED — pnpm -r typecheck failed (rootDir in base tsconfig
  resolved relative to base dir, not extending package dir).

- Turn 2: moved rootDir/outDir out of tsconfig.base.json into each
  package's tsconfig.json.
  Verifier: GREEN (24/24 checks pass).

Next: M2 — shared events.ts (Event/Shape types + zod schemas +
ClientMessage/ServerEvent split) and client state.ts reducer with
≥15 unit tests. To be driven via /loop.

## 2026-07-01 — M2 inline (self-paced /loop, 1 turn)

- Turn 1: implemented ClientMessageSchema (discriminatedUnion of draw/undo/
  clear/cursor, all .strict() to reject unknown fields), Shape schema
  (discriminatedUnion of dot/circle/square/line), ServerEventSchema
  (all 8 variants with server-authoritative fields; z.lazy on the
  outer schema so history's recursive events array resolves).
  Implemented reduce() as a pure switch on event.type — draw sets by
  event.id (Map.set makes same-id idempotent), undo adds targetId to a
  new Set, clear wipes shapes+undone and stamps clearedAt (leaving
  presence untouched), cursor/join/leave return a fresh presence Map,
  history uses Array.reduce(reduce, state) so history is exactly a
  sequential fold. No Map/Set is mutated in-place — every case creates
  new instances.
  Verifier: GREEN (37 checks pass).
