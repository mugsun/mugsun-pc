import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER || 'mugsun-redis'
const REDIS_DB = process.env.E2E_REDIS_DB || '3'
const CAPTCHA_KEY_PREFIX = 'mugsun:captcha:'

export interface LoginOptions {
  username?: string
  password?: string
  /** 租户编号，留空为平台租户 000000 */
  tenantId?: string
  /** 是否勾选「记住账号」；不传则保持页面当前状态 */
  remember?: boolean
}

/**
 * 读取图形验证码答案：前端调 /auth/captcha 得 uuid，答案由后端写入 Redis（120s TTL）。
 * 测试经容器 redis-cli 取回——走真实验证码流程，不绕后端校验。
 */
export function readCaptchaCode(uuid: string): string {
  const out = execSync(
    `docker exec ${REDIS_CONTAINER} redis-cli -n ${REDIS_DB} GET ${CAPTCHA_KEY_PREFIX}${uuid}`,
    { encoding: 'utf-8' }
  ).trim()
  if (!out) throw new Error(`验证码不存在或已过期: ${uuid}`)
  return out
}

/**
 * 拦截 /auth/captcha 响应提取 captchaUuid（route.fetch 先读体再原样放行，
 * 规避「页面导航后响应体不可读」竞态）。返回读取函数：阻塞到捕获到 uuid 为止。
 */
async function armCaptchaCapture(page: Page): Promise<() => Promise<string>> {
  let captured = ''
  await page.route('**/api/auth/captcha', async (route) => {
    const resp = await route.fetch()
    try {
      const json = await resp.json()
      if (json?.data?.captchaUuid) captured = json.data.captchaUuid
    } catch {
      /* 非 JSON 不捕获 */
    }
    await route.fulfill({ response: resp })
  })
  return async () => {
    await expect
      .poll(() => captured, { timeout: 10_000, message: '等待 captchaUuid 捕获' })
      .not.toBe('')
    return captured
  }
}

/**
 * 真实登录（账号密码 + 图形验证码 + 可选租户）。
 * 前置：登录页 onMounted 会自动拉取一次验证码。
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

  const waitUuid = await armCaptchaCapture(page)
  // 已在登录页时同源 goto 不触发重载（验证码不刷新），显式 reload
  if (page.url().includes('/auth/login')) {
    await page.reload()
  } else {
    await page.goto('/#/auth/login')
  }
  const uuid = await waitUuid()
  const code = readCaptchaCode(uuid)

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
  await page
    .getByPlaceholder(/请输入验证码/i)
    .first()
    .fill(code)

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
  await page.unroute('**/api/auth/captcha')
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
