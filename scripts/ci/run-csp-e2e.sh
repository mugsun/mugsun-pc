#!/usr/bin/env bash
# 起 pc+boot+PG+Redis（CSP enforce、report-uri、demo 收集端/F7、关验证码）→ 清平台 admin 强制改密 → 跑 e2e-csp。
#
# CI workflow 钉 boot/core SHA（见 .github/workflows/ci.yml csp-e2e）；
# 当前 boot=a02dd2823bf4…（CSP /csp-report + demo F7）、core=50c5843684c2…
# 升钉改 ci.yml ref，并同步 AGENTS / playwright.csp.config.ts 注释。
#
# 目录布局（compose.pc.yml 约定）：
#   <parent>/
#   ├── mugsun-core/
#   ├── mugsun-boot/
#   └── mugsun-pc/    ← 本脚本在 mugsun-pc/scripts/ci/
#
# 用法（在 mugsun-pc 根目录，或任意目录靠本脚本定位）：
#   scripts/ci/run-csp-e2e.sh
#   KEEP=1 scripts/ci/run-csp-e2e.sh          # 验完不 down
#   REGEN_SECRETS=1 scripts/ci/run-csp-e2e.sh # 强制重写 .env.csp-e2e
#   改 front-url / 复用旧 docker/.env.csp-e2e 后建议 REGEN_SECRETS=1（口令与 Origin 对齐）
#
# 环境变量：
#   MUGSUN_PC_PORT   宿主机端口（默认 3094，对齐 playwright.csp.config.ts）
#   WAIT_TIMEOUT     compose --wait 超时秒（默认 900）
#   E2E_ADMIN_PASSWORD  若已有 .env 可覆盖；默认读文件里的 MUGSUN_INIT_PASSWORD
#   MUGSUN_DEMO_CSP_PER_IP_PER_MINUTE  CSP 报告限流（默认 30；可调小加速 429 断言）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PARENT="$(cd .. && pwd)"
BOOT_REPO="$PARENT/mugsun-boot"
CORE_REPO="$PARENT/mugsun-core"

die() { echo "run-csp-e2e: $*" >&2; exit 1; }

[[ -d "$BOOT_REPO" ]] || die "缺少平级仓库 $BOOT_REPO（compose.pc.yml 构建 boot / postgres 需要）"
[[ -d "$CORE_REPO" ]] || die "缺少平级仓库 $CORE_REPO（boot Dockerfile 会 mvn install core）"
[[ -f "$BOOT_REPO/scripts/gen-keys.sh" ]] || die "找不到 $BOOT_REPO/scripts/gen-keys.sh"
[[ -f docker/compose.pc.yml && -f docker/compose.csp-e2e.yml ]] || die "缺少 compose 文件"

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-mugsun-csp-e2e}"
export MUGSUN_PC_PORT="${MUGSUN_PC_PORT:-3094}"
# 与 Playwright baseURL / WS Origin 一致用 127.0.0.1（demo F7 按 front-url 放行）
export MUGSUN_FRONT_URL="${MUGSUN_FRONT_URL:-http://127.0.0.1:${MUGSUN_PC_PORT}}"
export MUGSUN_DEMO_WS_ALLOWED_ORIGINS="${MUGSUN_DEMO_WS_ALLOWED_ORIGINS:-$MUGSUN_FRONT_URL}"
export MUGSUN_CAPTCHA_ENABLED="${MUGSUN_CAPTCHA_ENABLED:-false}"
export MUGSUN_CSP_MODE=enforce
export MUGSUN_CSP_REPORT_URI="${MUGSUN_CSP_REPORT_URI:-/api/csp-report}"
export MUGSUN_DEMO_CSP_PER_IP_PER_MINUTE="${MUGSUN_DEMO_CSP_PER_IP_PER_MINUTE:-30}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-900}"
ENV_FILE=docker/.env.csp-e2e
DC=(docker compose -f docker/compose.pc.yml -f docker/compose.csp-e2e.yml --env-file "$ENV_FILE")

