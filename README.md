# collab-whiteboard-cli

A collaborative whiteboard that runs in your terminal. Two clients, one WebSocket server, one MongoDB event log, four shapes. Built to feel out what a realtime collaborative editor actually looks like at the primitive layer — before you reach for CRDTs.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│    ┌────────┐                                                │
│    │        │       ooo                                      │
│    │  █     │      o   o                                     │
│    │        │      o   o                                     │
│    └────────┘       ooo                                      │
│                                                              │
│                              R━━━━━━━━━━━━━━━━━━━━━━━━━━━●   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
canvas: sprint-planning · ws: open · mode: CIRCLE · cursor: (14, 3)
█ you · R Riya
[1]dot [2]circle [3]line [4]square · hjkl move · HJKL x5 · space place/anchor · esc cancel · u undo · x clear · q quit
```

Your cursor is a yellow block. Other users show up as the first letter of their name in a per-user color. Shapes render in the color of whoever drew them.

## Why

The point wasn't shipping a whiteboard — it was learning how realtime collab actually works when you build it yourself. Everything here is the simplest correct version of one concept:

- **Sync via an append-only event log**, not shared mutable state. Every draw / undo / clear is an event; every client is a pure reducer over the same ordered stream.
- **Server-authoritative total order**, not client-side merge logic. Mongo's insert order *is* the truth. Two clients drawing at the same instant get distinct timestamps assigned server-side; everyone sees the same order.
- **Full-history replay on reconnect**, not delta sync. Slower but reveals reducer bugs immediately instead of silently drifting.
- **No optimistic UI, no CRDTs.** Both fit *after* you understand the primitives. Not before.

## Architecture

```
┌──────────────────┐     WS      ┌──────────────────┐     ┌──────────────────┐
│  CLI client A    │ ─────────▶  │   WS server      │ ──▶ │     MongoDB      │
│  (Ink TUI)       │ ◀─────────  │   (Node + ws)    │ ◀── │ events, canvases │
└──────────────────┘             └──────────────────┘     └──────────────────┘
        ▲                                ▲
        │                                │
┌──────────────────┐                     │
│  CLI client B    │ ────────────────────┘
└──────────────────┘
```

Three processes, one job each:

- **CLI client** — Ink TUI. Owns local canvas state (result of applying events through a pure reducer) and the input state machine (vim-style). Sends events, receives events, re-renders.
- **WS server** — Single Node process. Owns *no* canvas state. Pure broadcast + persistence: on connect, streams the canvas's event log; on message, validates against a zod schema, stamps `ts` + `userId`, persists to Mongo, broadcasts to the room.
- **MongoDB** — Append-only `events` collection keyed by `canvasId` (`{ canvasId: 1, ts: 1 }` index), plus a `canvases` collection for lightweight metadata.

Key principle: **server is dumb, clients are smart**. The server never interprets shapes. Every client builds the same canvas by replaying the same ordered events.

## Quickstart

Requires **Node 22** (`.nvmrc`) and **pnpm 10**. The dev flow uses `mongodb-memory-server` (an in-process real mongod, same wire protocol as docker mongo) so you don't need the Docker daemon locally.

```bash
git clone https://github.com/DragoVeizen/collab-whiteboard-cli.git
cd collab-whiteboard-cli
pnpm install

# Terminal 1 — mongo
pnpm --filter server dev-mongo

# Terminal 2 — server
pnpm --filter server dev

# Terminal 3 — client A
pnpm --filter client dev -- sprint-planning --name Vansh

