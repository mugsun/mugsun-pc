import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  username?: string
  password?: string
  /** 租户编号，留空为平台租户 000000 */
  tenantId?: string
  /** 是否勾选「记住账号」；不传则保持页面当前状态 */
  remember?: boolean
}

export type CaptchaScene = 'login' | 'register' | 'sms' | 'forget'

/**
 * E2E 不解行为验证码，也不读 Redis：要求后端以已有开关关闭验证码
 * （全局 mugsun.captcha.enabled=false，或平台租户的验证码开关关闭），
 * 此时 /auth/captcha/config 返回 enabled=false，页面不弹验证、提交不带 captchaToken。
 * 若后端开着验证码则直接报错说明前置条件，而不是绕过校验。
 */
export async function assertCaptchaDisabled(
  page: Page,
  scene: CaptchaScene = 'login',
  tenantId = '000000'
): Promise<void> {
  const resp = await page.request.get('/api/auth/captcha/config', {
    params: { scene, clientId: 'web', tenantId }
  })
  const json = await resp.json().catch(() => null)
  const enabled = json?.data?.enabled
  if (enabled !== false) {
    throw new Error(
      `E2E 前置条件：${scene} 场景验证码须关闭（后端 mugsun.captcha.enabled=false 或关闭平台租户验证码开关），` +
        `当前 /auth/captcha/config 返回 enabled=${String(enabled)}`
    )
  }
}

/**
 * 真实登录（账号密码 + 可选租户）。
 * 前置：后端已关闭验证码（见 assertCaptchaDisabled）。
 */
export async function login(page: Page, opts: LoginOptions = {}): Promise<void> {
  const { username = 'admin', password = '123456', tenantId, remember } = opts

  // 已持有会话则跳过（避免登录页被守卫重定向导致验证码不触发）
  const existingToken = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')?.accessToken || ''
    } catch {
      return ''
    }
  })
  if (existingToken) return

  await assertCaptchaDisabled(page, 'login', tenantId || '000000')
  // 已在登录页时同源 goto 不触发重载，显式 reload 以重置表单
  if (page.url().includes('/auth/login')) {
    await page.reload()
  } else {
    await page.goto('/#/auth/login')
  }

  const usernameInput = page.getByPlaceholder(/请输入账号|用户名/i).first()
  // dev 环境预填了 admin/123456，统一清空再填，确保账号来源明确
  await usernameInput.fill(username)
  await page
    .getByPlaceholder(/请输入密码/i)
    .first()
    .fill(password)
  if (tenantId) {
    await page.getByPlaceholder(/租户编号/i).fill(tenantId)
  }
  // 记住账号开关：显式指定时对齐勾选态
  if (remember !== undefined) {
    const box = page.locator('form .el-checkbox input[type="checkbox"]').first()
    if ((await box.isChecked()) !== remember) {
      await page.getByText('记住账号').click()
    }
  }

  await page.getByRole('button', { name: '登录', exact: true }).click()

  // 双因子兜底：若弹出二次验证框，dev 环境已自动填充，直接确认
  const dialog = page.getByRole('dialog')
  try {
    await dialog.waitFor({ state: 'visible', timeout: 3_000 })
    await dialog.getByRole('button', { name: /验证|确定/i }).click()
  } catch {
    /* 无 2FA，正常路径 */
  }

  // 登录成功跳转离开登录页（hash 路由：判断 hash 段）
  await expect(page).not.toHaveURL(/#\/auth\/login/, { timeout: 15_000 })
}

/** 登出（清理会话并整页重载清内存态；保留「记住账号」的用户名记忆） */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    const remembered = localStorage.getItem('mugsun.remembered-username')
    localStorage.clear()
    sessionStorage.clear()
    if (remembered) localStorage.setItem('mugsun.remembered-username', remembered)
  })
  await page.context().clearCookies()
  // 整页重载：清空 Pinia 内存会话态，避免后续导航被旧登录态守卫误导
  await page.goto('/')
  // 等守卫把未登录态重定向到登录页（异步，等其落定再放行后续导航）
  await page.waitForURL(/\/auth\/login/, { timeout: 10_000 })
}

/** 读取当前会话 accessToken（pinia 持久化键带版本前缀，如 sys-v3.0.2-user，向后兼容裸 user 键） */
export async function readAccessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith('-user')) || 'user'
    try {
      return JSON.parse(localStorage.getItem(key) || '{}').accessToken || ''
    } catch {
      return ''
    }
  })
}
