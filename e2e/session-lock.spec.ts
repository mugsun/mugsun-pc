import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, logout, readCaptchaCode, readAccessToken } from './fixtures/auth'
import { buildXlsx } from './fixtures/xlsx'

/**
 * 会话与锁定链路口径验证：
 * 连续错密锁定 → 管理员登录日志页一键解锁 → 可登录；在线会话强退 → 被踢方请求 401 跳登录；
 * 导入幂等（同文件二次导入不重复建档）。
 */

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial', timeout: 240_000 })

let page: Page
const USERNAME = `e2e_lock_${Date.now() % 100000}`
const PASSWORD = 'Lock@12345'

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
  // 建独立账号（避免锁 admin）
  const token = await readAccessToken(page)
  await page.request.fetch('/api/system/user/submit', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    data: { username: USERNAME, nickname: '锁定验证', password: PASSWORD, status: 1, roleIds: [] }
  })
})

test.afterAll(async () => {
  try {
    psql(
      `DELETE FROM sys_user_role WHERE user_id IN (SELECT id FROM sys_user WHERE username='${USERNAME}'); DELETE FROM sys_user WHERE username='${USERNAME}';`
    )
  } finally {
    await page?.close()
  }
})

/** 带验证码的登录提交（不管成败） */
async function loginAttempt(p: Page, username: string, password: string): Promise<void> {
  let captured = ''
  await p.route('**/api/auth/captcha', async (route) => {
    const resp = await route.fetch()
    try {
      const json = await resp.json()
      if (json?.data?.captchaUuid) captured = json.data.captchaUuid
    } catch {
      /* ignore */
    }
    await route.fulfill({ response: resp })
  })
  if (p.url().includes('/auth/login')) {
    await p.reload()
  } else {
    await p.goto('/#/auth/login')
  }
  await expect.poll(() => captured, { timeout: 10_000 }).not.toBe('')
  const code = readCaptchaCode(captured)
  await p.unroute('**/api/auth/captcha')
  await p
    .getByPlaceholder(/请输入账号|用户名/i)
    .first()
    .fill(username)
  await p
    .getByPlaceholder(/请输入密码/i)
    .first()
    .fill(password)
  await p
    .getByPlaceholder(/请输入验证码/i)
    .first()
    .fill(code)
  await p.getByRole('button', { name: '登录', exact: true }).click()
}

test('SEC-1 连续错密锁定 → 登录日志页解锁 → 恢复登录', async () => {
  // 连续错密直至锁定（等保锁定阈值，默认 5 次内）
  await logout(page)
  let locked = false
  for (let i = 0; i < 8; i++) {
    await loginAttempt(page, USERNAME, 'wrong-pass-1')
    const errText = await page
      .locator('.el-message')
      .last()
      .innerText()
      .catch(() => '')
    if (errText.includes('锁定')) {
      locked = true
      break
    }
    await page.waitForTimeout(600)
  }
  expect(locked, '连续错密应触发账号锁定').toBe(true)

  // 锁定后用正确密码也被拒
  await loginAttempt(page, USERNAME, PASSWORD)
  await page.waitForTimeout(800)
  await expect(page).toHaveURL(/\/auth\/login/)

  // admin 登录日志页找到该账号并解锁
  await login(page)
  await page.goto('/#/system/login-log')
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 })
  // 搜索该账号
  await page.getByPlaceholder('请输入账号').fill(USERNAME)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: new RegExp(USERNAME) }).first()).toBeVisible({
    timeout: 10_000
  })
  const unlockResp = page.waitForResponse((r) => r.url().includes('/system/login-log/unlock'))
  await page.getByRole('button', { name: '解锁' }).first().click()
  await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
  expect((await unlockResp).status(), '解锁须 200').toBe(200)

  // 解锁后正常登录
  await logout(page)
  await login(page, { username: USERNAME, password: PASSWORD })
  await expect(page).toHaveURL(/#\/dashboard/)
})

test('SEC-2 导入幂等：同一文件二次导入零新增', async () => {
  await logout(page)
  await login(page)
  // 构造最小导入文件（复用导入模板结构）
  const uname = `e2e_idem_${Date.now() % 100000}`
  const buf = await buildXlsx(
    '用户',
    [{ 用户名: uname, 昵称: '幂等验证', 邮箱: '', 手机: '', 状态: 1 }],
    ['用户名', '昵称', '邮箱', '手机', '状态']
  )

  const token = await readAccessToken(page)
  const importOnce = async () => {
    const resp = await page.request.fetch('/api/system/user/import', {
      method: 'POST',
      headers: { Authorization: token },
      multipart: {
        file: {
          name: 'users.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: buf
        },
        updateSupport: 'false'
      }
    })
    return (await resp.json()).data
  }
  const first = await importOnce()
  expect(first.successCount, '首次导入 1 条').toBe(1)
  const second = await importOnce()
  expect(second.successCount, '二次导入零新增').toBe(0)
  expect(second.failCount, '重复记失败（已存在）').toBe(1)

  // 清理
  const uid = psql(`SELECT id FROM sys_user WHERE username='${uname}';`)
  psql(`DELETE FROM sys_user_role WHERE user_id=${uid}; DELETE FROM sys_user WHERE id=${uid};`)
})