# Terminal 4 — client B (same canvas name, different person)
pnpm --filter client dev -- sprint-planning --name Riya
```

Two clients on the same canvas see each other's cursors and shapes in real time.

## Controls

| Key            | Action                                                 |
|:---------------|:-------------------------------------------------------|
| `1` `2` `3` `4`| Set shape mode: dot / circle / line / square           |
| `h` `j` `k` `l`| Move cursor by 1 (left / down / up / right)            |
| `H` `J` `K` `L`| Move cursor by 5                                       |
| Arrows         | Move cursor by 1                                       |
| `space`        | In dot mode: place. In circle/line/square: set anchor, then commit |
| `esc`          | Cancel pending anchor                                  |
| `u`            | Undo your last shape (server rejects cross-user undos) |
| `x`            | Clear canvas                                           |
| `q`            | Quit                                                   |

Two-anchor shapes (circle, line, square) show a dim outline as you move — a "ghost preview" of what you're about to draw.

## Testing

```bash
pnpm -r typecheck       # every package
pnpm -r test            # every package
```

Coverage:

- **`packages/shared`** — 20 tests on the wire format (zod schemas round-trip every message variant, reject unknown types, reject client-forged `ts` fields).
- **`packages/client`** — 63 tests: 15+ reducer invariants (idempotent draws, undo suppression, clear tombstoning, history-fold symmetry, no mutation of input state), 18 rasterizer tests (Bresenham lines, midpoint circles, square outlines, empty-grid base case), 29 input state machine tests (every key, cursor clamping, two-anchor state transitions, purity).
- **`packages/server`** — 26 tests: Room broadcast unit tests + integration tests that spin real `WebSocket` clients against a real in-process `mongod` and cover 2-client fanout, sender echo, history replay on connect, cursor broadcast-not-persisted, unknown-message-closes-socket, cross-user undo rejection, and server-stamped `ts`.

End-to-end smoke:

```bash
pnpm --filter server dev-mongo &          # in one terminal
pnpm --filter server dev &                # in another
pnpm --filter server exec tsx ../../scripts/smoke-e2e.ts   # from repo root
```

Drives two real WebSocket clients against the running stack and verifies every wire-level invariant. 11/11.

## How the sync works, briefly

Every persisted event has the shape:

```ts
{ type: "draw" | "undo" | "clear",
  id: string,        // client-generated uuid
  canvasId: string,  // server-attached from ws query string
  userId: string,    // server-attached from ws query string
  ts: number,        // server-stamped at insert
  ...variant-specific fields
}
```

The client sends a subset (no `ts`, no `canvasId`, no `userId` — those are server-authoritative). On receipt, the server validates against `ClientMessageSchema`, closes the socket 1003 if malformed, then transforms into a `ServerEvent`, appends to Mongo, and broadcasts to the room (including the sender). The client's pure reducer folds each event into `CanvasState`.

Cursor events are broadcast but *never* persisted — they're ephemeral presence signals.

Reconnect does a full history replay every time. Yes, that's slower than delta sync. It also makes reducer bugs impossible to hide: if your local state ever drifts from the canonical reduction of the log, the next reconnect fixes it.

## Repo layout

```
├── docs/superpowers/specs/    # the design spec
├── loop-brief.md              # the milestone contract used during the build
├── loop-log.md                # what each milestone-loop actually did
├── scripts/
│   ├── verify-m1.sh           # each milestone had a scaffolded acceptance test
│   ├── verify-m2.sh
│   ├── verify-m3.sh
│   ├── verify-m4.sh
│   └── smoke-e2e.ts           # M5 end-to-end smoke
├── packages/
│   ├── shared/                # wire format + zod schemas (@whiteboard/shared)
│   ├── server/                # ws server, room, mongo store, handlers
│   └── client/                # Ink TUI, rendering, input, ws client, cli
└── docker-compose.yml         # mongo:7 for non-dev use
```

## How it was built

Five milestones, each with a failing-test-first "verifier" that had to go green before the milestone was tagged:

| Tag                  | What it covers                                                                 |
|:---------------------|:-------------------------------------------------------------------------------|
| `m1-scaffold`        | pnpm workspace, tsconfigs, docker compose, canary tests                        |
| `m2-shared-reducer`  | wire format + zod schemas, pure reducer                                        |
| `m3-server`          | WS server, Room, Mongo store, connect / message / disconnect handlers          |
| `m4-client`          | Ink TUI, rasterizers, vim-style input state machine, ws client                 |
| `m5-e2e`             | ghost preview, in-process mongo helper, headless end-to-end smoke              |

Each verifier grepped for banned patterns — no `@ts-ignore`, no `vi.mock` of the thing under test, no `it.skip`, no trivial `expect(true).toBe(true)` — and required specific named tests to exist. The verifier was the load-bearing part; once it was in place, the impl was straightforward.

## Non-goals

These are intentionally not built. They're each interesting problems, but adding them before understanding the primitives would obscure what the log-based sync actually gives you.

- Auth / private canvases
- Shape selection / move / resize / delete-by-pick after placement
- Variable canvas size — the viewport is fixed 60×20
- Multi-server / horizontal scale (pub/sub over a broker)
- Web client — CLI only, no browser render
- Conflict resolution beyond "server timestamp wins" (no CRDTs, no OT)
- Optimistic UI (client waits for server echo before applying)
- Persistence of cursor presence

The last one is the real design point. Cursor events fan out but never touch Mongo — presence is state that only makes sense while someone is connected.

## License

MIT.
