import { describe, expect, it } from 'vitest'
import { parseCaptchaEnabled } from '../../../e2e/helpers/captchaConfig'

const ok = (body: unknown, status = 200) => ({
  status,
  ok: status >= 200 && status < 300,
  text: typeof body === 'string' ? body : JSON.stringify(body)
})

describe('parseCaptchaEnabled（e2e 验证码前置判断）', () => {
  it('enabled=true / false 原样返回', () => {
    expect(parseCaptchaEnabled(ok({ code: 200, data: { enabled: true } }), 'login')).toBe(true)
    expect(parseCaptchaEnabled(ok({ code: 200, data: { enabled: false } }), 'login')).toBe(false)
  })

  it('HTTP 500 抛错并带状态', () => {
    expect(() => parseCaptchaEnabled(ok({ code: 500 }, 500), 'login')).toThrow(/HTTP 500/)
  })

  it('响应不是 JSON 抛错', () => {
    expect(() => parseCaptchaEnabled(ok('<html>502</html>'), 'register')).toThrow(/不是 JSON/)
  })

  it('R.code 不是 200 抛错', () => {
    expect(() => parseCaptchaEnabled(ok({ code: 40012, data: null }), 'forget')).toThrow(
      /code=40012/
    )
  })

  it('data 为 null 或 enabled 不是布尔都抛错', () => {
    expect(() => parseCaptchaEnabled(ok({ code: 200, data: null }), 'login')).toThrow(
      /data\.enabled/
    )
    expect(() =>
      parseCaptchaEnabled(ok({ code: 200, data: { enabled: 'true' } }), 'login')
    ).toThrow(/data\.enabled/)
  })
})
