import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'

/**
 * 接线测试：真实挂载租户验证码弹窗，只 mock 保存接口。
 * 保存失败：弹窗内显示「前端文案 + 错误编号（X-Trace-Id）」，后端原文只进 console，
 * polite 播报一次、不用 role=alert；弹窗不关、勾选保留、按钮恢复；再次提交 / 关闭时清掉提示。
 */
vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const fetchTenantCaptcha = vi.fn()
vi.mock('@/api/system-manage', () => ({
  fetchTenantCaptcha: (...a: unknown[]) => fetchTenantCaptcha(...a)
}))

import { HttpError } from '@/utils/http/error'
import { ApiStatus } from '@/utils/http/status'
import TenantCaptchaDialog from '@/views/system/tenant/modules/tenant-captcha-dialog.vue'

const HEX32 = /^[0-9a-f]{32}$/
const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

let app: App | null = null
let consoleError: ReturnType<typeof vi.spyOn>
const visible = ref(true)

function mount(locale: 'zh' | 'en') {
  const host = document.createElement('div')
  document.body.appendChild(host)
  visible.value = true
  const i18n = createI18n({ legacy: false, locale, messages: { zh, en } })
  app = createApp({
    render: () =>
      h(TenantCaptchaDialog, {
        visible: visible.value,
        'onUpdate:visible': (v: boolean) => (visible.value = v),
        row: { id: 2, tenantName: 'Mock', captchaEnabled: 1, captchaTypes: 'SLIDER,JIGSAW' }
      })
  })
  app.use(ElementPlus).use(i18n)
  app.mount(host)
}
const q = (s: string) => document.body.querySelector(s) as HTMLElement | null
const submit = () =>
  [...document.body.querySelectorAll('.el-dialog__footer button')].at(-1) as HTMLButtonElement

beforeEach(() => {
  fetchTenantCaptcha.mockReset()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  app?.unmount()
  app = null
  document.body.innerHTML = ''
  consoleError.mockRestore()
})

describe('租户验证码弹窗：保存失败', () => {
  it('弹窗内显示文案 + 错误编号；后端原文只进 console；polite 播报；弹窗不关、勾选保留、按钮恢复', async () => {
    const err = new HttpError('java.sql.SQLException: boom', 500)
    fetchTenantCaptcha.mockRejectedValue(err)
    mount('zh')
    await flush()
    submit().click()
    await flush()

    const traceId = fetchTenantCaptcha.mock.calls[0][1].traceId
    expect(traceId).toMatch(HEX32)
    expect(fetchTenantCaptcha.mock.calls[0][0].types).toEqual(['SLIDER', 'JIGSAW'])
    expect(q('[data-testid="captcha-save-error"]')?.textContent?.trim()).toBe(
      `验证码设置保存失败，请稍后重试。（错误编号：${traceId}）`
    )
    expect(q('[data-testid="captcha-save-error-id"]')?.textContent).toBe(`（错误编号：${traceId}）`)
    expect(document.body.textContent).not.toContain('SQLException')
    expect(consoleError).toHaveBeenCalledWith('[TenantCaptcha] save failed', {
      traceId,
      error: err
    })
    const live = q('[data-testid="captcha-save-live"]')!
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
    expect(live.textContent).toContain(traceId)
    // 弹窗不关、勾选保留、按钮可点
    expect(visible.value).toBe(true)
    const checked = [...document.body.querySelectorAll('.el-checkbox.is-checked')]
    expect(checked).toHaveLength(2)
    expect(submit().disabled).toBe(false)
    expect(submit().classList.contains('is-loading')).toBe(false)

    // 再次提交：请求进行中先清掉提示
    let release!: () => void
    fetchTenantCaptcha.mockReturnValueOnce(new Promise((r) => (release = () => r(null))))
    submit().click()
    await flush()
    expect(q('[data-testid="captcha-save-error"]')).toBeNull()
    expect(live.textContent).toBe('')
    release()
    await flush()
  })

  it('英文文案；关闭弹窗即清掉提示', async () => {
    fetchTenantCaptcha.mockRejectedValue(new HttpError('x', 500))
    mount('en')
    await flush()
    submit().click()
    await flush()
    const traceId = fetchTenantCaptcha.mock.calls[0][1].traceId
    expect(q('[data-testid="captcha-save-error"]')?.textContent?.trim()).toBe(
      `Failed to save captcha settings. Please try again later. (Error ID: ${traceId})`
    )
    visible.value = false
    await flush()
    visible.value = true
    await flush()
    expect(q('[data-testid="captcha-save-error"]')).toBeNull()
  })

  it.each([
    [
      '网络异常（errorKind=network）',
      () =>
        new HttpError('net', ApiStatus.network, {
          url: '/api/system/tenant/captcha',
          errorKind: 'network'
        })
    ],
    [
      '防重复提交拦截（请求层标记 isDuplicateSubmit）',
      () => new HttpError('repeat', ApiStatus.error, { duplicateSubmit: true })
    ],
    ['请求被取消', () => new HttpError('cancel', ApiStatus.error, { canceled: true })]
  ])('请求没到后端：%s → 显示网络异常文案，不给错误编号', async (_name, make) => {
    fetchTenantCaptcha.mockRejectedValue(make())
    mount('zh')
    await flush()
    submit().click()
    await flush()
    const box = q('[data-testid="captcha-save-error"]')
    expect(box?.textContent?.trim()).toBe('网络异常，验证码设置未保存，请检查网络后重试。')
    expect(q('[data-testid="captcha-save-error-id"]')).toBeNull()
    expect(q('[data-testid="captcha-save-live"]')?.textContent).toBe(
      '网络异常，验证码设置未保存，请检查网络后重试。'
    )
    expect(visible.value).toBe(true)
    expect(submit().disabled).toBe(false)
  })

  it('到过后端的业务失败仍显示错误编号（不误判为网络异常）', async () => {
    fetchTenantCaptcha.mockRejectedValue(
      new HttpError('biz', 500, { url: '/api/system/tenant/captcha', errorKind: 'business' })
    )
    mount('en')
    await flush()
    submit().click()
    await flush()
    expect(q('[data-testid="captcha-save-error-id"]')?.textContent).toMatch(
      /^\(Error ID: [0-9a-f]{32}\)$/
    )
  })

  it('没有防重复提交标记、也没有 url 的 http 错误不再按形状当成网络异常（仍显示错误编号）', async () => {
    fetchTenantCaptcha.mockRejectedValue(new HttpError('x', ApiStatus.error))
    mount('zh')
    await flush()
    submit().click()
    await flush()
    expect(q('[data-testid="captcha-save-error-id"]')?.textContent).toMatch(
      /^（错误编号：[0-9a-f]{32}）$/
    )
  })
})
