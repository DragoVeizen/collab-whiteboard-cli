#!/usr/bin/env bash
# M6 verifier — chat + read receipts + envelope animation complete?
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fails=0
fail() { echo "FAIL: $*"; fails=$((fails+1)); }
pass() { echo "PASS: $*"; }

# --- new files ------------------------------------------------------------
for f in \
  packages/client/src/chat.tsx \
  packages/client/src/envelope.ts \
  packages/client/src/colors.ts; do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

# --- rename is complete --------------------------------------------------
# 'canvasId' must not appear in any source file. Verifier scripts are
# excluded (m1..m5 stay pinned to their milestone commits).
hits=$(grep -rn "canvasId\|CanvasState\|upsertCanvas" \
  packages/*/src 2>/dev/null | wc -l | tr -d ' ')
if [[ "$hits" != "0" ]]; then
  fail "leftover canvasId / CanvasState / upsertCanvas in source ($hits hits)"
else
  pass "rename complete — no canvasId / CanvasState / upsertCanvas in source"
fi

# --- exports --------------------------------------------------------------
if [[ -f packages/client/src/state.ts ]]; then
  for t in ChatState ChatMessage; do
    grep -qE "^export type $t\b" packages/client/src/state.ts \
      && pass "state.ts exports type $t" \
      || fail "state.ts does not export type $t"
  done
fi

if [[ -f packages/client/src/input.ts ]]; then
  grep -q "activeTab" packages/client/src/input.ts \
    && pass "input.ts references activeTab" \
    || fail "input.ts does not reference activeTab"
  grep -q "chatDraft" packages/client/src/input.ts \
    && pass "input.ts references chatDraft" \
    || fail "input.ts does not reference chatDraft"
fi

if [[ -f packages/client/src/envelope.ts ]]; then
  for fn in stepEnvelopes envelopeCell; do
    grep -qE "^export function $fn\b" packages/client/src/envelope.ts \
      && pass "envelope.ts exports function $fn" \
      || fail "envelope.ts does not export function $fn"
  done
fi

if [[ -f packages/client/src/colors.ts ]]; then
  grep -qE "^export function colorFor\b" packages/client/src/colors.ts \
    && pass "colors.ts exports colorFor" \
    || fail "colors.ts does not export colorFor"
fi

if [[ -f packages/client/src/chat.tsx ]]; then
  grep -qE "^export function Chat\b" packages/client/src/chat.tsx \
    && pass "chat.tsx exports Chat component" \
    || fail "chat.tsx does not export Chat"
fi

# --- required reducer chat tests -----------------------------------------
required_state_tests=(
  "chatMessage adds to messages map"
  "read event adds userId to receipts set"
  "read of unknown message still records receipt"
  "clear does not wipe messages"
)
if [[ -f packages/client/src/state.test.ts ]]; then
  for t in "${required_state_tests[@]}"; do
    if grep -qF "$t" packages/client/src/state.test.ts; then
      pass "state.test.ts covers: \"$t\""
    else
      fail "state.test.ts MISSING: \"$t\""
    fi
  done
fi

# --- required input tests ------------------------------------------------
required_input_tests=(
  "tab toggles activeTab from canvas to chat"
  "letter in chat mode appends to draft"
  "backspace removes last draft char"
  "enter in chat mode emits chatMessage with the draft"
  "enter with empty draft is a no-op"
)
if [[ -f packages/client/src/input.test.ts ]]; then
  for t in "${required_input_tests[@]}"; do
    if grep -qF "$t" packages/client/src/input.test.ts; then
      pass "input.test.ts covers: \"$t\""
    else
      fail "input.test.ts MISSING: \"$t\""
    fi
  done
fi

# --- required schema tests -----------------------------------------------
required_schema_tests=(
  "chatMessage message parses"
  "read message parses"
  "rejects chatMessage with server-stamped fields"
)
if [[ -f packages/shared/src/events.test.ts ]]; then
  for t in "${required_schema_tests[@]}"; do
    if grep -qF "$t" packages/shared/src/events.test.ts; then
      pass "events.test.ts covers: \"$t\""
    else
      fail "events.test.ts MISSING: \"$t\""
    fi
  done
fi

# --- required handler integration tests -----------------------------------
required_handler_tests=(
  "chat message broadcasts and persists"
  "read receipt broadcasts"
)
if [[ -f packages/server/src/handlers.integration.test.ts ]]; then
  for t in "${required_handler_tests[@]}"; do
    if grep -qF "$t" packages/server/src/handlers.integration.test.ts; then
      pass "handlers.integration.test.ts covers: \"$t\""
    else
      fail "handlers.integration.test.ts MISSING: \"$t\""
    fi
  done
fi

# --- anti-gaming ----------------------------------------------------------
for f in $(find packages -name '*.test.ts' 2>/dev/null); do
  if grep -qE "vi\.mock\(['\"](@whiteboard/shared|ink|react|ws|mongodb)" "$f"; then
    fail "$f mocks a core dep"
  fi
  if grep -qE "\.(skip|todo)\(" "$f"; then
    fail "$f contains .skip or .todo"
  fi
  if grep -qE "expect\(true\)\.toBe\(true\)" "$f"; then
    fail "$f contains trivial expect(true).toBe(true)"
  fi
done

hits=$(grep -R --include='*.ts' --include='*.tsx' -nE '@ts-(ignore|expect-error|nocheck)' packages 2>/dev/null | wc -l | tr -d ' ')
if [[ "$hits" != "0" ]]; then
  fail "@ts-(ignore|expect-error|nocheck) present: $hits hits"
else
  pass "no @ts-ignore / @ts-expect-error / @ts-nocheck"
fi

banned='yjs y-protocols automerge redis ioredis express fastify @nestjs nats'
for pj in package.json packages/*/package.json; do
  [[ -f "$pj" ]] || continue
  for dep in $banned; do
    if grep -qE "\"$dep\"\\s*:" "$pj"; then
      fail "banned dep $dep present in $pj"
    fi
  done
done

# --- typecheck + tests ----------------------------------------------------
if command -v pnpm >/dev/null 2>&1; then
  if pnpm -r typecheck >/tmp/verify-m6-typecheck.log 2>&1; then
    pass "pnpm -r typecheck exits 0"
  else
    fail "pnpm -r typecheck failed (see /tmp/verify-m6-typecheck.log)"
  fi

  if pnpm -r test >/tmp/verify-m6-test.log 2>&1; then
    pass "pnpm -r test exits 0"
  else
    fail "pnpm -r test failed (see /tmp/verify-m6-test.log)"
  fi
fi

echo ""
if [[ "$fails" == "0" ]]; then
  echo "M6 verifier: GREEN"
  exit 0
else
  echo "M6 verifier: RED ($fails failures)"
  exit 1
fi
