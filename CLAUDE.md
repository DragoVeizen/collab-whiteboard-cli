# whiteboard — build notes for future agent turns

Collaborative whiteboard delivered as a CLI. Two clients + one WS server + Mongo.
Full design: `docs/superpowers/specs/2026-07-01-collab-whiteboard-cli-design.md`.
Milestone contract: `loop-brief.md` (read it every turn).

## Stack (do not add to)
- **Runtime**: Node 22.x, pnpm workspaces
- **Language**: TypeScript (strict)
- **Client TUI**: `ink` (React-for-CLI) + `ink-testing-library` for headless input tests
- **WS**: `ws` (server), `ws` (client)
- **DB**: `mongodb` driver, Mongo 7 via docker-compose
- **Validation**: `zod`
- **Tests**: `vitest`
- **Types**: `uuid`

Do NOT introduce: Yjs / Automerge / any CRDT lib, Redis / NATS / any broker,
Express / Nest / any HTTP framework, ORMs (use the mongo driver directly),
optimistic UI, delta reconnect, TUI snapshot tests, mocks of Mongo in
persistence tests.

## Commands
- `pnpm install` — install workspace deps
- `pnpm -r typecheck` — TS check every package
- `pnpm -r test` — vitest in every package
- `pnpm -r build` — tsc build every package
- `docker compose up -d mongo` — start Mongo 7 on `localhost:27017`
- `pnpm --filter server dev` — run server in watch mode
- `pnpm --filter client dev -- <canvasId>` — launch a client

## Load-bearing rules
- **Server is dumb, clients are smart.** Server never interprets shapes;
  it stamps `ts`, persists, broadcasts.
- **`state.ts` is a pure reducer.** No IO. Same code runs over history and live.
- **Client sends `ClientMessage`, server broadcasts `ServerEvent`** — two
  separate zod schemas in `packages/shared`.
- **Full-history replay on reconnect.** No delta sync. Correctness > perf in v1.
- **Mongo insert order IS the total order.** Don't invent client-side ordering.

## Testing stance
- Reducer & schema: unit tests, comprehensive.
- Server broadcast + Mongo persistence: one real integration test each,
  hitting real WS + real Mongo (docker). No mocks of the thing under test.
- TUI rendering: skip snapshot tests. Test input state machine directly.
