/**
 * 只做分组、自己没有页面的菜单目录：后端菜单表里只有中文名，目录又不在前端路由里，
 * 靠模块登记的「全路径 → menus.* 文案键」换标题，英文界面才不会露出中文目录名。
 */
import { describe, expect, it, vi } from 'vitest'

const stub = vi.hoisted(() => ({ fetchMenus: vi.fn() }))
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({ info: { roles: ['R_SUPER'] } })
}))
vi.mock('@/hooks/core/useAppMode', () => ({
  useAppMode: () => ({ isFrontendMode: { value: false } })
}))
vi.mock('@/api/system-manage', () => ({ fetchGetMenuList: stub.fetchMenus }))
vi.mock('@/utils', () => ({ formatMenuTitle: (title: string) => title }))

import { MenuProcessor } from '@/router/core/MenuProcessor'
import { menuGroupTitles } from '@/router/modules'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'

/** 按 a.b.c 取语言文件里的文案 */
const textOf = (msgs: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], msgs)

/** 后端菜单接口返回的样子：目录是相对路径、没有组件，标题是菜单表里的中文名 */
const backendMenus = () => [
  {
    path: '/ai',
    name: 'Ai',
    component: '/index/index',
    meta: { title: 'AI' },
    children: [
      {
        path: 'app-group',
        name: 'AiAppGroup',
        component: '',
        meta: { title: 'AI 应用' },
        children: [
          {
            path: '/ai/assistant',
            name: 'AiAssistant',
            component: '/ai/assistant',
            meta: { title: '机器人助手' }
          }
        ]
      },
      {
        path: 'my-group',
        name: 'AiMyGroup',
        component: '',
        meta: { title: '自建分组' },
        children: [
          {
            path: 'my-page',
            name: 'AiMyPage',
            component: '/ai/my-page',
            meta: { title: '自建页面' }
          }
        ]
      }
    ]
  }
]

describe('菜单目录的标题', () => {
  it('AI 模块的四个目录都登记了文案键', () => {
    expect(menuGroupTitles).toMatchObject({
      '/ai/app-group': 'menus.ai.groupApp',
      '/ai/tool-group': 'menus.ai.groupTool',
      '/ai/ops-group': 'menus.ai.groupOps',
      '/ai/gen-group': 'menus.ai.groupGen'
    })
  })

  it('登记的文案键在中英文语言文件里都有，英文里不带中文', () => {
    for (const key of Object.values(menuGroupTitles)) {
      expect(textOf(zh, key), `zh.json 缺 ${key}`).toEqual(expect.any(String))
      const enText = textOf(en, key)
      expect(enText, `en.json 缺 ${key}`).toEqual(expect.any(String))
      expect(String(enText)).not.toMatch(/[\u4e00-\u9fff]/)
    }
  })

  it('后端菜单里登记过的目录换成文案键，没登记的目录保留后端名称', async () => {
    stub.fetchMenus.mockResolvedValue(backendMenus())

    const list = await new MenuProcessor().getMenuList()
    const ai = list.find((item) => item.path === '/ai')

    const registered = ai?.children?.find((item) => item.path === '/ai/app-group')
    expect(registered?.meta.title).toBe('menus.ai.groupApp')
    // 目录没有页面：只换标题，名字仍用后端给的
    expect(registered?.name).toBe('AiAppGroup')
    // 目录下的页面照旧按前端路由对齐标题
    expect(registered?.children?.[0]?.meta.title).toBe('menus.ai.assistant')

    const custom = ai?.children?.find((item) => item.path === '/ai/my-group')
    expect(custom?.meta.title).toBe('自建分组')
    expect(custom?.children?.[0]?.meta.title).toBe('自建页面')
  })
})
