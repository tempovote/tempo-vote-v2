#!/usr/bin/env bash
# Monorepo project detection for /supergraph:scan.
# Outputs shell variable assignments that are eval'd by the scan skill.
# Detects both the pnpm/TypeScript and Gradle/Kotlin stacks simultaneously.

set -euo pipefail

HAS_PNPM=false
HAS_GRADLE=false

[[ -f package.json ]] && HAS_PNPM=true
[[ -f gradlew ]] && HAS_GRADLE=true

if $HAS_PNPM && $HAS_GRADLE; then
  # Monorepo: Next.js (apps/web) + Kotlin/Ktor (apps/api)
  echo "PROJECT_TYPE=monorepo-kotlin-ts"

  # Primary (TS): used by default in tdd/fix/verify when touching TS/TSX files
  echo "TEST_CMD=pnpm test"
  echo "LINT_CMD=pnpm lint && pnpm typecheck"
  echo "FORMAT_CMD="   # no formatter configured — prettier not in scripts
  echo "BUILD_CMD=pnpm build"

  # Secondary (Kotlin): used when touching .kt files — skills read these explicitly
  echo "TEST_CMD_KOTLIN=./gradlew :apps:api:test"
  echo "LINT_CMD_KOTLIN=./gradlew :apps:api:build"   # compilation = lint (no ktlint configured)
  echo "BUILD_CMD_KOTLIN=./gradlew :apps:api:build"

  # Full suite: used by /supergraph:verify before merge
  echo "TEST_CMD_ALL=bin/test-all.sh"

  # Focused test helpers (for /supergraph:tdd RED phase)
  # TS:     pnpm --filter web test -- <pattern>
  # Kotlin: ./gradlew :apps:api:test --tests "vote.tempo.<ClassName>*"
  echo "FOCUSED_TEST_HINT_TS=pnpm --filter web test -- <pattern>"
  echo "FOCUSED_TEST_HINT_KOTLIN=./gradlew :apps:api:test --tests 'vote.tempo.<ClassName>*'"

elif $HAS_PNPM; then
  echo "PROJECT_TYPE=node"
  echo "TEST_CMD=pnpm test"
  echo "LINT_CMD=pnpm lint && pnpm typecheck"
  echo "FORMAT_CMD="
  echo "BUILD_CMD=pnpm build"

elif $HAS_GRADLE; then
  echo "PROJECT_TYPE=kotlin"
  echo "TEST_CMD=./gradlew :apps:api:test"
  echo "LINT_CMD=./gradlew :apps:api:build"
  echo "FORMAT_CMD="
  echo "BUILD_CMD=./gradlew :apps:api:build"

else
  echo "PROJECT_TYPE=unknown"
fi
