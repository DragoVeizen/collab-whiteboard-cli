# Collaborative Whiteboard CLI — Design

**Date:** 2026-07-01
**Author:** Vansh Thakur
**Status:** Approved (pending spec self-review and user re-review)

## 1. Goal

Build a local, multi-client collaborative whiteboard delivered as a CLI. The point is to learn how a realtime collaborative editor behaves: shared state, event ordering, presence, reconnection. Scope is intentionally tiny — four shapes, single server, no auth — so the interesting work is the sync model, not the feature set.

A user runs `whiteboard <canvasId>`, joins the canvas, sees other connected users' cursors and drawings live, and can place dots, circles, lines, and squares with a vim-style cursor.

## 2. Architecture

Three processes, three responsibilities.

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

- **CLI client** — Ink TUI. Owns local canvas state and cursor. Sends events, receives events, re-renders.
- **WS server** — single Node process. Owns no canvas state. Pure broadcast + persistence layer. On connect, streams the canvas's event log from Mongo, then forwards live events.
- **MongoDB** — append-only `events` collection keyed by `canvasId`, plus a `canvases` collection for metadata.

**Key principle: server is dumb, clients are smart.** The server never interprets shapes — it orders, persists, broadcasts. Every client builds the same canvas by replaying the same ordered events.

**Canvas lifecycle:** launching with a `canvasId` that doesn't exist creates it (upsert). Existing one → join.

**Why no pub/sub?** All sockets for a canvas live in one process, in one `Set`. Broadcast is iteration. Pub/sub becomes necessary only if we scale to multiple WS server instances or decouple write from broadcast — explicitly out of scope.

## 3. File Layout

```
whiteboard/
├── package.json
├── tsconfig.json
├── docker-compose.yml          # mongo for local dev
├── packages/
│   ├── shared/                 # types shared by client + server
│   │   └── src/events.ts       # Event union, Shape types, wire schema
│   ├── server/
│   │   └── src/
│   │       ├── index.ts        # ws server bootstrap
│   │       ├── room.ts         # per-canvas connection set + broadcast
│   │       ├── store.ts        # mongo: append event, load history
│   │       └── handlers.ts     # on-connect (replay), on-message (persist+fanout)
│   └── client/
│       └── src/
│           ├── cli.ts          # arg parsing, ws bootstrap, entry point
│           ├── app.tsx         # top-level Ink component
│           ├── state.ts        # reducer: event -> canvas state
│           ├── canvas.tsx      # renders the ASCII grid
│           ├── statusbar.tsx   # mode, cursor pos, online users
│           ├── input.ts        # keyboard handler (vim-style)
│           └── ws.ts           # ws client, reconnect, send/recv
```

**Boundaries worth flagging:**

- `shared/` holds the wire format. Both client and server import the same `Event` union. Kills format-drift bugs.
- `state.ts` is a **pure reducer** `(state, event) => state`. Same code runs over Mongo history on first connect and over each live event after. Easy to unit test.
- `room.ts` holds the `Map<canvasId, Room>` and the `Set<WebSocket>` per room. Broadcast is iteration.
- `input.ts` is separate from `app.tsx` because keyboard handling has its own state (current mode, pending shape anchor).

## 4. Data Model

### Wire format (`packages/shared/src/events.ts`)

```ts
type Coord = { x: number; y: number }

type Shape =
  | { kind: 'dot';    at: Coord }
  | { kind: 'circle'; center: Coord; radius: number }
  | { kind: 'square'; tl: Coord; br: Coord }            // top-left, bottom-right
  | { kind: 'line';   from: Coord; to: Coord }

// Outbound from client → server. No `ts` (server stamps it).
type ClientMessage =
  | { type: 'draw';   id: string; shape: Shape }
  | { type: 'undo';   id: string; targetId: string }
  | { type: 'clear';  id: string }
  | { type: 'cursor'; at: Coord }

// Server → client. `ts` and `userId` are server-authoritative on persisted events.
type ServerEvent =
  | { type: 'draw';    id: string; canvasId: string; userId: string; ts: number; shape: Shape }
  | { type: 'undo';    id: string; canvasId: string; userId: string; ts: number; targetId: string }
  | { type: 'clear';   id: string; canvasId: string; userId: string; ts: number }
  | { type: 'cursor';  canvasId: string; userId: string; userName: string; at: Coord }
  | { type: 'join';    canvasId: string; userId: string; userName: string }
  | { type: 'leave';   canvasId: string; userId: string }
  | { type: 'history'; events: ServerEvent[] }
  | { type: 'error';   code: string; msg: string }
```

`canvasId` and `userId` aren't in `ClientMessage` because they're already known from the WS connection's query string + the client's identity handshake. The server attaches them on transform.