cleanup() {
  if [[ "${KEEP:-0}" == 1 ]]; then
    echo ">> KEEP=1：保留 ${COMPOSE_PROJECT_NAME} 栈"
    return 0
  fi
  echo ">> 清理 ${COMPOSE_PROJECT_NAME}"
  "${DC[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ---- 生成一次性密钥（不入库；字母数字口令，Redis 可拼进 URI）----
need_env() {
  [[ -f "$ENV_FILE" && "${REGEN_SECRETS:-0}" != 1 ]] && return 1
  return 0
}

if need_env; then
  echo ">> 生成 $ENV_FILE"
  command -v openssl >/dev/null || die "需要 openssl（生成 SM2/口令）"
  KEYS="$("$BOOT_REPO/scripts/gen-keys.sh" --all)" || die "gen-keys.sh 失败"
  get() { printf '%s\n' "$KEYS" | sed -n "s/^$1=//p"; }
  DBPW="$(openssl rand -hex 16)"
  SUPERPW="$(openssl rand -hex 16)"
  REDISPW="$(openssl rand -hex 16)"
  INIT_PW="$(get MUGSUN_INIT_PASSWORD)"
  [[ ${#INIT_PW} -ge 8 ]] || die "MUGSUN_INIT_PASSWORD 生成失败"
  umask 077
  cat > "$ENV_FILE" <<CSPENV
MUGSUN_DB_PASSWORD=$DBPW
MUGSUN_POSTGRES_SUPER_PASSWORD=$SUPERPW
MUGSUN_REDIS_PASSWORD=$REDISPW
MUGSUN_INIT_PASSWORD=$INIT_PW
MUGSUN_SM4_KEY=$(get MUGSUN_SM4_KEY)
MUGSUN_API_KEY=$(get MUGSUN_API_KEY)
MUGSUN_SM2_PRIVATE_KEY=$(get MUGSUN_SM2_PRIVATE_KEY)
MUGSUN_SM2_PUBLIC_KEY=$(get MUGSUN_SM2_PUBLIC_KEY)
MUGSUN_SIGN_PRIVATE_KEY=$(get MUGSUN_SIGN_PRIVATE_KEY)
MUGSUN_SIGN_PUBLIC_KEY=$(get MUGSUN_SIGN_PUBLIC_KEY)
MUGSUN_PC_PORT=$MUGSUN_PC_PORT
MUGSUN_FRONT_URL=$MUGSUN_FRONT_URL
MUGSUN_DEMO_WS_ALLOWED_ORIGINS=$MUGSUN_DEMO_WS_ALLOWED_ORIGINS
MUGSUN_CAPTCHA_ENABLED=$MUGSUN_CAPTCHA_ENABLED
MUGSUN_CSP_MODE=enforce
MUGSUN_CSP_REPORT_URI=$MUGSUN_CSP_REPORT_URI
MUGSUN_DEMO_CSP_PER_IP_PER_MINUTE=$MUGSUN_DEMO_CSP_PER_IP_PER_MINUTE
CSPENV
  echo ">> wrote ${ENV_FILE} (do not commit)"
else
  echo ">> reuse ${ENV_FILE} (REGEN_SECRETS=1 to rewrite)"
fi

# 从 env 文件导出管理员口令给 Playwright
# shellcheck disable=SC1090
set -a
# 只导出我们需要的键，避免 source 整文件时污染
E2E_ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-$(sed -n 's/^MUGSUN_INIT_PASSWORD=//p' "$ENV_FILE")}"
set +a
export E2E_ADMIN_PASSWORD
[[ -n "$E2E_ADMIN_PASSWORD" ]] || die "E2E_ADMIN_PASSWORD / MUGSUN_INIT_PASSWORD 为空"

echo ">> 起栈（项目 ${COMPOSE_PROJECT_NAME}，端口 ${MUGSUN_PC_PORT}，CSP enforce + demo 收集端/F7）"
"${DC[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${DC[@]}" up -d --build --wait --wait-timeout "$WAIT_TIMEOUT"

# 导出真实容器名（项目名 mugsun-csp-e2e ≠ helpers 默认 mugsun-redis / mugsun-pg）
E2E_REDIS_CONTAINER="$("${DC[@]}" ps --format '{{.Name}}' redis | head -n1)"
E2E_PG_CONTAINER="$("${DC[@]}" ps --format '{{.Name}}' postgres | head -n1)"
E2E_BOOT_CONTAINER="$("${DC[@]}" ps --format '{{.Name}}' boot | head -n1)"
[[ -n "$E2E_REDIS_CONTAINER" ]] || die "未能解析 redis 容器名（compose ps redis）"
[[ -n "$E2E_PG_CONTAINER" ]] || die "未能解析 postgres 容器名（compose ps postgres）"
[[ -n "$E2E_BOOT_CONTAINER" ]] || die "未能解析 boot 容器名（compose ps boot）"
export E2E_REDIS_CONTAINER E2E_PG_CONTAINER E2E_BOOT_CONTAINER
E2E_DB_PASSWORD="$(sed -n 's/^MUGSUN_DB_PASSWORD=//p' "$ENV_FILE")"
export E2E_DB_PASSWORD
echo ">> 容器：redis=${E2E_REDIS_CONTAINER} postgres=${E2E_PG_CONTAINER} boot=${E2E_BOOT_CONTAINER}"

base="http://127.0.0.1:${MUGSUN_PC_PORT}"
echo ">> 等待后端经 nginx 就绪：$base/api/auth/captcha/config"
deadline=$((SECONDS + WAIT_TIMEOUT))
ready=0
while (( SECONDS < deadline )); do
  if code=$(curl -fsS -o /tmp/csp-captcha.json -w '%{http_code}' \
      "$base/api/auth/captcha/config?scene=login&clientId=web&tenantId=000000" 2>/dev/null); then
    if [[ "$code" == 200 ]] && grep -q '"enabled"[[:space:]]*:[[:space:]]*false' /tmp/csp-captcha.json 2>/dev/null; then
      ready=1
      break
    fi
    # enabled 仍为 true：配置未生效，直接失败便于排查
    if [[ "$code" == 200 ]] && grep -q '"enabled"[[:space:]]*:[[:space:]]*true' /tmp/csp-captcha.json 2>/dev/null; then
      die "验证码仍为开启（期望 MUGSUN_CAPTCHA_ENABLED=false）。响应：$(cat /tmp/csp-captcha.json)"
    fi
  fi
  sleep 5
done
[[ "$ready" == 1 ]] || die "等待后端就绪超时（${WAIT_TIMEOUT}s）。可 KEEP=1 后 docker compose -p ${COMPOSE_PROJECT_NAME} logs boot"

# #81：种子 admin must_change_password=1；e2e 用固定口令巡菜单，登录前清标记（同 boot AbstractIntegrationTest）
echo ">> 清除平台 admin 强制改密标记"
"${DC[@]}" exec -T postgres \
  env PGPASSWORD="$(sed -n 's/^MUGSUN_DB_PASSWORD=//p' "$ENV_FILE")" \
  psql -U mugsun -d mugsun -v ON_ERROR_STOP=1 \
  -c "UPDATE sys_user SET must_change_password = 0 WHERE username = 'admin' AND tenant_id = '000000' AND is_deleted = 0;" \
  >/dev/null

# 校验 enforce CSP 头已下发，且含 report-uri（项11）
hdr=$(curl -fsSI "$base/" || true)
echo "$hdr" | grep -qi '^content-security-policy:' \
  || die "首页缺少 Content-Security-Policy 头（enforce）。响应头：$hdr"
echo "$hdr" | grep -qi 'report-uri.*/api/csp-report' \
  || die "CSP 头缺少 report-uri /api/csp-report。响应头：$hdr"

# 收集端应已装配（demo）；未开 demo 时为 404
probe=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$base/api/csp-report" \
  -H 'Content-Type: application/csp-report' \
  --data '{"csp-report":{"effective-directive":"script-src","blocked-uri":"inline"}}' || true)
[[ "$probe" == "204" || "$probe" == "429" ]] \
  || die "POST /api/csp-report 期望 204/429（demo 收集端），实际 HTTP $probe"

echo ">> 跑 Playwright CSP e2e（E2E_BASE_URL=$base）"
mkdir -p test-results/csp
export E2E_BASE_URL="$base"
export CSP_SHOTS_DIR="${CSP_SHOTS_DIR:-test-results/csp}"
pnpm exec playwright test -c playwright.csp.config.ts

[[ -s test-results/csp/result.json ]] \
  || die "缺少 test-results/csp/result.json（spec afterAll 应写出）"
echo ">> PASS CSP e2e；结果 $CSP_SHOTS_DIR/result.json"
