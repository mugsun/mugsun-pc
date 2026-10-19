import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import zh from '@/locales/langs/zh.json'

/**
 * 接线测试：真实挂载 ChangelogCard（Element Plus + vue-i18n），只 mock 接口 fetchChangelogRecent，
 * 验证组件 → useChangelogRecent → 接口 的整条链路在成功 / 空 / 失败三种返回下渲染正确。
 * 不挂整个工作台 index.vue：它还依赖 echarts、路由、store 和另外 4 个接口，与本卡无关。
 */
// error-handle → http/error → @/locales 会拉起整套语言包与 store，这里只需 $t 占位
vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const fetchChangelogRecent = vi.fn()
vi.mock('@/api/feedback', () => ({
  fetchChangelogRecent: (...a: unknown[]) => fetchChangelogRecent(...a)
}))

import ChangelogCard from '@/views/dashboard/console/ChangelogCard.vue'

const HEX32 = /[0-9a-f]{32}/

let app: App | null = null
let host: HTMLElement

async function mountCard() {
  host = document.createElement('div')
  document.body.appendChild(host)
  const i18n = createI18n({ legacy: false, locale: 'zh', messages: { zh } })
  app = createApp(ChangelogCard)
  app.use(ElementPlus).use(i18n)
  app.mount(host)
  // 等接口 Promise 落定与重新渲染
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
    await nextTick()
  }
  return host
}

const $ = (sel: string) => host.querySelector(sel)

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  app?.unmount()
  app = null
  host?.remove()
  fetchChangelogRecent.mockReset()
})

describe('ChangelogCard 挂载（接线）', () => {
  it('成功：渲染时间线条目，当前版本照常显示，请求 limit=6 且带 traceId', async () => {
    fetchChangelogRecent.mockResolvedValue([
      {
        id: 2,
        version: 'v0.1.0',
        type: 'feature',
        title: '首个版本',
        publishTime: '2026-10-18 10:00:00'
      },
      {
        id: 1,
        version: 'v0.0.9',
        type: 'fix',
        title: '修复一处问题',
        publishTime: '2026-10-01 10:00:00'
      }
    ])
    await mountCard()
    expect(fetchChangelogRecent).toHaveBeenCalledTimes(1)
    expect(fetchChangelogRecent.mock.calls[0][0]).toBe(6)
    expect(fetchChangelogRecent.mock.calls[0][1].traceId).toMatch(/^[0-9a-f]{32}$/)
    const items = host.querySelectorAll('[data-test="changelog-list"] .el-timeline-item')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('首个版本')
    expect(items[0].textContent).toContain('2026-10-18')
    expect(items[1].textContent).toContain('修复')
    expect($('[data-test="changelog-version"]')?.textContent).toContain('当前版本')
    expect($('[data-test="changelog-empty"]')).toBeNull()
    expect($('[data-test="changelog-error"]')).toBeNull()
  })

  it('空：显示空态文案，不显示列表和错误态', async () => {
    fetchChangelogRecent.mockResolvedValue([])
    await mountCard()
    expect($('[data-test="changelog-empty"]')?.textContent).toContain(
      '暂无更新记录，新版本发布后将在此显示。'
    )
    expect($('[data-test="changelog-list"]')).toBeNull()
    expect($('[data-test="changelog-error"]')).toBeNull()
  })

  it('失败：显示错误态、错误编号（即请求的 traceId）和重试按钮，live region 同步', async () => {
    fetchChangelogRecent.mockRejectedValue(new Error('boom'))
    await mountCard()
    const sentId = fetchChangelogRecent.mock.calls[0][1].traceId
    expect($('[data-test="changelog-error"]')).not.toBeNull()
    const idText = $('[data-test="changelog-error-id"]')?.textContent ?? ''
    expect(idText).toMatch(HEX32)
    expect(idText).toBe(`（错误编号：${sentId}）`)
    expect($('[data-test="changelog-error-text"]')?.textContent).toContain('更新日志加载失败')
    expect($('[data-test="changelog-retry"]')).not.toBeNull()
    expect($('[data-test="changelog-live"]')?.textContent).toContain(sentId)
    expect($('[data-test="changelog-list"]')).toBeNull()
  })
})