Wire validation done with `zod` schemas mirroring both unions — server rejects anything that doesn't parse the `ClientMessage` schema.

**Deliberate choices:**

- `id` on persisted message types (`draw`, `undo`, `clear`), none on ephemeral ones (`cursor`, `join`, `leave`, `history`, `error`).
- `id` is a UUID v4 generated client-side; `ts` is stamped server-side at insert time. Client-side ids let a future optimistic-UI revision correlate local pending state with server confirmation.
- `undo` is itself an event, not a delete. The reducer suppresses draws whose id appears in the undo set. Append-only, deterministic replay.
- `clear` is a tombstone — the reducer drops events with `ts <= clear.ts` for that canvas. Cheap.
- `square` stored as two corners (no implicit anchor).
- Coords are integers (grid cells).
- `undo` is enforced server-side to only target events with the same `userId` as the sender.

### Mongo collections

```js
// events
{ _id: ObjectId, id: "<uuid>", canvasId: "abc", type: "draw",
  userId: "u1", ts: 1719..., shape: {...} }
// index: { canvasId: 1, ts: 1 }

// canvases
{ _id: "abc", createdAt: <ts>, lastActivityAt: <ts> }
```

No users table. `userId` is generated client-side on first run and cached at `~/.whiteboard/identity.json` along with display name.

### Client-side state

```ts
type CanvasState = {
  shapes: Map<string, Shape>      // eventId → shape
  undone: Set<string>             // eventIds suppressed by undo
  clearedAt: number               // ignore events with ts <= this
  presence: Map<string, { name: string; cursor: Coord }>
}

function reduce(state: CanvasState, e: Event): CanvasState { ... }
```

Pure function. Symmetric over history replay and live events.

## 5. Sync Flow

### Client joins a canvas

```
client                              server                              mongo
  │  open ws ?canvasId=abc&name=v     │                                     │
  │ ──────────────────────────────▶  │                                     │
  │                                   │  upsert canvases({_id: abc})        │
  │                                   │ ──────────────────────────────────▶│
  │                                   │  find events({canvasId: abc})       │
  │                                   │       .sort({ts: 1})                │
  │                                   │ ──────────────────────────────────▶│
  │  ← {type: history, events: [...]} │ ◀──────────────────────────────────│
  │ ◀──────────────────────────────  │                                     │
  │  reduce(events) → canvas ready    │                                     │
  │                                   │  add socket to Room(abc)            │
  │                                   │  broadcast {type: join, ...}        │
```

### Client draws a circle

```
client                              server                              mongo
  │  {type: draw, id: e7, shape:...}  │                                     │
  │ ──────────────────────────────▶  │                                     │
  │                                   │  insert events(e7 with ts)          │
  │                                   │ ──────────────────────────────────▶│
  │                                   │  broadcast to Room(abc)             │
  │  ← {type: draw, id: e7, ts:..}    │  (sender included)                  │
  │ ◀──────────────────────────────  │                                     │
  │  reduce → shape appears           │                                     │
```

**No optimistic apply in v1.** Client applies only when the server's broadcast arrives. Every client, including the sender, sees the same ordered stream. Trade-off: one round-trip of perceived input lag. Acceptable for local server.

**Mongo insert order is the total order.** Two clients drawing concurrently get distinct `ts` values from sequential Mongo inserts; everyone sees the same order.

### Failure handling

| Failure | Server behaviour | Client behaviour |
|---|---|---|
| Mongo down on startup | Server fails to boot (loud crash) | Reconnect loop hits closed port; status bar shows "server unreachable" |
| Mongo down mid-session | Insert throws; send `{type: 'error', code: 'persist_failed', msg}` to sender only; do NOT broadcast | Sender shows red status; event not applied locally |
| Client WS drops | `onclose` → remove from Room, broadcast `leave` | Exponential backoff reconnect (1s, 2s, 4s, capped 30s). On reconnect: full history replay from scratch |
| Client sends invalid message | zod parse fails → close socket with code 1003 | Client treats as fatal, surfaces error, exits |
| Client tries to undo another user's event | Server sends `{type: 'error', code: 'undo_forbidden', msg}` to sender; does not persist or broadcast | Client shows toast "can only undo your own shapes" |
| Two clients draw at the same time | Mongo serialises inserts; one gets earlier ts | Both clients see same final order |

**Why full history replay on reconnect, not delta sync?** Incremental sync hides reducer-drift bugs — if a client's state has drifted from the canonical reduction of the log, you'd never notice. Full replay is the boring, correct, v1 choice. Optimise later.

## 6. UI / Rendering

### Layout (Ink, default 80×24)

