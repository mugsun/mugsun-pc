import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, withDirectives, resolveDirective, type App } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'

/**
 * 按钮权限（P0）：
 * 1. 源码层：导入/导出/删除按钮都挂了以后端 @SaCheckPermission 为准的权限码；
 * 2. 行为层：v-perm 在没有权限时隐藏用户导出按钮，有权限时显示。
 */
const owned: { buttons: string[] } = { buttons: [] }
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({ getUserInfo: { buttons: owned.buttons, roles: [] } })
}))

import { setupPermDirective } from '@/directives/core/perm'

type Node = {
  type: number
  tag?: string
  props?: any[]
  children?: Node[]
  loc: { source: string }
}

function findButtons(file: string): Node[] {
  const src = readFileSync(resolve(__dirname, '../../../', file), 'utf8')
  const { descriptor } = parse(src)
  const out: Node[] = []
  const walk = (n: Node) => {
    if (n.type === 1 && (n.tag === 'ElButton' || n.tag === 'el-button')) out.push(n)
    n.children?.forEach(walk)
  }
  walk(descriptor.template!.ast as unknown as Node)
  return out
}

function permOf(btn: Node): string | undefined {
  const d = btn.props?.find((p) => p.type === 7 && p.name === 'perm')
  return d?.exp?.content
}

function byClick(file: string, handler: string): Node {
  const btn = findButtons(file).find((b) =>
    b.props?.some((p) => p.type === 7 && p.name === 'on' && p.exp?.content === handler)
  )
  expect(btn, `${file} 找不到 @click=${handler}`).toBeTruthy()
  return btn!
}

describe('按钮权限码与后端对齐', () => {
  it.each([
    ['src/views/system/user/index.vue', 'handleExport', "'sys:user:list'"],
    ['src/views/system/user/index.vue', 'deleteSelected', "'sys:user:remove'"],
    ['src/views/system/user/index.vue', 'importVisible = true', "'sys:user:add'"],
    [
      'src/views/system/region/index.vue',
      'doExport',
      "['sys:region:save', 'sys:region:remove', 'sys:region:import']"
    ],
    ['src/views/system/attach/index.vue', 'deleteSelected', "'sys:file:remove'"],
    ['src/views/system/customer/index.vue', 'remove(row)', "'sys:customer:remove'"]
  ])('%s @click=%s → v-perm=%s', (file, handler, code) => {
    expect(permOf(byClick(file, handler))).toBe(code)
  })

  it('附件表格行删除用 hasPerm(sys:file:remove) 包住', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../src/views/system/attach/index.vue'),
      'utf8'
    )
    expect(src).toMatch(
      /hasPerm\('sys:file:remove'\)\s*\?\s*h\(\s*ElButton[\s\S]*?deleteRow\(row\)/
    )
  })
})

describe('v-perm 控制用户导出按钮显隐', () => {
  let app: App | null = null
  afterEach(() => {
    app?.unmount()
    app = null
    document.body.innerHTML = ''
  })

  async function mountExport(): Promise<HTMLButtonElement> {
    const el = document.createElement('div')
    document.body.appendChild(el)
    app = createApp({
      render() {
        const perm = resolveDirective('perm')!
        return withDirectives(h('button', { class: 'export-btn' }, '导出'), [
          [perm, 'sys:user:list']
        ])
      }
    })
    setupPermDirective(app)
    app.mount(el)
    await nextTick()
    return el.querySelector('.export-btn') as HTMLButtonElement
  }

  it('没有权限时不显示', async () => {
    owned.buttons = ['sys:user:add']
    expect((await mountExport()).style.display).toBe('none')
  })

  it('有 sys:user:list 时显示', async () => {
    owned.buttons = ['sys:user:list']
    expect((await mountExport()).style.display).toBe('')
  })

  it('超管通配时显示', async () => {
    owned.buttons = ['*:*:*']
    expect((await mountExport()).style.display).toBe('')
  })
})
