#!/usr/bin/env bash
# M2 verifier — shared types/schemas + client reducer complete?
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fails=0
fail() { echo "FAIL: $*"; fails=$((fails+1)); }
pass() { echo "PASS: $*"; }

# --- required files --------------------------------------------------------
for f in \
  packages/shared/src/events.ts \
  packages/shared/src/events.test.ts \
  packages/client/src/state.ts \
  packages/client/src/state.test.ts; do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

# --- zod dep ---------------------------------------------------------------
if [[ -f packages/shared/package.json ]]; then
  grep -q '"zod"' packages/shared/package.json && pass "shared has zod dep" \
    || fail "shared missing zod dep"
fi

# --- required exports from shared/events.ts -------------------------------
if [[ -f packages/shared/src/events.ts ]]; then
  for sym in Coord Shape ClientMessage ServerEvent; do
    if grep -qE "^export type $sym\b" packages/shared/src/events.ts; then
      pass "shared/events.ts exports type $sym"
    else
      fail "shared/events.ts does not export type $sym"
    fi
  done
  for sym in ClientMessageSchema ServerEventSchema; do
    if grep -qE "^export const $sym\b" packages/shared/src/events.ts; then
      pass "shared/events.ts exports const $sym"
    else
      fail "shared/events.ts does not export const $sym"
    fi
  done
fi

# --- reducer exports -------------------------------------------------------
if [[ -f packages/client/src/state.ts ]]; then
  grep -qE "^export function reduce\b" packages/client/src/state.ts \
    && pass "state.ts exports function reduce" \
    || fail "state.ts does not export function reduce"
  grep -qE "^export function initialState\b" packages/client/src/state.ts \
    && pass "state.ts exports function initialState" \
    || fail "state.ts does not export function initialState"
  grep -qE "^export type CanvasState\b" packages/client/src/state.ts \
    && pass "state.ts exports type CanvasState" \
    || fail "state.ts does not export type CanvasState"
fi

# --- reducer must not import IO / server-side deps ------------------------
if [[ -f packages/client/src/state.ts ]]; then
  for dep in mongodb ws '@whiteboard/server' fs 'node:fs' path 'node:path' child_process 'node:child_process'; do
    if grep -qE "from ['\"]$dep['\"]" packages/client/src/state.ts; then
      fail "state.ts imports from '$dep' — reducer must be pure"
    fi
  done
  if grep -qE '(fetch\s*\(|https?\.\w)' packages/client/src/state.ts; then
    fail "state.ts contains network calls — reducer must be pure"
  fi
  pass "state.ts has no IO / server imports"
fi

# --- required reducer test names (anti-gaming: name specific invariants) --
required_reducer_tests=(
  "draw appends shape to state"
  "multiple draws all present"
  "draw with same id is idempotent"
  "undo suppresses own draw"
  "clear tombstones all prior draws"
  "draws after clear are visible"
  "clear does not affect presence"
  "join adds to presence"
  "leave removes from presence"
  "cursor updates presence position"
  "cursor before join creates presence entry"
  "history folds equivalent to sequential reduces"
  "does not mutate input state on draw"
  "produces identical output for identical input"
)
if [[ -f packages/client/src/state.test.ts ]]; then
  for t in "${required_reducer_tests[@]}"; do
    if grep -qF "$t" packages/client/src/state.test.ts; then
      pass "state.test.ts covers: \"$t\""
    else
      fail "state.test.ts MISSING required test: \"$t\""
    fi
  done
fi

# --- required schema tests ------------------------------------------------
required_schema_tests=(
  "draw message parses"
  "undo message parses"
  "clear message parses"
  "cursor message parses"
  "rejects unknown message type"
  "rejects malformed shape kind"
)
if [[ -f packages/shared/src/events.test.ts ]]; then
  for t in "${required_schema_tests[@]}"; do
    if grep -qF "$t" packages/shared/src/events.test.ts; then
      pass "events.test.ts covers: \"$t\""
    else
      fail "events.test.ts MISSING required test: \"$t\""
    fi
  done
fi

# --- reducer test count sanity --------------------------------------------
if [[ -f packages/client/src/state.test.ts ]]; then
  count=$(grep -cE "^\s*it\(" packages/client/src/state.test.ts)
  if [[ $count -ge 15 ]]; then
    pass "state.test.ts has $count it() blocks (>= 15)"
  else
    fail "state.test.ts has only $count it() blocks (need >= 15)"
  fi
fi

# --- anti-gaming: no .skip / .todo / trivial assertions -------------------
for f in packages/shared/src/*.test.ts packages/client/src/*.test.ts; do
  [[ -f "$f" ]] || continue
  if grep -qE "\.(skip|todo)\(" "$f"; then
    fail "$f contains .skip or .todo"
  fi
  if grep -qE "expect\(true\)\.toBe\(true\)" "$f"; then
    fail "$f contains trivial expect(true).toBe(true)"
  fi
done

# --- anti-gaming: no mocking mongo / ws / shared ----------------------------
for f in $(find packages -name '*.test.ts' 2>/dev/null); do
  if grep -qE "vi\.mock\(['\"](mongodb|ws|@whiteboard/shared)" "$f"; then
    fail "$f mocks a core dep"
  fi
done

# --- anti-gaming: no @ts-ignore -------------------------------------------
hits=$(grep -R --include='*.ts' -nE '@ts-(ignore|expect-error|nocheck)' packages 2>/dev/null | wc -l | tr -d ' ')
if [[ "$hits" != "0" ]]; then
  fail "@ts-(ignore|expect-error|nocheck) present: $hits hits"
else
  pass "no @ts-ignore / @ts-expect-error / @ts-nocheck"
fi

# --- banned deps still absent ---------------------------------------------
banned='yjs y-protocols automerge redis ioredis express fastify @nestjs nats'
for pj in package.json packages/*/package.json; do
  [[ -f "$pj" ]] || continue
  for dep in $banned; do
    if grep -qE "\"$dep\"\s*:" "$pj"; then
      fail "banned dep $dep present in $pj"
    fi
  done
done

# --- typecheck + tests must pass -------------------------------------------
if command -v pnpm >/dev/null 2>&1; then
  if pnpm -r typecheck >/tmp/verify-m2-typecheck.log 2>&1; then
    pass "pnpm -r typecheck exits 0"
  else
    fail "pnpm -r typecheck failed (see /tmp/verify-m2-typecheck.log)"
  fi

  if pnpm -r test >/tmp/verify-m2-test.log 2>&1; then
    pass "pnpm -r test exits 0"
  else
    fail "pnpm -r test failed (see /tmp/verify-m2-test.log)"
  fi
fi

# M1 regression is implicitly covered: pnpm -r test runs M1 canaries too,
# so the check above catches any M1 breakage without a redundant re-run.

echo ""
if [[ "$fails" == "0" ]]; then
  echo "M2 verifier: GREEN"
  exit 0
else
  echo "M2 verifier: RED ($fails failures)"
  exit 1
fi