```
┌─ canvas: abc · 3 online ────────────────────────────┐
│ . . . . . . . . . . . . . . . . . . . . . . . . . . │
│ . . . . . o o o . . . . . . . . . . . . . . . . . . │
│ . . . . o . . . o . . . . . . . . . . . . . . . . . │
│ . . . . o . + . o . . . . ┌─────────┐ . . . . . . . │  ← '+' is my cursor
│ . . . . o . . . o . . . . │ ▓     ▓ │ . . . . . . . │  ← '▓' is another user
│ . . . . . o o o . . . . . │         │ . . . . . . . │
│ . . . . . . . . . . . . . │         │ . . . . . . . │
│ . . . . . . . . . . . . . └─────────┘ . . . . . . . │
│ . . . . . . . . . . . . . . . . . . . . . . . . . . │
│ . . . . . . . . . . . . . . . . . . . . . . . . . . │
│ . . . . ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●  . . . . . │
│ . . . . . . . . . . . . . . . . . . . . . . . . . . │
├──────────────────────────────────────────────────────┤
│ mode: CIRCLE  cursor: (14,5)  ●vansh ●riya ●you      │
│ [d]ot [c]ircle [l]ine [s]quare  [space]place [u]ndo  │
│ [x]clear  [q]uit                                     │
└──────────────────────────────────────────────────────┘
```

**Glyphs:**
- empty cell: `.` (dim grey)
- dot: `•`
- circle outline: `o`
- square sides: `─│┌┐└┘`
- line: `━│╱╲` (chosen by slope)
- own cursor: `+`
- other cursors: a coloured block char, one colour per `userId` (`hash(userId) % palette`)

### Input (vim-style, single keystroke)

| Key | Action |
|---|---|
| `h j k l` / arrows | move cursor by 1 |
| `H J K L` | move cursor by 5 |
| `d` `c` `l` `s` | set draw mode to dot / circle / line / square |
| `space` | place — context-sensitive (see below) |
| `esc` | cancel pending anchor |
| `u` | undo my last draw |
| `x` | clear canvas (with y/N confirm) |
| `q` | quit |

### Two-anchor shapes

Circle, line, and square each need a small state machine:

```
mode=circle, no anchor   ──space──▶   anchor=cursor, awaiting second point
                                            │
                                       move cursor (ghost preview updates)
                                            │
                                        ──space──▶   emit draw, clear anchor
```

- **Circle:** anchor = center; radius = Chebyshev distance to cursor.
- **Line:** anchor = `from`; cursor = `to`.
- **Square:** anchor = one corner; cursor = opposite corner; sides normalised so `tl.x ≤ br.x` and `tl.y ≤ br.y` before sending.

**Ghost preview** during the awaiting state renders locally only (not over WS), in a dim colour.

### Presence

- Cursor positions broadcast on movement, throttled to ~30Hz (33ms min interval). Coalesce — only send latest position per tick.
- `cursor` events are not persisted.
- Status bar shows online list with colour swatches matching cursor colours.

## 7. Testing

| Surface | Test type | Rationale |
|---|---|---|
| `state.ts` reducer | Pure unit tests (vitest) | The brain. Deterministic given input. Easy to test. |
| `events.ts` schema | Zod round-trip per variant | Wire format is the contract. |
| Server room broadcast | One WS integration test | Two in-memory clients, draw on A, assert B receives. |
| Mongo persistence | One integration test | Insert events, restart server, replay history, assert reduced state matches. |
| Ink rendering | Skip | Snapshot tests of TUIs are noisy. Hand-test. |
| Keyboard input | Skip | Hand-test. |

Rule applied: **test the parts where being wrong is invisible** (reducer, persistence). Skip the parts where being wrong is screaming (rendering, input).

## 8. Packaging & Run

- **Monorepo:** `pnpm` workspaces — `packages/shared`, `packages/server`, `packages/client`.
- **Mongo:** `docker-compose.yml` runs Mongo on `localhost:27017`. One command to start.
- **Dev:**
  - server: `pnpm --filter server dev` (tsx watch)
  - client: `pnpm --filter client dev -- <canvasId>`
- **Config:** env vars only. `.env.example` checked in.
  - server: `MONGO_URL`, `WS_PORT`
  - client: `WS_URL`

## 9. Out of Scope (v1)

- Auth / private canvases
- Shape selection / move / resize / delete-by-pick after placement
- Variable canvas size — fixed 80×24 viewport
- Persistence of cursor presence
- Multi-server / horizontal scale (single Node process)
- Web client — CLI only
- Conflict resolution beyond "server timestamp / insert order wins"
- CRDTs

The last item is the design point: the event log + total order via Mongo insert order is the simplest correct sync model. The whole project exists to feel that out — staying at this layer is the goal.
