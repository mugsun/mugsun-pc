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
  'modules/ai/views/shared/AiDrawerHost.vue',
  'modules/ai/views/assistant/drawer/AiDrawerCloseButton.vue',
  'modules/ai/views/assistant/drawer/AiDrawerHeaderShell.vue'
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
    // 超时 / 计数 / 刷新兜底都在 createChatLoader（行为见 chat-chunk-retry.test.ts）
    expect(host).toMatch(/createChatLoader\(\{/)
    expect(host).toMatch(/timeout: CHAT_LOAD_TIMEOUT/)
    expect(host).toMatch(/isActive: \(\) => props\.visible/)
    expect(host).toMatch(/reload: \(\) => window\.location\.reload\(\)/)
    expect(host).not.toMatch(/timeout:\s*CHAT_LOAD_TIMEOUT\s*\n\s*\}\)\s*\n\s*\}/)
    // 关闭 / 卸载时作废进行中的加载
    expect(host).toMatch(/if \(!v\) abandonLoad\(\)/)
    expect(host).toMatch(/onBeforeUnmount\(\(\) => chatLoader\.invalidate\(\)\)/)
    // 重试换新的异步组件并换 ?retry=N
    expect(host).toMatch(/chatLoader\.retry\(\)\s*AiDrawerChat\.value = createChat\(\)/)
    for (const lang of ['zh', 'en']) {
      const d = JSON.parse(src(`src/locales/langs/${lang}.json`)).aiDrawer
      expect(d.loading, lang).toBeTruthy()
      expect(d.loadFailed, lang).toBeTruthy()
    }
  })

  it('加载中 / 加载失败保留 48px 顶栏，关闭按钮在所有状态下是同一个组件', () => {
    const host = src('modules/ai/views/shared/AiDrawerHost.vue')
    const chat = src('modules/ai/views/assistant/drawer/AiDrawerChat.vue')
    const shell = src('modules/ai/views/assistant/drawer/AiDrawerHeaderShell.vue')
    // 两个状态组件都先渲染顶栏，再渲染内容区
    expect(host.match(/h\(AiDrawerHeaderShell,/g)?.length).toBe(2)
    expect(host).toMatch(/state: 'loading'/)
    expect(host).toMatch(/state: 'error'/)
    // 不延迟显示 loading，避免打开后一段时间没有关闭按钮
    expect(host).toMatch(/delay:\s*0/)
    // 内容区加载提示延迟 200ms 出现，顶栏不延迟
    expect(host).toMatch(/const SPINNER_DELAY = 200/)
    expect(host).toMatch(/setTimeout\(\(\) => \(showSpinner\.value = true\), SPINNER_DELAY\)/)
    expect(host).toMatch(/onBeforeUnmount\(\(\) => clearTimeout\(timer\)\)/)
    // 正式顶栏与状态顶栏用同一个关闭按钮组件
    expect(chat).toMatch(/<AiDrawerCloseButton @close=/)
    expect(shell).toMatch(/<AiDrawerCloseButton @close=/)
    expect(chat).not.toMatch(/aiDrawer\.close'/)
    // 加载中：120px 骨架 + 新对话/全屏禁用；加载失败：标题 + 不显示这两个按钮
    expect(shell).toMatch(/width: 120px/)
    // 浅色占位条用 --el-border-color 提高对比度，暗色仍是 --el-fill-color
    expect(shell).toMatch(/width: 120px;\s*height: 16px;\s*background: var\(--el-border-color\)/)
    expect(host).toMatch(
      /html\.dark \.ai-drawer \.ai-dshell__skeleton \{\s*background: var\(--el-fill-color\)/
    )
    expect(shell.match(/text\s+disabled/g)?.length).toBe(2)
    expect(shell).toMatch(/v-if="state === 'loading'"[\s\S]*aiDrawer\.newChat/)
    expect(shell).toMatch(/v-else class="ai-dshell__title">\{\{ \$t\('aiDrawer\.title'\) \}\}/)
    expect(shell).toMatch(/height: 48px/)
    // 失败内容区只有「重试」，不再放第二个关闭
    const err = host.slice(
      host.indexOf('const ChatError'),
      host.indexOf('/**', host.indexOf('const ChatError'))
    )
    expect(err).toMatch(/aiDrawer\.retry/)
    expect(err).not.toMatch(/aiDrawer\.close/)
  })

  it('关闭按钮规格：20px 图标、32/44 点击区、变量配色、focus-visible 描边、i18n aria-label', () => {
    const btn = src('modules/ai/views/assistant/drawer/AiDrawerCloseButton.vue')
    expect(btn).toMatch(/:aria-label="\$t\('aiDrawer\.closeAssistant'\)"/)
    expect(btn).toMatch(/<ElIcon :size="20"><Close \/><\/ElIcon>/)
    expect(btn).toMatch(/width: 32px;\s*height: 32px/)
    expect(btn).toMatch(
      /width <= 640px\)\s*\{\s*\.ai-dclose\.el-button\s*\{\s*width: 44px;\s*height: 44px/
    )
    expect(btn).toMatch(/color: var\(--el-text-color-regular\)/)
    expect(btn).toMatch(/background: var\(--el-fill-color-light\)/)
    expect(btn).toMatch(/outline: 2px solid var\(--el-color-primary\)/)
    expect(btn).toMatch(/outline-offset: 2px/)
    // 窄屏 44px 按钮描边内偏，避免被 48px 顶栏裁掉
    expect(btn).toMatch(
      /width <= 640px\)[\s\S]*\.ai-dclose\.el-button:focus-visible\s*\{\s*outline-offset: -2px/
    )
    // 暗色沿用同一组变量：样式里不写死颜色值
    const css = btn.slice(btn.indexOf('<style')).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i)
    expect((zh as any).aiDrawer.closeAssistant).toBe('关闭 AI 助手')
    expect((en as any).aiDrawer.closeAssistant).toBe('Close AI assistant')
    // 顶栏右边距 8px
    for (const f of [
      'modules/ai/views/assistant/drawer/AiDrawerChat.vue',
      'modules/ai/views/assistant/drawer/AiDrawerHeaderShell.vue'
    ]) {
      expect(src(f), f).toMatch(/padding: 0 8px 0 16px/)
    }
  })

  it('关闭（含 Esc）后焦点回到入口按钮', () => {
    const host = src('modules/ai/views/shared/AiDrawerHost.vue')
    expect(host).toMatch(/@closed="fabRef\?\.focus\(\)"/)
    expect(host).not.toMatch(/:close-on-press-escape="false"/)
  })

  it('消息的重试、复制按钮可以 Tab 到', () => {
    const chat = src('modules/ai/views/assistant/drawer/AiDrawerChat.vue')
    expect(chat).not.toMatch(/<ElButton[^>]*tabindex="-1"/)
    expect(chat).not.toMatch(/#5d87ff/i)
  })
})
