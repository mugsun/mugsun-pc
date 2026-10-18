import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

/**
 * 数字（图形）验证码已移除：三个授权页不再有 captchaCode 输入框 / 图片 / 回落分支，
 * 验证码位置换成 CaptchaConfigError 错误态，提交按钮在验证码就绪前不可用。
 */
const root = resolve(__dirname, '../../')
const read = (f: string) => readFileSync(resolve(root, f), 'utf-8')
const get = (pack: any, key: string) => key.split('.').reduce((o, k) => o?.[k], pack)

const PAGES = {
  login: 'src/views/auth/login/index.vue',
  register: 'src/views/auth/register/index.vue',
  forget: 'src/views/auth/forget-password/index.vue'
} as const

const LEGACY = [
  /captchaCode/,
  /captchaUuid/,
  /captchaImage/,
  /fetchCaptcha\b/,
  /legacyEnabled/,
  /onFallback|@fallback/,
  /captcha-img/,
  /过渡一个版本/
]

describe('数字验证码已移除', () => {
  for (const [name, file] of Object.entries(PAGES)) {
    it(`${name}：没有数字码输入框、图片和回落分支，验证码位置是错误态组件`, () => {
      const src = read(file)
      for (const re of LEGACY) expect(src, `${file} 不应含 ${re}`).not.toMatch(re)
      expect(src).toMatch(/<CaptchaConfigError :gate="\w+" scene="\w+" \/>/)
    })
  }

  it('登录：账号登录按钮与发短信按钮在各自验证码就绪前不可用', () => {
    const src = read(PAGES.login)
    expect(src).toContain(':disabled="!captchaGate.ready.value"')
    expect(src).toContain(':disabled="smsCountdown > 0 || !smsGate.ready.value"')
  })

  it('注册 / 忘记密码：提交或发码按钮在验证码就绪前不可用', () => {
    expect(read(PAGES.register)).toContain(':disabled="!captchaGate.ready.value"')
    expect(read(PAGES.forget)).toContain(':disabled="countdown > 0 || !captchaGate.ready.value"')
  })

  it('API / 类型不再有数字码字段与 /auth/captcha 图片接口', () => {
    for (const f of ['src/api/auth.ts', 'src/types/api/api.d.ts', 'src/api/captcha.ts']) {
      const src = read(f)
      expect(src, f).not.toMatch(/captchaCode|captchaUuid|'\/api\/auth\/captcha'|'IMAGE'/)
    }
  })

  it('CaptchaDialog 不再 emit fallback（未知题型显示暂不可用）', () => {
    const src = read('src/components/core/captcha/CaptchaDialog.vue')
    expect(src).not.toMatch(/emit\('fallback'\)|fallback: \[\]/)
  })

  it('错误态：重试按钮 + 错误编号 + polite live region（不用 role=alert）', () => {
    const src = read('src/components/core/captcha/CaptchaConfigError.vue')
    expect(src).toContain('aria-live="polite"')
    expect(src).not.toContain('role="alert"')
    expect(src).toContain('gate.loadConfig()')
    expect(src).toContain('gate.errorIdPart.value')
    expect(src).not.toMatch(/ElMessage|ElNotification/)
  })

  it('i18n：数字码相关键已删除，新错误态文案中英齐全', () => {
    for (const pack of [zh, en]) {
      for (const k of [
        'pages.auth.captchaPlaceholder',
        'pages.auth.captchaRefresh',
        'pages.auth.captchaAlt',
        'pages.auth.captchaReload',
        'pages.auth.captchaLoadFailed',
        'pages.auth.login.captchaCodePlaceholder',
        'pages.auth.login.captchaRequired',
        'pages.auth.forgetPassword.enterCaptchaFirst',
        'pages.auth.slider.fallback'
      ]) {
        expect(get(pack, k), k).toBeUndefined()
      }
      for (const k of ['failed', 'idSep', 'idPart', 'retry', 'notReady']) {
        expect(typeof get(pack, `pages.auth.captchaConfig.${k}`), k).toBe('string')
      }
      expect(get(pack, 'pages.auth.captchaConfig.idPart')).toContain('{id}')
    }
  })
})
