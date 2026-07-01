#!/usr/bin/env bash
# Full test suite: runs both TypeScript (vitest) and Kotlin (Gradle) tests.
# Used by /supergraph:verify before merge to confirm no regressions on either stack.
#
# Exit code is non-zero if either suite fails.

set -euo pipefail

TS_PASS=true
KOTLIN_PASS=true

echo "=== [1/2] TypeScript tests (vitest) ==="
if ! pnpm test; then
  TS_PASS=false
fi

echo ""
echo "=== [2/2] Kotlin tests (Gradle / JUnit5) ==="
if ! ./gradlew :apps:api:test; then
  KOTLIN_PASS=false
fi

echo ""
echo "=== Results ==="
echo "TS:     $($TS_PASS && echo PASS || echo FAIL)"
echo "Kotlin: $($KOTLIN_PASS && echo PASS || echo FAIL)"

if ! $TS_PASS || ! $KOTLIN_PASS; then
  exit 1
fi
