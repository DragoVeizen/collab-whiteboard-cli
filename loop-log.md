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
