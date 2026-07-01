# loop-brief.md — collaborative whiteboard CLI build

Full contract for the loop. Read this every turn before doing anything.
Spec: `docs/superpowers/specs/2026-07-01-collab-whiteboard-cli-design.md`.
Durable stack + rules: `CLAUDE.md`.

---

## 1. Architecture foundations

**Where the work fits.** Empty repo — this loop defines the layout. Target
structure per spec §3: pnpm monorepo with `packages/shared`, `packages/server`,
`packages/client`. No other layout is acceptable.

**Patterns to follow.** None to mirror (fresh repo). Once code exists, later
milestones must mirror the shape of earlier milestones (naming, error handling,
zod schema style, test file location `*.test.ts` beside source).

**Stack & deps.** See `CLAUDE.md` "Stack (do not add to)". Introducing a
banned dep is grounds to abort the turn.

**Interfaces & contracts.** The wire format is the contract:
- `ClientMessage` union — inbound to server, no `ts`, no `canvasId`, no `userId`
- `ServerEvent` union — outbound from server, `ts` server-stamped
Both live in `packages/shared/src/events.ts`, exported with matching zod
schemas. Client and server both import from `@whiteboard/shared` — no
duplication.

**Data / source of truth.** MongoDB. `events` collection is the append-only
log; `canvases` collection is metadata only. Mongo insert order = total
order for a given `canvasId`.

**Non-negotiables.**
- Server is dumb, clients smart (server never interprets shapes).
- `state.ts` is a pure reducer — `(state, event) => state`, no IO.
- Full-history replay on reconnect. No delta sync.
- Server-authoritative `ts` and `userId` on persisted events.
- No CRDTs. No pub/sub. No optimistic UI.

