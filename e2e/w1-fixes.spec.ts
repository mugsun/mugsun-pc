import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, logout, readCaptchaCode, readAccessToken } from './fixtures/auth'
import { purgeAttaches } from './helpers/cleanup'

/**
 * W1「一眼假清理」逐项真实浏览器验证。
 * 每一项先复现原症状场景，再断言修复后的真实行为。
 */

const REMEMBER_KEY = 'mugsun.remembered-username'

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -c "${sql}"`, {
    encoding: 'utf-8'
  })
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})

test.afterAll(async () => {
  // 附件上传用例每轮留一条 w1-shot.png；磁盘文件被清后这些行会让附件页缩略图 404，
  // 巡访用例把 404 记成 console.error，于是 /system/attach 一路红
  purgeAttaches('w1-shot.png')
  await page?.close()
})

test('W1-R3 接口加解密演示页真实可用（不再 401）', async () => {
  await login(page)
  await page.goto('/#/system/crypto')
  const echoResp = page.waitForResponse(
    (r) => r.url().includes('/system/crypto/echo') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: '加密发送' }).click()
  const resp = await echoResp
  expect(resp.status(), 'echo 接口须 200（修复前恒 401）').toBe(200)
  // 服务端确实加密返回（dataType=ENCRYPT，网络面板为密文）
  const body = await resp.json()
  expect(body.dataType, '响应 data 须 SM4 加密').toBe('ENCRYPT')
  // ④ 前端解密结果还原出含原文的回声数据
  await expect(page.locator('.plain')).toContainText('你好，Mugsun 国密加解密！', {
    timeout: 10_000
  })
})

test('W1-R4/R5 顶栏假聊天与死链入口已清除', async () => {
  await login(page)
  await page.goto('/#/dashboard/console')
  // 假聊天按钮不存在
  await expect(page.locator('.chat-button')).toHaveCount(0)
  // 快速入口死链不存在
  await expect(page.getByText('分析页')).toHaveCount(0)
  await expect(page.getByText('礼花效果')).toHaveCount(0)
  await expect(page.getByText('哔哩哔哩')).toHaveCount(0)
  await expect(page.getByText('留言管理')).toHaveCount(0)
  // 用户菜单：无 文档/Github/锁屏（打开 '#' 或客户端伪锁）
  await page
    .locator('.user-menu-popover')
    .waitFor({ state: 'attached' })
    .catch(() => {})
  await page.locator('img[alt="avatar"]').first().hover()
  const popover = page.locator('.user-menu-popover:visible').last()
  await expect(popover.getByText('个人中心')).toBeVisible()
  await expect(popover.getByText('锁定屏幕')).toHaveCount(0)
  await expect(popover.getByText('使用文档')).toHaveCount(0)
  await expect(popover.getByText('Github')).toHaveCount(0)
  await expect(popover.getByText('意见反馈')).toBeVisible()
})

test('W1-H13 流程定义页演示按钮已移除', async () => {
  await login(page)
  await page.goto('/#/system/flow-def')
  await expect(page.getByRole('button', { name: '设计流程' })).toBeVisible()
  await expect(page.getByRole('button', { name: '部署请假流程' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '发起请假' })).toHaveCount(0)
})

test('W1-R6 记住账号真实生效与取消', async () => {
  // 勾选「记住账号」登录 → 持久化用户名
  await logout(page)
  await login(page, { remember: true })
  const remembered = await page.evaluate((k) => localStorage.getItem(k), REMEMBER_KEY)
  expect(remembered).toBe('admin')

  // 重新打开登录页：账号已回填且勾选保持
  await logout(page)
  await page.goto('/#/auth/login')
  await expect(page.getByPlaceholder(/请输入账号|用户名/i).first()).toHaveValue('admin')
  await expect(page.locator('form .el-checkbox input[type="checkbox"]').first()).toBeChecked()

  // 不勾选再登录 → 清除记忆
  await login(page, { remember: false })
  const cleared = await page.evaluate((k) => localStorage.getItem(k), REMEMBER_KEY)
  expect(cleared).toBeNull()
})

test('W1-R8/R2 自助注册分配默认角色 + 定时任务读接口按权限拒绝', async () => {
  const username = `e2e_w1_${Date.now() % 100000}`
  const password = 'W1test@12345'
  await logout(page)

  // —— 真实 UI 注册（含图形验证码、协议勾选） ——
  let captured = ''
  await page.route('**/api/auth/captcha', async (route) => {
    const resp = await route.fetch()
    try {
      const json = await resp.json()
      if (json?.data?.captchaUuid) captured = json.data.captchaUuid
    } catch {
      /* ignore */
    }
    await route.fulfill({ response: resp })
  })
  await page.goto('/#/auth/register')
  await expect.poll(() => captured, { timeout: 10_000 }).not.toBe('')
  const code = readCaptchaCode(captured)
  await page.unroute('**/api/auth/captcha')

  const inputs = page.locator('form .el-input__inner')
  await inputs.nth(0).fill(username)
  await inputs.nth(1).fill(password)
  await inputs.nth(2).fill(password)
  await inputs.nth(4).fill(code) // 第 4 个输入框是验证码（第 3 个手机号选填跳过）
  // 点复选框方格（容器内嵌隐私政策链接，点容器会误触跳转）
  await page.locator('form .el-checkbox__inner').first().click()
  await page.locator('form button').last().click()
  await expect(page.getByText('注册成功').first()).toBeVisible({ timeout: 10_000 })

  // —— 新用户登录：可见工作台与公共菜单、不可见任何管理菜单（W3 后端菜单：系统管理组因公共子项存在） ——
  await login(page, { username, password })
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(page.getByText('工作台').first()).toBeVisible()
  await page.getByText('系统管理', { exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: '我的通知' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('menuitem', { name: '用户管理' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: '角色管理' })).toHaveCount(0)
  await expect(page.getByText('租户运营', { exact: true })).toHaveCount(0)

  // —— 该用户调定时任务读接口被拒（修复前任意登录可读） ——
  const userToken = await readAccessToken(page)
  const denied = await page.request.get('/api/system/job/list', {
    headers: { Authorization: userToken }
  })
  expect(denied.status(), '无权限用户读任务列表须 403').toBe(403)

  // —— admin 不受影响 ——
  await logout(page)
  await login(page)
  const adminToken = await readAccessToken(page)
  const allowed = await page.request.get('/api/system/job/list', {
    headers: { Authorization: adminToken }
  })
  expect(allowed.status()).toBe(200)

  // 清理测试用户（物理删除测试数据）
  psql(
    `DELETE FROM sys_user_role WHERE user_id IN (SELECT id FROM sys_user WHERE username='${username}'); DELETE FROM sys_user WHERE username='${username}';`
  )
})

test('W1-补充 注册页隐私政策链接真实可达（此前指向不存在路由）', async () => {
  await logout(page)
  await page.goto('/#/auth/register')
  await page.getByText('隐私政策').click()
  await expect(page).toHaveURL(/\/privacy-policy/)
  await expect(page.getByRole('heading', { name: '隐私政策' })).toBeVisible()
})

test('W1-H12 反馈附件可真实下载', async () => {
  const content = `W1 附件下载验证反馈 ${Date.now() % 100000}`
  await login(page)
  // 经用户菜单打开意见反馈弹窗
  await page.locator('img[alt="avatar"]').first().hover()
  await page.locator('.user-menu-popover:visible').last().getByText('意见反馈').click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').first().fill(content)
  // 上传附件（弹窗限定图片类型，用 PNG）
  const uploadResp = page.waitForResponse((r) => r.url().includes('/system/file/upload'))
  await page.locator('input[type="file"]').setInputFiles({
    name: 'w1-shot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  })
  expect((await uploadResp).status(), '附件上传须 200').toBe(200)
  await expect(dialog.getByText('w1-shot.png')).toBeVisible({ timeout: 10_000 })
  const submitResp = page.waitForResponse((r) => r.url().includes('/feedback/submit'))
  await dialog.getByRole('button', { name: /提交|确定/i }).click()
  expect((await submitResp).status(), '反馈提交须 200').toBe(200)
  await expect(page.getByText('感谢你的反馈').first()).toBeVisible({ timeout: 10_000 })

  // 管理页找到该反馈，点击附件下载（修复前显示「—」）
  await page.goto('/#/system/feedback')
  const row = page.getByRole('row', { name: new RegExp(content) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  const downloadEvent = page.waitForEvent('download', { timeout: 10_000 })
  await row.getByRole('button', { name: /w1-shot\.png|下载附件/ }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toContain('w1-shot')
  // 清理测试反馈
  psql(`DELETE FROM sys_feedback WHERE content='${content}';`)
})
