#!/usr/bin/env bash
# 扫 dist/assets/*.js 的 `new Function` / `eval(`（Issue #64，安全官对 #61 复审 F4）。
#
# 目标：确认 __INTLIFY_JIT_COMPILATION__ 后 vue-i18n 编译路径不再把 new Function 打进产物；
# 已知第三方（Cesium / form-create / echarts / hogan / source-map-js）按 chunk 白名单放行。
#
# 硬失败（白名单不可覆盖）：
#   1) dist/index.html 入口 module script 所在 chunk
#   2) 含 vue-i18n / @intlify / compileToFunction 标记的 chunk
#
# 用法（仓库根目录，需已有 dist）：
#   scripts/ci/check-dist-no-eval.sh
#   DIST_DIR=dist scripts/ci/check-dist-no-eval.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
DIST_DIR="${DIST_DIR:-dist}"
ASSETS="${DIST_DIR}/assets"
INDEX_HTML="${DIST_DIR}/index.html"

die() { echo "check-dist-no-eval: $*" >&2; exit 1; }
log() { echo "check-dist-no-eval: $*"; }

[[ -d "$ASSETS" ]] || die "缺少 ${ASSETS}（先 vite build）"
[[ -f "$INDEX_HTML" ]] || die "缺少 ${INDEX_HTML}"

# ---- 入口 chunk（index.html 的 type=module script）----
# shellcheck disable=SC2016
mapfile -t ENTRY_BASENAMES < <(
  # 兼容 /assets/xxx.js 与 ./assets/xxx.js
  grep -oE 'src="[^"]*assets/[^"]+\.js"' "$INDEX_HTML" \
    | sed -E 's/.*assets\///; s/"$//' \
    | sort -u
)
[[ ${#ENTRY_BASENAMES[@]} -gt 0 ]] || die "未能从 ${INDEX_HTML} 解析入口 script"

is_entry() {
  local base="$1" e
  for e in "${ENTRY_BASENAMES[@]}"; do
    [[ "$base" == "$e" ]] && return 0
  done
  return 1
}

# ---- 白名单：稳定文件名前缀 → 来源说明（Issue #64 / #61）----
# 不要钉死带 content-hash 的完整文件名。
whitelist_reason() {
  local base="$1"
  case "$base" in
    Cesium-*.js|cesium-*.js)
      # Cesium：Workers / 动态求值路径含 new Function；CSP enforce 下已知限制（#61/#64）
      echo "Cesium（#61/#64 已知第三方）"
      return 0
      ;;
    form-create-*.js)
      # @form-create/designer：规则函数/条件/公式用 new Function；e2e 已登记 script-src eval
      echo "@form-create/designer（#61/#64 已知第三方；e2e KNOWN）"
      return 0
      ;;
    installCanvasRenderer-*.js|echarts-*.js)
      # echarts canvas：geoJSON 解析兜底 new Function
      echo "echarts geoJSON 兜底（#61/#64 已知第三方）"
      return 0
      ;;
    source-map-*.js)
      # source-map-js：埋点堆栈还原懒加载（stack-restore.vue）
      echo "source-map-js 堆栈还原懒加载（#64 登记）"
      return 0
      ;;
    hogan-*.js)
      echo "@profoundlogic/hogan via diff2html（#61/#64 已知第三方）"
      return 0
      ;;
  esac
  return 1
}

# Vite 偶发把 hogan 打成 index-*.js：用内容指纹认库，避免钉 hash。
content_whitelist_reason() {
  local file="$1"
  # Hogan.js codegen：makePartials + new Function("c","p","i",...)
  if grep -q 'makePartials' "$file" && grep -q 'wrapMain' "$file" && grep -qi 'hogan' "$file"; then
    echo "@profoundlogic/hogan via diff2html（内容识别；#61/#64）"
    return 0
  fi
  return 1
}

# vue-i18n / intlify：出现即视为敏感 chunk（与入口一样不可被白名单放行）
is_i18n_sensitive() {
  local file="$1"
  grep -qE 'vue-i18n|@intlify|compileToFunction' "$file"
}

PATTERN='new Function|eval\('
shopt -s nullglob
files=("$ASSETS"/*.js)
[[ ${#files[@]} -gt 0 ]] || die "${ASSETS} 下没有 .js"

allowed=0
failed=0
clean=0
declare -a FAIL_MSGS=()

for file in "${files[@]}"; do
  base="$(basename "$file")"
  if ! grep -qE "$PATTERN" "$file"; then
    clean=$((clean + 1))
    continue
  fi

  hits="$(grep -oE "$PATTERN" "$file" | sort | uniq -c | awk '{c=$1; $1=""; sub(/^ /,""); printf "%sx %s ", c, $0}' | sed 's/[[:space:]]*$//')"
  entry=0
  i18n=0
  is_entry "$base" && entry=1
  is_i18n_sensitive "$file" && i18n=1

  if [[ "$entry" -eq 1 || "$i18n" -eq 1 ]]; then
    why=()
    [[ "$entry" -eq 1 ]] && why+=("入口 chunk")
    [[ "$i18n" -eq 1 ]] && why+=("含 vue-i18n/@intlify/compileToFunction")
    FAIL_MSGS+=("${base}: 命中 [${hits}] — ${why[*]}，禁止（白名单不可覆盖）")
    failed=$((failed + 1))
    continue
  fi

  reason=""
  if reason="$(whitelist_reason "$base")"; then
    log "允许 ${base} [${hits}] — ${reason}"
    allowed=$((allowed + 1))
    continue
  fi
  if reason="$(content_whitelist_reason "$file")"; then
    log "允许 ${base} [${hits}] — ${reason}"
    allowed=$((allowed + 1))
    continue
  fi

  FAIL_MSGS+=("${base}: 命中 [${hits}] — 不在白名单（请确认来源后登记，或修掉）")
  failed=$((failed + 1))
done

log "入口: ${ENTRY_BASENAMES[*]}"
log "扫描 $((allowed + failed + clean)) 个 js：干净 ${clean}，白名单放行 ${allowed}，失败 ${failed}"

if [[ "$failed" -gt 0 ]]; then
  for m in "${FAIL_MSGS[@]}"; do
    echo "check-dist-no-eval: FAIL $m" >&2
  done
  exit 1
fi

log "OK"