**Avoid.**
- Mocking Mongo in the persistence test.
- Adding a "cursor" event to Mongo (presence is ephemeral).
- Rendering ghost previews via WS broadcast (they're local-only).
- Extending the Event union beyond spec §4 without user approval.

**Ownership & escalation.** Solo build, owner = user (Vansh). Escalation =
stop the loop, ask.

**Downstream / integration surface.** None yet. This is v1 from scratch.

---

## 2. Contract

**Intent.** Build a runnable v1 that matches the spec — two clients + one
server + Mongo, four shapes drawable, presence cursors, undo/clear,
reconnect-with-replay. Goal is to *feel out* how a collab editor's event-log
sync model works locally, not ship product.

**Scope.** Spec §§ 1–8.

**Out of scope / non-goals.** Spec §9 in full. Do not build any of it.

**Plan — 5 milestones, ordered:**

| # | Milestone | Verifier |
|---|---|---|
| **M1** | Scaffold: pnpm workspace, tsconfig, docker-compose, vitest wiring, canary tests | `scripts/verify-m1.sh` |
| **M2** | `packages/shared` — Event/Shape types, zod schemas, `ClientMessage`/`ServerEvent` split; `packages/client/src/state.ts` reducer + ≥15 unit tests | `pnpm --filter shared test && pnpm --filter client test -- state.test.ts` |
| **M3** | `packages/server` — WS server, `Room`, `store.ts` Mongo layer, connect/replay/broadcast handlers; WS integration test + real-Mongo persistence test | `pnpm --filter server test` (hits real Mongo via docker) |
| **M4** | `packages/client` — Ink app, canvas render, vim-style input state machine, ws client with reconnect+full-replay; `input.ts` unit tests via `ink-testing-library` | `pnpm --filter client test` |
| **M5** | End-to-end smoke: two clients + server + Mongo, script drives draws from A, asserts B's reduced state matches; reconnect A mid-session, assert replay | `scripts/smoke-e2e.sh` |

Each milestone is its own loop. **Do not proceed past a milestone's verifier
without user review.**

**State & evidence.** Working tree is the state. A short append-only
`loop-log.md` (loop writes one line per turn: what changed, verifier result,
next step). PR-worthy diffs at each milestone's end.

**Guardrails.**
- Loop may touch: everything under `/Users/mac/whiteboard/`.
- Loop may NOT touch: anything outside that directory.
- Loop may run: `pnpm`, `docker compose`, `git` (add/commit on `main`
  only — no force-push, no branch surgery).
- On ambiguity: **stop and ask.** Do not guess architectural intent.
- Destructive ops (`git reset --hard`, dropping mongo collections outside
  the test lifecycle, deleting files it didn't create) → stop and ask.

---

## 3. Verifier stack

**Per-milestone verifier.** See table in §2. Each is a real command that
exits non-zero on failure. **Never claim a milestone done without running
its verifier and pasting its output into `loop-log.md`.**

**Anti-goal catalog — how the loop could cheat, and the guard for each:**

| Cheat | Guard |
|---|---|
| Skip real tests, write scaffolds only | Each milestone verifier greps for a minimum test count / required test names |
| Write reducer tests *after* impl, shape them to fit impl bugs | Spec §4 pre-defines the invariants; verifier asserts specific named tests exist (e.g. `undo suppresses own draw`, `clear tombstones prior events`) |
| Mock Mongo in the persistence test | Verifier fails if `mongodb` is imported with a mock; persistence test file is grepped for `vi.mock` and rejected |
| Mock the WS transport in the broadcast test | Same — server integration test must open a real `ws://` connection |
| Introduce a banned dep (Yjs, Redis, HTTP framework) | Verifier greps `package.json` files against the banned list |
| Silence type errors with `// @ts-ignore` / `any` | Verifier greps for `@ts-ignore` / `@ts-expect-error` and fails if count grew |
| Bypass zod with `as any` casts on parsed messages | Verifier greps for suspicious casts in `server/handlers.ts` |
| `it.skip` a hard test | Verifier greps for `.skip(` in test files and fails if present |
| Extend the Event union quietly | Verifier snapshots the exported type names from `shared/src/events.ts` and fails on drift beyond an approved list |

**Pre-flight (M1).** Before running the loop for M1: run
`scripts/verify-m1.sh` from a repo that has *nothing scaffolded*. Confirm it
exits non-zero and the failure message names the correct missing piece
(e.g. "packages/shared/package.json not found"). That proves the verifier
runs and fails for the right reason. Log the pre-flight output in the
initial `loop-log.md` entry.

---

## 4. Safe, reversible, observable

**Isolate.** Loop commits on `main` (fresh repo, no other work). Rollback = `git
reset --hard <milestone-tag>` where each milestone ends with an annotated
tag: `m1-scaffold`, `m2-shared-reducer`, `m3-server`, `m4-client`, `m5-e2e`.

**Budget & stop.**
- **Per-milestone turn budget:** 8 turns. If the verifier hasn't gone
  green in 8 turns → stop, escalate.
- **Stop on green** — milestone verifier passes → tag, commit, hand back
  to user.
- **Pause on missing context** — any spec ambiguity → stop, ask.
- **Abort on no progress** — if the same verifier failure repeats for 3
  turns → stop, escalate.
- **Abort on banned dep** — any Yjs / Redis / HTTP framework / CRDT lib
  installed → stop, rollback.

**Loop health.**
- `loop-log.md` — the loop appends one dated entry per turn: "M{n} turn {k}:
  changed X, verifier result Y, next Z".
- Stuck-detector — before starting a turn, read the last 3 log entries.
  If verifier output is identical → stop, escalate.

---

## 5. Milestone-by-milestone kickoff

The loop is driven with a `/goal` per milestone. The user runs the goal,
loop executes until verifier is green, user reviews the diff, tags the
milestone, then runs the next `/goal`.

**M1 goal (start here):**

```
/goal "M1 done when scripts/verify-m1.sh exits 0. It requires:
       pnpm-workspace.yaml with the 3 packages listed,
       root tsconfig.base.json (strict),
       package.json in each of packages/{shared,server,client} with
         vitest + typescript dev deps,
       docker-compose.yml with a mongo:7 service on 27017,
       one canary vitest per package that makes a non-trivial assertion,
       pnpm-lock.yaml checked in,
       pnpm -r typecheck exits 0,
       pnpm -r test exits 0.
       Read loop-brief.md and CLAUDE.md before starting. Append one line
       to loop-log.md per turn. Do not introduce any banned dep."
```

The subsequent M2–M5 goals will be written after the user reviews each prior
milestone's diff.
