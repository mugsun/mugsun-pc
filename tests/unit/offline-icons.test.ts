import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import offlineIcons from '@/assets/icons/offline-icons.json'

/**
 * CSP 下运行时不能请求 api.iconify.design：源码里用到的每个图标都必须在离线子集里，
 * 漏了就是空白图标。新增图标后运行 scripts/gen-offline-icons.mjs 重新生成。
 */
const root = path.resolve(__dirname, '../..')
const sets = offlineIcons as unknown as {
  prefix: string
  icons: Record<string, unknown>
  aliases?: Record<string, unknown>
}[]
const prefixes = new Set(sets.map((s) => s.prefix))
const has = (prefix: string, name: string) => {
  const set = sets.find((s) => s.prefix === prefix)
  return !!set && (name in set.icons || name in (set.aliases || {}))
}

// 已知会被当成图标集前缀的写法：只有这些前缀才算图标；其余（update:modelValue 等）忽略
const KNOWN_ICON_PREFIXES = new Set([
  ...prefixes,
  'mdi',
  'ep',
  'carbon',
  'tabler',
  'lucide',
  'material-symbols'
])
const re = /['"`]([a-z][a-z0-9]*(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)['"`]/g

function collect(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) collect(p, out)
    else if (/\.(vue|ts|tsx)$/.test(ent.name)) out.push(p)
  }
  return out
}

describe('离线图标子集', () => {
  it('源码里引用的图标都已收录（否则 CSP 下显示空白）', () => {
    const missing = new Set<string>()
    const files = [...collect(path.join(root, 'src')), ...collect(path.join(root, 'modules'))]
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(re)) {
        if (!KNOWN_ICON_PREFIXES.has(m[1]) || m[2] === 'xxx') continue
        if (!has(m[1], m[2])) missing.add(`${m[1]}:${m[2]} (${path.relative(root, f)})`)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('后端菜单种子图标（offline-icons.extra.txt）都已收录', () => {
    const extra = fs.readFileSync(path.join(root, 'scripts/offline-icons.extra.txt'), 'utf8')
    const missing = extra
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .filter((l) => {
        const [p, n] = l.split(':')
        return !has(p, n)
      })
    expect(missing).toEqual([])
  })
})
