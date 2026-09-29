import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { sm2 } from 'sm-crypto'
import { login } from './fixtures/auth'
import { PG_CONTAINER, REDIS_CONTAINER, REDIS_DB } from './helpers/docker'

/**
 * W5 登录体验增强端到端：
 * 1) 忘记密码全链路——发码（图形验证码前置）→ Redis 取码 → 重置 → 旧密码失败/新密码成功。
 *    邮件通道未配置（默认 dev 占位 SMTP）时，显式错误「邮件通道未配置」单独成测，全链路自动跳过；
 *    配置真实 SMTP 后全链路自动执行。
 * 2) 登录页第三方登录区与 /auth/social/sources 一致（无源整区不可见，mock 按钮仅 DEV+后端允许）。
 * 3) 个人中心：mock 绑定区不可见（DEV 但后端未允许），邮箱/手机展示位存在。
 */

function psql(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

function redisGet(key: string): string {
  return execSync(`docker exec ${REDIS_CONTAINER} redis-cli -n ${REDIS_DB} GET ${key}`, {
    encoding: 'utf-8'
  }).trim()
}

/** 取一对图形验证码（API 级，不干扰页面内展示的那张） */
async function newCaptcha(page: Page): Promise<{ uuid: string; code: string }> {
  const resp = await page.request.fetch('/api/auth/captcha')
  const json = await resp.json()
  const uuid = json.data.captchaUuid as string
  const code = redisGet(`mugsun:captcha:${uuid}`)
  expect(code, '图形验证码答案须已写入 Redis').not.toBe('')
  return { uuid, code }
}

/** SM2 传输加密（对齐前端 @/utils/gm：C1C3C2、密文不带 04 前缀；gm 关闭时明文） */
async function encryptPassword(page: Page, raw: string): Promise<string> {
  const resp = await page.request.fetch('/api/auth/sm2-public-key')
  const json = await resp.json()
  if (!json.data.gmEnabled || !json.data.publicKey) return raw
  return sm2.doEncrypt(raw, json.data.publicKey, 1)
}

/** API 级登录尝试，返回 R 信封（成败均由调用方断言） */
async function apiLogin(page: Page, username: string, rawPassword: string) {
  const captcha = await newCaptcha(page)
  const resp = await page.request.fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      username,
      password: await encryptPassword(page, rawPassword),
      tenantId: '000000',
      clientId: 'web',
      captchaUuid: captcha.uuid,
      captchaCode: captcha.code
    }
  })
  return resp.json()
}

/** 探测忘记密码发码通道：返回 R 信封（随机不存在账号探测——避开同账号 60s 节流，重跑互不干扰） */
async function probeForgetCode(page: Page) {
  const captcha = await newCaptcha(page)
  const resp = await page.request.fetch('/api/auth/forget-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      username: `e2e_probe_${Date.now() % 1000000}_${Math.floor(Math.random() * 1000)}`,
      captchaUuid: captcha.uuid,
      captchaCode: captcha.code
    }
  })
  return resp.json()
}

/** 注册独立测试账号（图形验证码 + SM2，与前端注册页同链路） */
async function registerUser(page: Page, username: string, rawPassword: string) {
  const captcha = await newCaptcha(page)
  const resp = await page.request.fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      username,
      nickname: username,
      password: await encryptPassword(page, rawPassword),
      captchaUuid: captcha.uuid,
      captchaCode: captcha.code
    }
  })
  const json = await resp.json()
  expect(json.code, `注册 ${username} 须成功：${json.msg || ''}`).toBe(200)
}

/** 拦截页面图形验证码响应提取 captchaUuid（参照 fixtures/auth.ts armCaptchaCapture） */
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
      .poll(() => captured, { timeout: 10_000, message: '等待页面 captchaUuid 捕获' })
      .not.toBe('')
    return captured
  }
}

const SOCIAL_LABELS: Record<string, string> = {
  github: 'GitHub',
  gitee: 'Gitee',
  qq: 'QQ',
  wechat_open: '微信'
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page?.close()
})

test('W5-1a 忘记密码发码：邮件通道未配置时显式报错（默认 dev 占位 SMTP 环境）', async () => {
  const probe = await probeForgetCode(page)
  if (probe.code === 200) {
    test.skip(true, '当前环境邮件通道已配置，显式降级路径不适用（由 W5-1b 覆盖全链路）')
  }
  expect(probe.msg, '通道未配置须显式报错，不得假成功').toBe('邮件通道未配置')
})

