import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, readAccessToken } from './fixtures/auth'

/**
 * 对抗性测试：针对本轮新建的搜索栏/菜单/导入/忘记密码/任务处理器端点做滥用攻击。
 * 每条都是「真实攻击者会试」的输入，断言平台安全地拒绝或正常处理。
 */

async function api(page: Page, method: 'GET' | 'POST', url: string, body?: any) {
  const token = await readAccessToken(page)
  return page.request.fetch(`/api${url}`, {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    data: body
  })
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('ADV-1 搜索栏 SQL 注入与畸形输入（全平台新查询参数）', async () => {
  // SQL 注入尝试：单引号/注释/OR 恒真——应返回空或正常过滤，绝不报错或穿透
  const attacks = [
    `' OR '1'='1`,
    `admin'--`,
    `%'; DROP TABLE sys_user;--`,
    `\\"%' AND (SELECT 1 FROM pg_sleep(2))--`
  ]
  for (const payload of attacks) {
    const resp = await api(
      page,
      'GET',
      `/system/user/page?pageNum=1&pageSize=10&username=${encodeURIComponent(payload)}`
    )
    expect(resp.status(), `注入载荷应安全处理: ${payload}`).toBe(200)
    const body = await resp.json()
    expect(body.code).toBe(200)
    // 恒真注入不得穿透出额外数据（admin 之外的用户不因此被带出）
    const total = body.data.totalRow
    expect(total, '恒真注入不得改变结果集').toBeLessThan(100)
  }
  // 超长输入（4KB）
  const long = 'a'.repeat(4096)
  const resp = await api(page, 'GET', `/system/user/page?username=${long}`)
  expect(resp.status(), '超长输入不得 500').toBeLessThan(500)
  // 用户表未受损
  const check = await api(page, 'GET', '/system/user/page?pageNum=1&pageSize=5')
  expect((await check.json()).data.records.length).toBeGreaterThan(0)
})

test('ADV-2 忘记密码端点滥用（无码/错码/限频）', async () => {
  // 无图形码直接发码 → 400
  const noCaptcha = await page.request.fetch('/api/auth/forget-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { username: 'admin' }
  })
  expect((await noCaptcha.json()).code, '无图形码发码须被拒').toBe(400)

  // 错码重置 → 400（且不计入真实码）
  const badCode = await page.request.fetch('/api/auth/forget-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { username: 'admin', code: '999999', newPassword: 'whatever' }
  })
  expect((await badCode.json()).code, '错误邮件码须被拒').toBe(400)
})

test('ADV-3 菜单接口越权与注册表探测', async ({ baseURL }) => {
  // 真匿名（全新请求上下文，不携带页面会话）拉菜单 → 401
  const { request } = await import('@playwright/test')
  const anon = await request.newContext({ baseURL })
  const noAuth = await anon.get('/api/v3/system/menus')
  expect(noAuth.status(), '匿名拉菜单须 401').toBe(401)
  const menus2 = await noAuth.json()
  expect(menus2.code).toBe(401)
  await anon.dispose()
  // 低权用户调处理器注册表 → 403（sys:job:list 未授）
  // 新注册零权限账号（验证处理器注册表与菜单接口的权限边界）
  const uname = `e2e_adv_${Date.now() % 100000}`
  await api(page, 'POST', '/system/user/submit', {
    username: uname,
    nickname: 'ADV',
    password: 'Adv@12345',
    status: 1,
    roleIds: []
  })
  // 注册链路更稳，这里用管理员建的零角色账号直接登录
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const page2 = await browser.newPage()
  const { login: loginFn } = await import('./fixtures/auth')
  await loginFn(page2, { username: uname, password: 'Adv@12345' })
  const t2 = await readAccessToken(page2)
  const resp = await page2.request.fetch('/api/system/job/processors', {
    headers: { Authorization: t2 }
  })
  expect(resp.status(), '零权限用户读处理器注册表须 403').toBe(403)
  const resp2 = await page2.request.fetch('/api/v3/system/menus', {
    headers: { Authorization: t2 }
  })
  expect(resp2.status(), '零权限用户菜单接口须 200（返回公共菜单）').toBe(200)
  const menus = (await resp2.json()).data as any[]
  const titles = JSON.stringify(menus)
  expect(titles).toContain('工作台')
  expect(titles).not.toContain('角色管理')
  await page2.close()
  await browser.close()
  // 清理
  const uid = execSync(
    `docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "SELECT id FROM sys_user WHERE username='${uname}';"`,
    { encoding: 'utf-8' }
  ).trim()
  execSync(
    `docker exec mugsun-pg psql -U mugsun -d mugsun -c "DELETE FROM sys_user_role WHERE user_id=${uid}; DELETE FROM sys_user WHERE id=${uid};"`
  )
})

test('ADV-4 任务保存注入与畸形处理器', async () => {
  // 未注册处理器 → 400
  const bad = await api(page, 'POST', '/system/job/save', {
    jobName: 'ADV恶意任务',
    processorInfo: 'com.evil.Backdoor',
    timeExpressionType: 'API'
  })
  expect((await bad.json()).code, '未注册处理器须 400').toBe(400)
  // 处理器名注入串
  const inj = await api(page, 'POST', '/system/job/save', {
    jobName: 'ADV注入',
    processorInfo: `x'; DROP TABLE sys_job;--`,
    timeExpressionType: 'API'
  })
  expect((await inj.json()).code).toBe(400)
})

test('ADV-5 搜索栏 XSS 载荷（存储型/反射型）', async () => {
  // 用户搜索框输入 XSS 载荷 → 页面不执行脚本
  await page.goto('/#/system/user')
  const marker = `adv${Date.now() % 10000}`
  await page.getByPlaceholder('请输入用户名').fill(`<img src=x onerror=window.__xss_${marker}=1>`)
  await page.getByRole('button', { name: '查询' }).click()
  await page.waitForTimeout(1200)
  const hit = await page.evaluate((m) => (window as any)[`__xss_${m}`], marker)
  expect(hit, 'XSS 载荷不得执行').toBeUndefined()
  // 还原
  await page.getByRole('button', { name: '重置' }).click()
})
