import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { toAcceptLanguage } from '@/utils/http/lang'
import {
  TENANT_CAPTCHA_TYPES,
  isRotateOnly,
  parseTenantCaptchaTypes,
  tenantCaptchaWarning
} from '@/utils/captcha/tenantTypes'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))
const { clickPromptChars, clickPromptLabel, resolvePanel } = await import('@/utils/captcha')

describe('Accept-Language 映射', () => {
  it('vue-i18n 语言码 → 请求头', () => {
    expect(toAcceptLanguage('zh')).toBe('zh-CN')
    expect(toAcceptLanguage('zh-CN')).toBe('zh-CN')
    expect(toAcceptLanguage('en')).toBe('en')
    expect(toAcceptLanguage('en-US')).toBe('en')
    expect(toAcceptLanguage('')).toBe('zh-CN')
    expect(toAcceptLanguage(undefined)).toBe('zh-CN')
    expect(toAcceptLanguage('ja')).toBe('ja')
  })

  it('全局拦截器注入 Accept-Language，验证码请求走同一 request 实例', () => {
    const http = readFileSync('src/utils/http/index.ts', 'utf8')
    expect(http).toMatch(/headers\.set\('Accept-Language', currentAcceptLanguage\(\)\)/)
    expect(http).toMatch(/toAcceptLanguage\(unref\(i18n\.global\.locale\)\)/)
    const api = readFileSync('src/api/captcha.ts', 'utf8')
    expect(api).toMatch(/import request from '@\/utils\/http'/)
    expect(api).not.toMatch(/from 'axios'/)
  })
})

describe('图标点选提示用后端 promptNames', () => {
  it('英文 promptNames 原样用于提示与读屏', () => {
    const c = { type: 'ICON_CLICK', promptNames: ['star', 'cross', 'triangle'] }
    expect(clickPromptChars(c)).toEqual(['star', 'cross', 'triangle'])
    expect(clickPromptLabel(c)).toBe('star cross triangle')
  })
  it('ClickPanel 不写死中文图标名', () => {
    const vue = readFileSync('src/components/core/captcha/ClickPanel.vue', 'utf8')
    for (const name of ['圆', '方块', '三角', '星', '十字']) {
      expect(vue).not.toContain(`'${name}'`)
    }
  })
})

describe('换一张时题型变化', () => {
  it('不依赖固定题型顺序：任意题型都能解析到面板', () => {
    const seq = ['ICON_CLICK', 'SLIDER', 'JIGSAW', 'ROTATE', 'SLIDER', 'ICON_CLICK']
    expect(seq.map(resolvePanel)).toEqual([
      'click',
      'slider',
      'jigsaw',
      'rotate',
      'slider',
      'click'
    ])
  })
  it('面板按 captchaId 重建（同为 click 的 WORD→ICON 也会重置）', () => {
    const vue = readFileSync('src/components/core/captcha/CaptchaDialog.vue', 'utf8')
    expect(vue).toMatch(/:key="challenge\.captchaId/)
  })
})

describe('租户验证码题型', () => {
  it('解析 csv：空=平台默认，未知值丢弃，按固定顺序', () => {
    expect(parseTenantCaptchaTypes(null)).toEqual([])
    expect(parseTenantCaptchaTypes('')).toEqual([])
    expect(parseTenantCaptchaTypes('rotate, SLIDER,FOO,SLIDER')).toEqual(['SLIDER', 'ROTATE'])
  })
  it('ROTATE 排最后（辅助题型）', () => {
    expect(TENANT_CAPTCHA_TYPES[TENANT_CAPTCHA_TYPES.length - 1]).toBe('ROTATE')
  })
  it('warning 原样取出', () => {
    const w = '只启用了 ROTATE：旋转题目前只能部分抵御自动求解'
    expect(tenantCaptchaWarning({ warning: w })).toBe(w)
    expect(tenantCaptchaWarning(null)).toBe('')
    expect(tenantCaptchaWarning({})).toBe('')
    expect(tenantCaptchaWarning({ warning: 1 })).toBe('')
  })
  it('isRotateOnly', () => {
    expect(isRotateOnly(['ROTATE'])).toBe(true)
    expect(isRotateOnly(['ROTATE', 'SLIDER'])).toBe(false)
    expect(isRotateOnly([])).toBe(false)
  })
})