test('W5-1b 忘记密码全链路：发码→Redis取码→重置→旧密码失败新密码成功', async () => {
  const probe = await probeForgetCode(page)
  test.skip(
    probe.code !== 200,
    `邮件通道未配置（${probe.msg}），配置真实 SMTP 后本测试自动执行全链路`
  )

  // 独立测试账号：注册 → 绑定邮箱（避免触碰 admin/fronttest 既有账号）
  const username = `e2e_w5_${Date.now() % 100000}`
  const oldPassword = 'W5Forget@123'
  const newPassword = 'W5Reset@456'
  await registerUser(page, username, oldPassword)
  const userId = psql(`SELECT id FROM sys_user WHERE username='${username}' AND is_deleted=0;`)
  expect(userId).not.toBe('')
  psql(`UPDATE sys_user SET email='w5-forget@test.com' WHERE id=${userId};`)

  try {
    // 页面链路：填账号+图形验证码 → 发码
    const waitUuid = await armCaptchaCapture(page)
    await page.goto('/#/auth/forget-password')
    const uuid = await waitUuid()
    const captchaCode = redisGet(`mugsun:captcha:${uuid}`)
    await page.getByPlaceholder('请输入账号').fill(username)
    await page.getByPlaceholder('请输入图形验证码').fill(captchaCode)
    await page.getByRole('button', { name: '发送验证码' }).click()
    // 防枚举统一话术：成功即开始倒计时
    await expect(page.getByRole('button', { name: /^\d+s$/ })).toBeVisible({ timeout: 10_000 })

    // Redis 取码 → 填验证码+新密码 → 提交
    const code = redisGet(`mugsun:forget:code:000000:${username}`)
    expect(code, '重置验证码须已写入 Redis（5min TTL）').toMatch(/^\d{6}$/)
    await page.getByPlaceholder('请输入邮箱验证码').fill(code)
    await page.getByPlaceholder('请输入新密码').fill(newPassword)
    await page.getByPlaceholder('请再次输入新密码').fill(newPassword)
    await page.getByRole('button', { name: '提交', exact: true }).click()
    // 成功跳回登录页
    await expect(page).toHaveURL(/#\/auth\/login/, { timeout: 10_000 })

    // 旧密码登录失败、新密码登录成功（API 级，SM2 同构加密）
    const oldAttempt = await apiLogin(page, username, oldPassword)
    expect(oldAttempt.code, '旧密码须登录失败').not.toBe(200)
    const newAttempt = await apiLogin(page, username, newPassword)
    expect(newAttempt.code, `新密码须登录成功：${newAttempt.msg || ''}`).toBe(200)
    expect(newAttempt.data.token).not.toBe('')
  } finally {
    await page.unroute('**/api/auth/captcha')
    psql(
      `DELETE FROM sys_user_role WHERE user_id=${userId}; DELETE FROM sys_user WHERE id=${userId};`
    )
  }
})

test('W5-2 登录页第三方登录区与 /auth/social/sources 一致（无源且未开 mock 才整区不可见）', async () => {
  const resp = await page.request.fetch('/api/auth/social/sources')
  const body = (await resp.json()).data
  const sources = (body.sources || []) as string[]
  const mockEnabled = !!body.mockEnabled

  await page.goto('/#/auth/login')
  if (sources.length === 0 && mockEnabled) {
    // 无真实源但后端放开了 mock：dev 下整区可见，只提供「模拟第三方登录」入口
    await expect(page.getByText('第三方登录').first()).toBeVisible()
    await expect(page.getByRole('button', { name: '模拟第三方登录' })).toBeVisible()
  } else if (sources.length === 0) {
    // 无真实源且后端未放开 mock：整区不可见
    await expect(page.getByText('第三方登录')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '模拟第三方登录' })).toHaveCount(0)
  } else {
    // 有真实源：每个源渲染真实按钮
    await expect(page.getByText('第三方登录')).toBeVisible()
    for (const src of sources) {
      await expect(
        page.getByRole('button', { name: `${SOCIAL_LABELS[src] || src} 登录` })
      ).toBeVisible()
    }
  }
})

test('W5-3 个人中心：mock 绑定区不可见 + 邮箱/手机/头像位展示', async () => {
  const sourcesResp = await page.request.fetch('/api/auth/social/sources')
  const mockEnabled = !!(await sourcesResp.json()).data.mockEnabled

  await login(page)
  await page.goto('/#/system/user-center')
  await expect(page.getByText('个人信息')).toBeVisible({ timeout: 10_000 })

  // 联系方式展示位（脱敏由后端既有裁决，可能为明文/脱敏/未绑定）
  await expect(page.getByText('邮箱', { exact: true })).toBeVisible()
  await expect(page.getByText('手机', { exact: true })).toBeVisible()
  // 头像上传入口
  await expect(page.getByRole('button', { name: '更换头像' })).toBeVisible()

  if (!mockEnabled) {
    // 后端未允许 mock：第三方绑定区整卡不可见（含 DEV 构建）
    await expect(page.getByText('第三方账号')).toHaveCount(0)
    await expect(page.getByText('模拟第三方（mock）')).toHaveCount(0)
  } else {
    await expect(page.getByText('第三方账号')).toBeVisible()
  }
})
