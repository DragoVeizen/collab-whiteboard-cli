#!/usr/bin/env bash
# M1 verifier — scaffold complete?
# Exits 0 only if every check passes. Prints one FAIL line per broken check.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fails=0
fail() { echo "FAIL: $*"; fails=$((fails+1)); }
pass() { echo "PASS: $*"; }

# --- structure -------------------------------------------------------------
[[ -f pnpm-workspace.yaml ]] && pass "pnpm-workspace.yaml exists"       || fail "pnpm-workspace.yaml missing"
[[ -f tsconfig.base.json  ]] && pass "tsconfig.base.json exists"        || fail "tsconfig.base.json missing"
[[ -f docker-compose.yml  ]] && pass "docker-compose.yml exists"        || fail "docker-compose.yml missing"
[[ -f pnpm-lock.yaml      ]] && pass "pnpm-lock.yaml exists"            || fail "pnpm-lock.yaml missing (run pnpm install)"

for pkg in shared server client; do
  [[ -f "packages/$pkg/package.json" ]] && pass "packages/$pkg/package.json exists" \
    || fail "packages/$pkg/package.json missing"
done

# --- workspace contents ----------------------------------------------------
if [[ -f pnpm-workspace.yaml ]]; then
  for pkg in shared server client; do
    grep -q "packages/$pkg" pnpm-workspace.yaml \
      && pass "workspace lists packages/$pkg" \
      || fail "pnpm-workspace.yaml does not list packages/$pkg"
  done
fi

# --- required dev deps in each package -------------------------------------
for pkg in shared server client; do
  pj="packages/$pkg/package.json"
  if [[ -f "$pj" ]]; then
    grep -q '"vitest"'     "$pj" && pass "$pkg has vitest dep"     || fail "$pkg missing vitest dep"
    grep -q '"typescript"' "$pj" && pass "$pkg has typescript dep" || fail "$pkg missing typescript dep"
  fi
done

# --- docker-compose has mongo 7 on 27017 -----------------------------------
if [[ -f docker-compose.yml ]]; then
  grep -q "mongo:7" docker-compose.yml && pass "compose uses mongo:7" \
    || fail "docker-compose.yml doesn't pin mongo:7"
  grep -q "27017" docker-compose.yml && pass "compose exposes 27017" \
    || fail "docker-compose.yml doesn't expose 27017"
fi

# --- canary test per package (must exist AND assert something real) --------
for pkg in shared server client; do
  canary=$(find "packages/$pkg" -maxdepth 4 -name '*.test.ts' 2>/dev/null | head -n1)
  if [[ -z "$canary" ]]; then
    fail "$pkg has no *.test.ts file"
  else
    if grep -qE 'expect\s*\(' "$canary"; then
      pass "$pkg canary test $canary has an expect()"
    else
      fail "$pkg canary test $canary has no expect() — empty scaffold not accepted"
    fi
    # anti-cheat: reject purely trivial `expect(true).toBe(true)`
    if grep -qE 'expect\(true\)\.toBe\(true\)' "$canary"; then
      fail "$pkg canary is the trivial expect(true).toBe(true) — write a real assertion"
    fi
  fi
done

# --- banned deps -----------------------------------------------------------
banned='yjs y-protocols automerge redis ioredis express fastify @nestjs nats'
for pj in package.json packages/*/package.json; do
  [[ -f "$pj" ]] || continue
  for dep in $banned; do
    if grep -qE "\"$dep\"\s*:" "$pj"; then
      fail "banned dep '$dep' present in $pj"
    fi
  done
done

# --- ts-ignore guard -------------------------------------------------------
if [[ -d packages ]]; then
  hits=$(grep -R --include='*.ts' --include='*.tsx' -nE '@ts-(ignore|expect-error|nocheck)' packages 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$hits" != "0" ]]; then
    fail "@ts-ignore / @ts-expect-error / @ts-nocheck present ($hits hits) — M1 forbids these"
  else
    pass "no @ts-ignore / @ts-expect-error / @ts-nocheck"
  fi
fi

# --- typecheck -------------------------------------------------------------
if command -v pnpm >/dev/null 2>&1 && [[ -f pnpm-lock.yaml ]]; then
  if pnpm -r typecheck >/tmp/verify-m1-typecheck.log 2>&1; then
    pass "pnpm -r typecheck exits 0"
  else
    fail "pnpm -r typecheck failed — see /tmp/verify-m1-typecheck.log"
  fi

  if pnpm -r test --run >/tmp/verify-m1-test.log 2>&1; then
    pass "pnpm -r test exits 0"
  else
    fail "pnpm -r test failed — see /tmp/verify-m1-test.log"
  fi
else
  fail "pnpm unavailable or install not run"
fi

echo ""
if [[ "$fails" == "0" ]]; then
  echo "M1 verifier: GREEN"
  exit 0
else
  echo "M1 verifier: RED ($fails failures)"
  exit 1
fi
