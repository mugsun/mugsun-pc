#!/usr/bin/env bash
# 对照 mugsun-boot 种子 SQL 的菜单图标与 pc 离线图标集（Issue #62）。
#
# 从 boot 仓 Flyway/模块种子抽出全部 Iconify `prefix:name`，要求每个都出现在
# scripts/offline-icons.extra.txt **或** src/assets/icons/offline-icons.json
# （并集覆盖；缺任一即 CSP 下菜单空白）。extra 相对 boot 的多余项仅警告。
#
# 用法（仓库根目录）：
#   scripts/ci/check-offline-icons-vs-boot.sh
#   BOOT_DIR=~/opc/java/mugsun/mugsun-boot scripts/ci/check-offline-icons-vs-boot.sh
#   BOOT_DIR=../mugsun-boot BOOT_REF=origin/main scripts/ci/check-offline-icons-vs-boot.sh
#
# 环境变量：
#   BOOT_DIR   boot 仓根目录。未设时依次试：同级 ../mugsun-boot、./mugsun-boot、
#              $HOME/opc/java/mugsun/mugsun-boot
#   BOOT_REF   若 BOOT_DIR 是 git 仓且该 ref 可解析，则在该树上读 SQL（默认 origin/main）；
#              设为空字符串则用工作区当前文件（CI sparse checkout 后常用）
#   EXTRA_TXT  默认 scripts/offline-icons.extra.txt
#   OFFLINE_JSON 默认 src/assets/icons/offline-icons.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EXTRA_TXT="${EXTRA_TXT:-scripts/offline-icons.extra.txt}"
OFFLINE_JSON="${OFFLINE_JSON:-src/assets/icons/offline-icons.json}"
# 默认钉 boot tip 语义：origin/main；CI 已 checkout 到 BOOT_DIR 时设 BOOT_REF=
BOOT_REF="${BOOT_REF-origin/main}"

die() { echo "check-offline-icons-vs-boot: $*" >&2; exit 1; }
log() { echo "check-offline-icons-vs-boot: $*"; }

resolve_boot_dir() {
  if [[ -n "${BOOT_DIR:-}" ]]; then
    [[ -d "$BOOT_DIR" ]] || die "BOOT_DIR 不存在: $BOOT_DIR"
    (cd "$BOOT_DIR" && pwd)
    return
  fi
  local cand
  for cand in \
    "$ROOT/../mugsun-boot" \
    "$ROOT/mugsun-boot" \
    "${HOME}/opc/java/mugsun/mugsun-boot"
  do
    if [[ -d "$cand" ]]; then
      (cd "$cand" && pwd)
      return
    fi
  done
  die "找不到 mugsun-boot。请设 BOOT_DIR，或把仓放在同级 ../mugsun-boot"
}

BOOT_DIR="$(resolve_boot_dir)"
[[ -f "$ROOT/$EXTRA_TXT" ]] || die "缺少 $EXTRA_TXT"
[[ -f "$ROOT/$OFFLINE_JSON" ]] || die "缺少 $OFFLINE_JSON"

log "BOOT_DIR=$BOOT_DIR BOOT_REF=${BOOT_REF:-<worktree>} EXTRA=$EXTRA_TXT JSON=$OFFLINE_JSON"

export BOOT_DIR BOOT_REF ROOT EXTRA_TXT OFFLINE_JSON
python3 - <<'PY'
import json, os, re, subprocess, sys
from pathlib import Path

boot_dir = Path(os.environ["BOOT_DIR"])
boot_ref = os.environ.get("BOOT_REF", "")  # empty => worktree files
root = Path(os.environ["ROOT"])
extra_path = root / os.environ["EXTRA_TXT"]
json_path = root / os.environ["OFFLINE_JSON"]

# Iconify 前缀：与 gen-offline-icons / offline-icons 单测已知集对齐，并覆盖菜单常见集
ICON_PREFIXES = {
    "ri", "ep", "mdi", "fluent", "solar", "icon-park-outline", "vaadin", "ix",
    "iconamoon", "carbon", "tabler", "lucide", "material-symbols",
}
# 单段 prefix:name；多段 permission（sys:user:list）靠「后接 :」排除
TOKEN_RE = re.compile(
    r"""['"]([a-z][a-z0-9]*(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)['"]"""
)

SKIP_DIR_PARTS = {
    "migration-dm", "migration-og", "target", "released", "node_modules", ".git",
}


