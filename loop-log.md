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

## 2026-07-01 — M3 inline (self-paced /loop, 2 turns)

- Turn 1: implemented Room + RoomRegistry, Store (mongodb driver, upsertCanvas
  with $set/$setOnInsert, loadHistory sorted by ts, findEventById scoped to
  canvasId, strips mongo _id on read), handlers.ts (ClientMessageSchema
  validation, close(1003) on parse fail, undo ownership check via
  findEventById + type:"error" code:"undo_forbidden" to sender only, cursor
  case broadcasts without appendEvent), index.ts bootstrap with WS
  query-string session extraction. Verifier: RED — 1 test failed. "cursor
  broadcast but not persisted" timed out; B was still in mongo round-trip
  when A sent cursor, so B wasn't in the room yet.

- Turn 2: reordered handleConnect — room.add(ws) + broadcast(join) now
  happen synchronously before any await. Rationale: room membership
  shouldn't wait on mongo. The M2 reducer is idempotent on persisted
  events (Map.set keyed by id, Set.add for undone) so live events
  arriving before history are safe. Verifier: GREEN (45/45).

## 2026-07-01 — M4 inline (self-paced /loop, 1 turn)

- Turn 1: implemented input.ts (vim-style state machine, 1234 for modes,
  hjkl movement, HJKL x5, two-anchor state for circle/line/square, u/x/q/
  space/escape actions, clamps cursor to viewport). rendering.ts with pure
  rasterizers: dot (•), midpoint-circle (o), square outline with box chars
  (┌┐└┘─│) + degenerate 1D/point cases, Bresenham line (chars picked by
  slope: ━ │ ╱ ╲). composeGrid overlays visible shapes, skipping undone
  ids and off-viewport cells. Ink app.tsx wires WsClient + reducer +
  input state machine via useInput; canvas.tsx overlays own cursor as +
  and remote cursors as colored ▓; statusbar.tsx shows canvasId, mode,
  cursor, online count, ws status. cli.ts parses argv, loads identity,
  renders <App/>. Verifier: GREEN (59/59).
