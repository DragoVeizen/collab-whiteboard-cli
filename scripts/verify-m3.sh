#!/usr/bin/env bash
# M3 verifier — server (Room, Store, handlers) complete?
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fails=0
fail() { echo "FAIL: $*"; fails=$((fails+1)); }
pass() { echo "PASS: $*"; }

# --- required files -------------------------------------------------------
for f in \
  packages/server/src/room.ts \
  packages/server/src/store.ts \
  packages/server/src/handlers.ts \
  packages/server/src/index.ts \
  packages/server/src/room.test.ts \
  packages/server/src/store.integration.test.ts \
  packages/server/src/handlers.integration.test.ts; do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

# --- deps ------------------------------------------------------------------
if [[ -f packages/server/package.json ]]; then
  for dep in ws mongodb; do
    grep -qE "\"$dep\"\\s*:" packages/server/package.json \
      && pass "server has dep '$dep'" \
      || fail "server missing dep '$dep'"
  done
  for dep in "@types/ws" mongodb-memory-server; do
    grep -qE "\"$dep\"\\s*:" packages/server/package.json \
      && pass "server has devDep '$dep'" \
      || fail "server missing devDep '$dep'"
  done
fi

# --- required exports -----------------------------------------------------
if [[ -f packages/server/src/room.ts ]]; then
  grep -qE "^export class Room\b" packages/server/src/room.ts \
    && pass "room.ts exports class Room" \
    || fail "room.ts does not export class Room"
  grep -qE "^export class RoomRegistry\b" packages/server/src/room.ts \
    && pass "room.ts exports class RoomRegistry" \
    || fail "room.ts does not export class RoomRegistry"
fi

if [[ -f packages/server/src/store.ts ]]; then
  grep -qE "^export class Store\b" packages/server/src/store.ts \
    && pass "store.ts exports class Store" \
    || fail "store.ts does not export class Store"
  if grep -qE "^export type PersistableEvent\b" packages/server/src/store.ts \
     || grep -qE "^export type \{[^}]*\bPersistableEvent\b" packages/server/src/store.ts; then
    pass "store.ts exports type PersistableEvent"
  else
    fail "store.ts does not export type PersistableEvent"
  fi
fi

if [[ -f packages/server/src/handlers.ts ]]; then
  for fn in handleConnect handleMessage handleDisconnect; do
    grep -qE "^export (async )?function $fn\b" packages/server/src/handlers.ts \
      && pass "handlers.ts exports function $fn" \
      || fail "handlers.ts does not export function $fn"
  done
  grep -qE "^export type Session\b" packages/server/src/handlers.ts \
    && pass "handlers.ts exports type Session" \
    || fail "handlers.ts does not export type Session"
fi

# --- handlers.ts must validate incoming messages via zod schema -----------
if [[ -f packages/server/src/handlers.ts ]]; then
  grep -q "ClientMessageSchema" packages/server/src/handlers.ts \
    && pass "handlers.ts references ClientMessageSchema (validation)" \
    || fail "handlers.ts does not use ClientMessageSchema — must validate incoming messages"
fi

# --- required test names in handlers.integration.test.ts ------------------
required_handler_tests=(
  "draw broadcasts to all clients in the same canvas"
  "draw is echoed back to the sender"
  "history replays on connect"
  "cursor is broadcast but not persisted"
  "unknown message type closes the socket"
  "undo of another user's event is rejected"
  "server stamps ts, client cannot forge"
  "leave broadcasts when socket closes"
)
if [[ -f packages/server/src/handlers.integration.test.ts ]]; then
  for t in "${required_handler_tests[@]}"; do
    if grep -qF "$t" packages/server/src/handlers.integration.test.ts; then
      pass "handlers.integration.test.ts covers: \"$t\""
    else
      fail "handlers.integration.test.ts MISSING required test: \"$t\""
    fi
  done
fi

# --- required test names in store.integration.test.ts --------------------
required_store_tests=(
  "appendEvent persists a draw event"
  "loadHistory returns events in ts order"
  "loadHistory filters by canvasId"
  "upsertCanvas creates and updates metadata"
  "findEventById returns the event when it exists"
  "findEventById returns null when missing"
)
if [[ -f packages/server/src/store.integration.test.ts ]]; then
  for t in "${required_store_tests[@]}"; do
    if grep -qF "$t" packages/server/src/store.integration.test.ts; then
      pass "store.integration.test.ts covers: \"$t\""
    else
      fail "store.integration.test.ts MISSING required test: \"$t\""
    fi
  done
fi

