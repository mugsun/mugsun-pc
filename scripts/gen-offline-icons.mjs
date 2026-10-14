/**
 * 生成离线图标子集：src/assets/icons/offline-icons.json
 *
 * 扫描 src/、modules/ 里出现的 Iconify 图标名（prefix:name），加上 scripts/offline-icons.extra.txt
 * （后端菜单种子数据等源码里看不到的图标，每行一个），从 @iconify-json/<prefix> 里只抽取用到的图标。
 * 运行时不再请求 api.iconify.design（CSP connect-src 只放行 'self'）。
 *
 * 用法（图标数据包不进项目依赖，临时目录装一次即可）：
 *   npm i --prefix /tmp/iconify-json --save-exact @iconify-json/ri@1.2.10 @iconify-json/fluent@1.2.60 \
 *     @iconify-json/solar@1.2.13 @iconify-json/icon-park-outline@1.2.4 @iconify-json/vaadin@1.2.1 \
 *     @iconify-json/ix@1.2.13 @iconify-json/iconamoon@1.2.2
 *   ICONIFY_JSON_DIR=/tmp/iconify-json/node_modules/@iconify-json node scripts/gen-offline-icons.mjs
 *
 * 版本钉死在下面的 PINNED 里，装的版本不一致时直接退出；升级图标集要同时改 PINNED、上面的命令和 NOTICE。
 * 输出里每个图标集都带 info（名称、作者、许可、来源包版本），CC BY 4.0 的署名见 NOTICE。
 *
 * 新增图标后重新运行并提交生成的 JSON；遗漏的图标会显示为空白（不会外联）。
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
/** 图标数据来源包的精确版本（可复现产物）。新增图标集要先在这里登记 */
const PINNED = {
  ri: '1.2.10',
  fluent: '1.2.60',
  solar: '1.2.13',
  'icon-park-outline': '1.2.4',
  vaadin: '1.2.1',
  ix: '1.2.13',
  iconamoon: '1.2.2'
}
const jsonDir = process.env.ICONIFY_JSON_DIR || path.join(root, 'node_modules', '@iconify-json')
// 引号包住的 prefix:name；prefix 是否为图标集由 ICONIFY_JSON_DIR 下是否有对应包决定（其余如 'update:modelValue' 自动忽略）
const re = /['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)['"`]/g
const lineRe = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/

const names = new Set()
function scan(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) scan(p)
    else if (/\.(vue|ts|tsx|js|json)$/.test(ent.name) && !p.endsWith('offline-icons.json')) {
      for (const m of fs.readFileSync(p, 'utf8').matchAll(re)) names.add(`${m[1]}:${m[2]}`)
    }
  }
}
scan(path.join(root, 'src'))
if (fs.existsSync(path.join(root, 'modules'))) scan(path.join(root, 'modules'))
const extra = path.join(root, 'scripts', 'offline-icons.extra.txt')
if (fs.existsSync(extra)) {
  for (const line of fs.readFileSync(extra, 'utf8').split('\n')) {
    const t = line.trim()
    const m = lineRe.exec(t)
    if (m) names.add(`${m[1]}:${m[2]}`)
  }
}

const PREFIXES = [...new Set([...names].map((n) => n.split(':')[0]))]
  .filter((p) => fs.existsSync(path.join(jsonDir, p, 'icons.json')))
  .sort()
const out = []
const missing = []
for (const prefix of PREFIXES) {
  const wanted = [...names]
    .filter((n) => n.startsWith(prefix + ':'))
    .map((n) => n.slice(prefix.length + 1))
  if (!wanted.length) continue
  const pkg = JSON.parse(fs.readFileSync(path.join(jsonDir, prefix, 'package.json'), 'utf8'))
  if (PINNED[prefix] !== pkg.version) {
    console.error(
      `@iconify-json/${prefix} 版本 ${pkg.version} 与 PINNED ${PINNED[prefix] ?? '（未登记）'} 不一致`
    )
    process.exit(1)
  }
  const set = JSON.parse(fs.readFileSync(path.join(jsonDir, prefix, 'icons.json'), 'utf8'))
  const info = JSON.parse(fs.readFileSync(path.join(jsonDir, prefix, 'info.json'), 'utf8'))
  const sub = {
    prefix,
    info: {
      name: info.name,
      author: info.author,
      license: info.license,
      source: `@iconify-json/${prefix}@${pkg.version}`
    },
    icons: {},
    aliases: {}
  }
  for (const k of ['width', 'height', 'left', 'top']) if (set[k] !== undefined) sub[k] = set[k]
  const add = (name) => {
    if (set.icons[name]) sub.icons[name] = set.icons[name]
    else if (set.aliases?.[name]) {
      sub.aliases[name] = set.aliases[name]
      add(set.aliases[name].parent)
    } else return false
    return true
  }
  for (const n of wanted.sort()) if (!add(n)) missing.push(`${prefix}:${n}`)
  if (!Object.keys(sub.aliases).length) delete sub.aliases
  out.push(sub)
}
const target = path.join(root, 'src', 'assets', 'icons', 'offline-icons.json')
fs.writeFileSync(target, JSON.stringify(out) + '\n')
const total = out.reduce(
  (n, set) => n + Object.keys(set.icons).length + Object.keys(set.aliases || {}).length,
  0
)
console.log(`offline icons: ${total} (${PREFIXES.join(', ')}) → ${path.relative(root, target)}`)
// 注释里的示例（如 'ri:xxx'）也会命中，只提示；真实遗漏由 tests 里的离线图标覆盖测试兜底
if (missing.length) console.warn(`图标集里找不到（已忽略）：${missing.join(', ')}`)
