import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  DRAWER_WIDTH_DEFAULT,
  DRAWER_WIDTH_MAX,
  DRAWER_WIDTH_MIN,
  clampDrawerWidth,
  sessionGroupOf
} from '../../../modules/ai/views/assistant/drawer/drawerLayout'
import { renderMarkdown } from '../../../modules/ai/views/assistant/renderMarkdown'

const HAN = /[\u4e00-\u9fff]/
const get = (pack: any, key: string) => key.split('.').reduce((o, k) => o?.[k], pack)
const src = (f: string) => readFileSync(resolve(__dirname, '../../..', f), 'utf8')
const FILES = [
  'modules/ai/views/assistant/drawer/AiDrawerChat.vue',
  'modules/ai/views/shared/AiDrawerHost.vue'
]

describe('AI 助手抽屉', () => {
  it('宽度夹在 420–800 且不超过视口，非法值回默认', () => {
    expect(clampDrawerWidth(undefined, 1440)).toBe(DRAWER_WIDTH_DEFAULT)
    expect(clampDrawerWidth('abc', 1440)).toBe(DRAWER_WIDTH_DEFAULT)
    expect(clampDrawerWidth(100, 1440)).toBe(DRAWER_WIDTH_MIN)
    expect(clampDrawerWidth(2000, 1440)).toBe(DRAWER_WIDTH_MAX)
    expect(clampDrawerWidth(700, 680)).toBe(680)
    expect(clampDrawerWidth(700, 300)).toBe(DRAWER_WIDTH_MIN)
  })

  it('会话按今天 / 7 天内 / 更早分组', () => {
    const now = new Date(2026, 9, 14, 11, 0, 0)
    expect(sessionGroupOf('2026-10-14 08:00:00', now)).toBe('today')
    expect(sessionGroupOf('2026-10-13 23:59:59', now)).toBe('week')
    expect(sessionGroupOf('2026-10-08 00:00:00', now)).toBe('week')
    expect(sessionGroupOf('2026-10-07 23:59:59', now)).toBe('earlier')
    expect(sessionGroupOf(undefined, now)).toBe('earlier')
  })

  it('代码块带复制按钮，且不双重转义', () => {
    const html = renderMarkdown('看：\n```js\nif (a < b) {}\n```', 'Copy')
    expect(html).toContain('data-ai-copy')
    expect(html).toContain('ai-code__hd')
    expect(html).toContain('>js<')
    expect(html).toContain('Copy')
    expect(html).not.toContain('&amp;lt;')
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).not.toContain('<img')
  })

  it('aiDrawer 词条 zh / en 一一对应，en 不含中文', () => {
    const z = (zh as any).aiDrawer
    const e = (en as any).aiDrawer
    expect(Object.keys(e).sort()).toEqual(Object.keys(z).sort())
    for (const [k, v] of Object.entries(e)) {
      expect(HAN.test(v as string), `aiDrawer.${k}`).toBe(false)
    }
  })

  it('组件里引用的词条都存在', () => {
    const re = /\bt\(\s*[`']((?:ai[A-Za-z]+)\.[A-Za-z0-9]+)[`']/g
    for (const f of FILES) {
      const keys = [...src(f).matchAll(re)].map((m) => m[1])
      expect(keys.length, f).toBeGreaterThan(0)
      for (const k of keys) {
        expect(get(zh, k), `${f}: ${k}`).toBeTypeOf('string')
        expect(get(en, k), `${f}: ${k}`).toBeTypeOf('string')
      }
    }
  })

  it('抽屉内容按需加载，不进插件 chunk', () => {
    const host = src('modules/ai/views/shared/AiDrawerHost.vue')
    expect(host).toMatch(/import\(\s*['"]\.\.\/assistant\/drawer\/AiDrawerChat\.vue['"]\s*\)/)
    expect(host).toMatch(/defineAsyncComponent\(\{/)
    expect(host).not.toMatch(/import\s+\w+\s+from\s+['"][^'"]*AiDrawerChat/)
    expect(host).not.toMatch(/from\s+['"]vue-element-plus-x/)
  })

  it('抽屉 chunk 加载有 loading / 出错重试 / 超时', () => {
    const host = src('modules/ai/views/shared/AiDrawerHost.vue')
    expect(host).toMatch(/loadingComponent:\s*ChatLoading/)
    expect(host).toMatch(/errorComponent:\s*ChatError/)
    expect(host).toMatch(/timeout:\s*CHAT_LOAD_TIMEOUT/)
    // 重试必须换新的异步组件并加查询参数：浏览器会缓存失败的动态 import
    expect(host).toMatch(/retry=\$\{attempt\}/)
    for (const lang of ['zh', 'en']) {
      const d = JSON.parse(src(`src/locales/langs/${lang}.json`)).aiDrawer
      expect(d.loading, lang).toBeTruthy()
      expect(d.loadFailed, lang).toBeTruthy()
    }
  })

  it('消息的重试、复制按钮可以 Tab 到', () => {
    const chat = src('modules/ai/views/assistant/drawer/AiDrawerChat.vue')
    expect(chat).not.toMatch(/<ElButton[^>]*tabindex="-1"/)
    expect(chat).not.toMatch(/#5d87ff/i)
  })
})
