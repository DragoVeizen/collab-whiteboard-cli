#!/usr/bin/env bash
# M4 verifier — client TUI (rendering, input, ws, Ink components) complete?
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fails=0
fail() { echo "FAIL: $*"; fails=$((fails+1)); }
pass() { echo "PASS: $*"; }

# --- required files -------------------------------------------------------
for f in \
  packages/client/src/rendering.ts \
  packages/client/src/rendering.test.ts \
  packages/client/src/input.ts \
  packages/client/src/input.test.ts \
  packages/client/src/ws.ts \
  packages/client/src/identity.ts \
  packages/client/src/app.tsx \
  packages/client/src/canvas.tsx \
  packages/client/src/statusbar.tsx \
  packages/client/src/cli.ts; do
  [[ -f "$f" ]] && pass "$f exists" || fail "$f missing"
done

# --- deps -----------------------------------------------------------------
if [[ -f packages/client/package.json ]]; then
  for dep in ink react ws; do
    grep -qE "\"$dep\"\\s*:" packages/client/package.json \
      && pass "client has dep '$dep'" \
      || fail "client missing dep '$dep'"
  done
  for dep in "@types/react" "@types/ws"; do
    grep -qE "\"$dep\"\\s*:" packages/client/package.json \
      && pass "client has devDep '$dep'" \
      || fail "client missing devDep '$dep'"
  done
fi

# --- rendering.ts exports -------------------------------------------------
if [[ -f packages/client/src/rendering.ts ]]; then
  for fn in rasterizeDot rasterizeCircle rasterizeSquare rasterizeLine rasterizeShape composeGrid; do
    grep -qE "^export function $fn\b" packages/client/src/rendering.ts \
      && pass "rendering.ts exports function $fn" \
      || fail "rendering.ts does not export function $fn"
  done
  grep -qE "^export type Cell\b" packages/client/src/rendering.ts \
    && pass "rendering.ts exports type Cell" \
    || fail "rendering.ts does not export type Cell"
fi

# --- input.ts exports -----------------------------------------------------
if [[ -f packages/client/src/input.ts ]]; then
  for fn in reduceInput initialInputState; do
    grep -qE "^export function $fn\b" packages/client/src/input.ts \
      && pass "input.ts exports function $fn" \
      || fail "input.ts does not export function $fn"
  done
  for t in Mode InputState InputResult; do
    grep -qE "^export type $t\b" packages/client/src/input.ts \
      && pass "input.ts exports type $t" \
      || fail "input.ts does not export type $t"
  done
fi

# --- purity: rendering & input must not import ink or react ---------------
for f in packages/client/src/rendering.ts packages/client/src/input.ts; do
  [[ -f "$f" ]] || continue
  if grep -qE "from ['\"](ink|react)['\"]" "$f"; then
    fail "$f imports from ink/react — must stay pure"
  else
    pass "$(basename "$f") is pure (no ink/react imports)"
  fi
done

# --- required rendering tests ---------------------------------------------
required_rendering_tests=(
  "rasterizes a dot at its coordinate"
  "rasterizes a circle outline with Chebyshev radius"
  "rasterizes a square outline with four sides"
  "rasterizes a line from start to end"
  "line covers diagonal (0,0) to (n,n)"
  "empty state produces empty grid"
)
if [[ -f packages/client/src/rendering.test.ts ]]; then
  for t in "${required_rendering_tests[@]}"; do
    if grep -qF "$t" packages/client/src/rendering.test.ts; then
      pass "rendering.test.ts covers: \"$t\""
    else
      fail "rendering.test.ts MISSING: \"$t\""
    fi
  done
fi

# --- required input tests -------------------------------------------------
required_input_tests=(
  "1 key sets mode to dot"
  "2 key sets mode to circle"
  "3 key sets mode to line"
  "4 key sets mode to square"
  "h moves cursor left by 1"
  "j moves cursor down by 1"
  "k moves cursor up by 1"
  "l moves cursor right by 1"
  "space in dot mode emits draw dot at cursor"
  "space in circle mode without anchor sets anchor"
  "space in circle mode with anchor emits draw circle"
  "space in line mode with anchor emits draw line"
  "space in square mode with anchor emits draw square"
  "esc cancels pending anchor"
  "u emits undo of last own draw"
  "u with no prior own draws does nothing"
  "x emits clear"
  "cursor clamped: cannot go below zero"
  "reduceInput does not mutate the input state"
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

# --- test count sanity ----------------------------------------------------
if [[ -f packages/client/src/input.test.ts ]]; then
  count=$(grep -cE "^\s*it\(" packages/client/src/input.test.ts)
  [[ $count -ge 20 ]] && pass "input.test.ts has $count tests (>= 20)" \
    || fail "input.test.ts has $count tests (need >= 20)"
fi
if [[ -f packages/client/src/rendering.test.ts ]]; then
  count=$(grep -cE "^\s*it\(" packages/client/src/rendering.test.ts)
  [[ $count -ge 10 ]] && pass "rendering.test.ts has $count tests (>= 10)" \
    || fail "rendering.test.ts has $count tests (need >= 10)"
fi

# --- anti-gaming: no mocks of core deps -----------------------------------
for f in $(find packages/client/src -name '*.test.ts' 2>/dev/null); do
  if grep -qE "vi\.mock\(['\"](@whiteboard/shared|ink|react|ws|mongodb)" "$f"; then
    fail "$f mocks a core dep"
  fi
done

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
hits=$(grep -R --include='*.ts' --include='*.tsx' -nE '@ts-(ignore|expect-error|nocheck)' packages 2>/dev/null | wc -l | tr -d ' ')
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
  if pnpm -r typecheck >/tmp/verify-m4-typecheck.log 2>&1; then
    pass "pnpm -r typecheck exits 0"
  else
    fail "pnpm -r typecheck failed (see /tmp/verify-m4-typecheck.log)"
  fi

  if pnpm -r test >/tmp/verify-m4-test.log 2>&1; then
    pass "pnpm -r test exits 0"
  else
    fail "pnpm -r test failed (see /tmp/verify-m4-test.log)"
  fi
fi

echo ""
if [[ "$fails" == "0" ]]; then
  echo "M4 verifier: GREEN"
  exit 0
else
  echo "M4 verifier: RED ($fails failures)"
  exit 1
fi