# --- required test names in room.test.ts ---------------------------------
required_room_tests=(
  "broadcast sends message to all connected sockets"
  "broadcast with except skips the excluded socket"
  "remove takes a socket out of broadcast"
  "returns the same Room for the same canvasId"
)
if [[ -f packages/server/src/room.test.ts ]]; then
  for t in "${required_room_tests[@]}"; do
    if grep -qF "$t" packages/server/src/room.test.ts; then
      pass "room.test.ts covers: \"$t\""
    else
      fail "room.test.ts MISSING required test: \"$t\""
    fi
  done
fi

# --- anti-gaming: no mocking of core deps in tests ------------------------
for f in $(find packages/server/src -name '*.test.ts' 2>/dev/null); do
  if grep -qE "vi\.mock\(['\"](mongodb|ws|@whiteboard/shared)" "$f"; then
    fail "$f mocks a core dep — must use real ws + mongodb-memory-server"
  fi
done

# --- anti-gaming: integration tests use REAL WebSocket and real mongo ----
if [[ -f packages/server/src/handlers.integration.test.ts ]]; then
  grep -q "MongoMemoryServer" packages/server/src/handlers.integration.test.ts \
    && pass "handlers.integration.test.ts uses MongoMemoryServer" \
    || fail "handlers.integration.test.ts does NOT use MongoMemoryServer"
  grep -qE "new WebSocket\(" packages/server/src/handlers.integration.test.ts \
    && pass "handlers.integration.test.ts opens a real WebSocket client" \
    || fail "handlers.integration.test.ts does NOT open real WebSocket clients"
fi

if [[ -f packages/server/src/store.integration.test.ts ]]; then
  grep -q "MongoMemoryServer" packages/server/src/store.integration.test.ts \
    && pass "store.integration.test.ts uses MongoMemoryServer" \
    || fail "store.integration.test.ts does NOT use MongoMemoryServer"
fi

# --- anti-gaming: cursor case must NOT persist ---------------------------
if [[ -f packages/server/src/handlers.ts ]]; then
  # crude but effective check: no appendEvent call inside a cursor case branch
  python3 - "packages/server/src/handlers.ts" <<'PY' && pass "handlers.ts: cursor case does not persist" || fail "handlers.ts: cursor case appears to call appendEvent (must not persist)"
import re, sys
src = open(sys.argv[1]).read()
# find "case \"cursor\"" block: from that literal to the next "case" or closing brace at same depth
m = re.search(r'case\s+"cursor"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})', src, re.DOTALL)
if not m:
    # if there's no explicit cursor block, we can't verify — treat as pass (impl style may differ)
    sys.exit(0)
block = m.group(1)
sys.exit(1 if "appendEvent" in block else 0)
PY
fi

# --- anti-gaming: no .skip / .todo / trivial assertions -------------------
for f in $(find packages -name '*.test.ts' 2>/dev/null); do
  if grep -qE "\.(skip|todo)\(" "$f"; then
    fail "$f contains .skip or .todo"
  fi
  if grep -qE "expect\(true\)\.toBe\(true\)" "$f"; then
    fail "$f contains trivial expect(true).toBe(true)"
  fi
done

# --- anti-gaming: no @ts-ignore ------------------------------------------
hits=$(grep -R --include='*.ts' -nE '@ts-(ignore|expect-error|nocheck)' packages 2>/dev/null | wc -l | tr -d ' ')
if [[ "$hits" != "0" ]]; then
  fail "@ts-(ignore|expect-error|nocheck) present: $hits hits"
else
  pass "no @ts-ignore / @ts-expect-error / @ts-nocheck"
fi

# --- banned deps still absent --------------------------------------------
banned='yjs y-protocols automerge redis ioredis express fastify @nestjs nats'
for pj in package.json packages/*/package.json; do
  [[ -f "$pj" ]] || continue
  for dep in $banned; do
    if grep -qE "\"$dep\"\\s*:" "$pj"; then
      fail "banned dep $dep present in $pj"
    fi
  done
done

# --- typecheck + tests ---------------------------------------------------
if command -v pnpm >/dev/null 2>&1; then
  if pnpm -r typecheck >/tmp/verify-m3-typecheck.log 2>&1; then
    pass "pnpm -r typecheck exits 0"
  else
    fail "pnpm -r typecheck failed (see /tmp/verify-m3-typecheck.log)"
  fi

  # Tests can take a while on first run (mongod binary download).
  if pnpm -r test >/tmp/verify-m3-test.log 2>&1; then
    pass "pnpm -r test exits 0"
  else
    fail "pnpm -r test failed (see /tmp/verify-m3-test.log)"
  fi
fi

echo ""
if [[ "$fails" == "0" ]]; then
  echo "M3 verifier: GREEN"
  exit 0
else
  echo "M3 verifier: RED ($fails failures)"
  exit 1
fi
