#!/usr/bin/env bash
# 扫 dist/assets/*.js 的 `new Function` / `eval(` / `\bFunction(`（Issue #64，安全官对 #61 复审 F4；合后跟加固）。
#
# 目标：确认 __INTLIFY_JIT_COMPILATION__ 后 vue-i18n 编译路径不再把 new Function 打进产物；
# 已知第三方（Cesium / form-create / echarts / hogan / source-map-js）按 chunk 白名单放行。
#
# 硬失败（白名单不可覆盖）：
#   1) dist/index.html 入口 module script 所在 chunk
#   2) 含 vue-i18n / @intlify / compileToFunction 标记的 chunk
#
# 白名单假冒防护（合后跟 P2）：
#   前缀命中（Cesium-*.js 等）还须通过轻量内容指纹；缺库特征 → 失败，不静默放行。
#   指纹钉库内稳定标记，不钉 content-hash 文件名。
#
# Function( 变体（合后跟 P3）：
#   另扫词边界 `\bFunction(`，堵住 `Function("...")()`；忽略常见良性
#   `Function("return this")`（lodash / 旧 UMD 取全局）。
#
# 用法（仓库根目录，需已有 dist）：
#   scripts/ci/check-dist-no-eval.sh
#   DIST_DIR=dist scripts/ci/check-dist-no-eval.sh
#
# 负向夹具（应 FAIL）：
#   DIST_DIR=scripts/ci/fixtures/dist-no-eval/fake-prefix \
#     scripts/ci/check-dist-no-eval.sh
#   DIST_DIR=scripts/ci/fixtures/dist-no-eval/bare-function \
#     scripts/ci/check-dist-no-eval.sh
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

# 前缀白名单命中后的内容指纹（缺则视为假冒前缀，失败）
# 标记取自真实 dist / node_modules 抽样，避免钉 hash。
prefix_fingerprint_ok() {
  local base="$1" file="$2"
  case "$base" in
    Cesium-*.js|cesium-*.js)
      grep -q 'Cesium' "$file" \
        && grep -qE 'RequestScheduler|Cartesian3' "$file"
      return $?
      ;;
    form-create-*.js)
      # formCreate 为包稳定 API；再要 PREFIX / FcDesigner / parseFn 之一防空壳假冒
      grep -q 'formCreate' "$file" \
        && grep -qE 'FORM-CREATE-PREFIX|FcDesigner|parseFn' "$file"
      return $?
      ;;
    installCanvasRenderer-*.js|echarts-*.js)
      # installCanvasRenderer 真 chunk 含 GeoJSON 兜底；小 stub 无 PATTERN 不会走到这里
      grep -qi 'echarts' "$file" && grep -q 'GeoJSON' "$file"
      return $?
      ;;
    source-map-*.js)
      grep -qE 'SourceMapConsumer|doQuickSort' "$file"
      return $?
      ;;
    hogan-*.js)
      grep -q 'makePartials' "$file" && grep -q 'wrapMain' "$file" && grep -qi 'hogan' "$file"
      return $?
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

# 命中检测：new Function / eval( / 词边界 Function(
# 从副本中剔除良性 Function("return this") 后再判，降低 lodash/UMD 假阳
file_has_forbidden() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"
  # 去掉 return-this 取全局的常见写法（双/单引号）
  sed -E \
    -e 's/Function\(["'\'']return this["'\'']\)//g' \
    "$file" >"$tmp"
  if grep -qE 'new Function|eval\(|(^|[^[:alnum:]_])Function\(' "$tmp"; then
    rm -f "$tmp"
    return 0
  fi
  rm -f "$tmp"
  return 1
}

# 汇总命中种类（已忽略 return-this）
summarize_hits() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"
  sed -E \
    -e 's/Function\(["'\'']return this["'\'']\)//g' \
    "$file" >"$tmp"
  # 先抽出 new Function，再抽剩余 Function(，避免重复计 new 的 Function
  {
    grep -oE 'new Function' "$tmp" || true
    # 去掉 new Function 后再找裸 Function(
    sed -E 's/new Function//g' "$tmp" \
      | grep -oE '(^|[^[:alnum:]_])Function\(' \
      | sed -E 's/^[^F]*//' || true
    grep -oE 'eval\(' "$tmp" || true
  } | sort | uniq -c | awk '{c=$1; $1=""; sub(/^ /,""); printf "%sx %s ", c, $0}' | sed 's/[[:space:]]*$//'
  rm -f "$tmp"
}

shopt -s nullglob
files=("$ASSETS"/*.js)
[[ ${#files[@]} -gt 0 ]] || die "${ASSETS} 下没有 .js"

allowed=0
failed=0
clean=0
declare -a FAIL_MSGS=()

for file in "${files[@]}"; do
  base="$(basename "$file")"
  if ! file_has_forbidden "$file"; then
    clean=$((clean + 1))
    continue
  fi

  hits="$(summarize_hits "$file")"
  [[ -n "$hits" ]] || hits="(pattern)"
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
    if ! prefix_fingerprint_ok "$base" "$file"; then
      FAIL_MSGS+=("${base}: 命中 [${hits}] — 前缀像白名单（${reason}）但缺库内容指纹（疑假冒，拒绝放行）")
      failed=$((failed + 1))
      continue
    fi
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
