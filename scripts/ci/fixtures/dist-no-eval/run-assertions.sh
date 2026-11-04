#!/usr/bin/env bash
# 本地负向/正向断言（不进 CI 重活；便宜时可挂）。仓库根执行：
#   bash scripts/ci/fixtures/dist-no-eval/run-assertions.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SCRIPT="$ROOT/scripts/ci/check-dist-no-eval.sh"
FIX="$ROOT/scripts/ci/fixtures/dist-no-eval"
fail=0

expect_fail() {
  local name="$1" dir="$2"
  if DIST_DIR="$dir" "$SCRIPT" >/tmp/dist-no-eval-"$name".out 2>/tmp/dist-no-eval-"$name".err; then
    echo "ASSERT FAIL: $name 期望失败却成功" >&2
    fail=1
  else
    echo "ASSERT OK: $name 按预期失败"
  fi
}

expect_ok() {
  local name="$1" dir="$2"
  if DIST_DIR="$dir" "$SCRIPT" >/tmp/dist-no-eval-"$name".out 2>/tmp/dist-no-eval-"$name".err; then
    echo "ASSERT OK: $name 按预期通过"
  else
    echo "ASSERT FAIL: $name 期望通过却失败：" >&2
    cat /tmp/dist-no-eval-"$name".err >&2
    fail=1
  fi
}

expect_fail fake-prefix "$FIX/fake-prefix"
expect_fail bare-function "$FIX/bare-function"
expect_ok good-prefix "$FIX/good-prefix"

exit "$fail"