def list_sql_via_git(ref: str) -> list[tuple[str, str]]:
    """Return [(path, text), ...] for src/main/resources/db/**/*.sql at ref."""
    out = subprocess.check_output(
        ["git", "-C", str(boot_dir), "ls-tree", "-r", "--name-only", ref],
        text=True,
    )
    paths = [
        p for p in out.splitlines()
        if p.endswith(".sql") and "/src/main/resources/db/" in p
    ]
    files = []
    for p in paths:
        parts = set(p.split("/"))
        if parts & SKIP_DIR_PARTS:
            continue
        text = subprocess.check_output(
            ["git", "-C", str(boot_dir), "show", f"{ref}:{p}"],
            text=True,
            errors="replace",
        )
        files.append((p, text))
    return files


def list_sql_worktree() -> list[tuple[str, str]]:
    files = []
    for sql in boot_dir.glob("**/src/main/resources/db/**/*.sql"):
        parts = set(sql.parts)
        if parts & SKIP_DIR_PARTS:
            continue
        rel = str(sql.relative_to(boot_dir))
        files.append((rel, sql.read_text(encoding="utf-8", errors="replace")))
    return files


def extract_icons(files: list[tuple[str, str]]) -> tuple[set[str], dict[str, set[str]]]:
    icons: set[str] = set()
    by_file: dict[str, set[str]] = {}
    for path, text in files:
        found: set[str] = set()
        for m in TOKEN_RE.finditer(text):
            prefix, name = m.group(1), m.group(2)
            if prefix not in ICON_PREFIXES:
                continue
            # 排除 'sys:user:list' 这类被截成 sys:user 的多段
            if text[m.end() : m.end() + 1] == ":":
                continue
            tok = f"{prefix}:{name}"
            found.add(tok)
            icons.add(tok)
        if found:
            by_file[path] = found
    return icons, by_file


def load_extra(path: Path) -> set[str]:
    out: set[str] = set()
    line_re = re.compile(
        r"^([a-z][a-z0-9]*(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        m = line_re.match(t)
        if m:
            out.add(f"{m.group(1)}:{m.group(2)}")
    return out


def load_json_icons(path: Path) -> set[str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: set[str] = set()
    if not isinstance(data, list):
        raise SystemExit(f"check-offline-icons-vs-boot: {path} 应为数组")
    for item in data:
        prefix = item.get("prefix")
        if not prefix:
            continue
        for name in (item.get("icons") or {}):
            out.add(f"{prefix}:{name}")
        for name in (item.get("aliases") or {}):
            out.add(f"{prefix}:{name}")
    return out


# Resolve SQL corpus
if boot_ref:
    # ensure ref exists
    r = subprocess.run(
        ["git", "-C", str(boot_dir), "rev-parse", "--verify", boot_ref],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(
            f"check-offline-icons-vs-boot: 无法解析 BOOT_REF={boot_ref!r}（先 git fetch）",
            file=sys.stderr,
        )
        sys.exit(1)
    tip = r.stdout.strip()
    print(f"check-offline-icons-vs-boot: boot {boot_ref} -> {tip}")
    files = list_sql_via_git(boot_ref)
else:
    print("check-offline-icons-vs-boot: 使用 BOOT_DIR 工作区文件（BOOT_REF 为空）")
    files = list_sql_worktree()

if not files:
    print("check-offline-icons-vs-boot: 未找到任何种子 SQL", file=sys.stderr)
    sys.exit(1)

boot_icons, by_file = extract_icons(files)
extra = load_extra(extra_path)
offline = load_json_icons(json_path)
covered = extra | offline

print(
    f"check-offline-icons-vs-boot: SQL 文件 {len(files)}，"
    f"含图标的文件 {len(by_file)}，boot 图标 {len(boot_icons)}，"
    f"extra {len(extra)}，json {len(offline)}，并集 {len(covered)}"
)
for p, s in sorted(by_file.items(), key=lambda x: (-len(x[1]), x[0])):
    print(f"  {len(s):3d}  {p}")

missing = sorted(boot_icons - covered)
extra_only = sorted(extra - boot_icons)

if extra_only:
    print(
        f"check-offline-icons-vs-boot: warn extra 相对 boot 多余 {len(extra_only)} 项（不挡合）:"
    )
    for t in extra_only:
        print(f"  + {t}")

if missing:
    print(
        f"check-offline-icons-vs-boot: FAIL 种子图标未进 extra.txt∪offline-icons.json "
        f"（{len(missing)}）:"
    )
    for t in missing:
        print(f"  - {t}")
    print(
        "补齐：写入 scripts/offline-icons.extra.txt 后运行 scripts/gen-offline-icons.mjs，"
        "并提交生成的 src/assets/icons/offline-icons.json。"
    )
    sys.exit(1)

print("check-offline-icons-vs-boot: OK 全部 boot 种子菜单图标已覆盖")
sys.exit(0)
PY
