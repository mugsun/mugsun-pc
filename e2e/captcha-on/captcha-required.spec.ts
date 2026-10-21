import { test, expect } from '@playwright/test'
import { CaptchaCode } from '../../src/utils/captcha/codes'
import { parseCaptchaEnabled } from '../helpers/captchaConfig'

/**
 * 验证码开启时的服务端拦截（project `captcha-on`，pnpm test:e2e:captcha-on）。
 * 前置：后端验证码开启（mugsun.captcha.enabled=true 且平台租户开关开启）。
 * 不解题、不走任何旁路：只断言「不带 captchaToken」的请求被拒——
 * HTTP 200，R.code = CaptchaCode.REQUIRED（40013）。
 * 主套（pnpm test:e2e）要求验证码关闭，两者需分别对不同配置的后端运行。
 */

type Scene = 'login' | 'register' | 'forget'

const TENANT = '000000'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }, testInfo) => {
  const scene = (testInfo.annotations.find((a) => a.type === 'scene')?.description ||
    'login') as Scene
  const resp = await page.request.get('/api/auth/captcha/config', {
    params: { scene, clientId: 'web', tenantId: TENANT }
  })
  // 只有明确返回 enabled=false 才跳过；500、非 JSON、data 为空等一律抛错
  const enabled = parseCaptchaEnabled(
    { status: resp.status(), ok: resp.ok(), text: await resp.text() },
    scene
  )
  test.skip(
    !enabled,
    `后端 ${scene} 场景验证码已关闭（enabled=false）；captcha-on 用例须对开着验证码的后端运行`
  )
})

async function post(page: import('@playwright/test').Page, url: string, data: object) {
  const resp = await page.request.post(url, { data })
  expect(resp.status(), `${url} HTTP 状态`).toBe(200)
  return resp.json()
}

test(
  'CAP-ON-1 登录：不带 captchaToken 被拒（不进入密码校验）',
  { annotation: { type: 'scene', description: 'login' } },
  async ({ page }) => {
    const json = await post(page, '/api/auth/login', {
      username: 'admin',
      password: 'any-wrong-password',
      tenantId: TENANT,
      clientId: 'web'
    })
    expect(json.code, `无令牌登录须被拒：${json.msg || ''}`).toBe(CaptchaCode.REQUIRED)
    expect(json.data?.token).toBeFalsy()
  }
)

test(
  'CAP-ON-2 注册：不带 captchaToken 被拒（不建账号）',
  { annotation: { type: 'scene', description: 'register' } },
  async ({ page }) => {
    const json = await post(page, '/api/auth/register', {
      username: `e2e_capon_${Date.now() % 100000}`,
      nickname: 'captcha-on',
      password: 'CapOn@12345'
    })
    expect(json.code, `无令牌注册须被拒：${json.msg || ''}`).toBe(CaptchaCode.REQUIRED)
  }
)

test(
  'CAP-ON-3 忘记密码发码：不带 captchaToken 被拒',
  { annotation: { type: 'scene', description: 'forget' } },
  async ({ page }) => {
    const json = await post(page, '/api/auth/forget-code', {
      username: `e2e_capon_${Date.now() % 100000}`,
      tenantId: TENANT
    })
    expect(json.code, `无令牌发码须被拒：${json.msg || ''}`).toBe(CaptchaCode.REQUIRED)
  }
)
