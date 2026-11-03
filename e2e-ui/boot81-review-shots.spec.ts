/**
 * boot#81 一次性口令 + 强制改密 UI 自查截图（前端 mock，非真后端）。
 * 运行：pnpm exec playwright test -c playwright.boot81-shots.config.ts
 */
import path from 'node:path'
import fs from 'node:fs'
import { expect, type Page } from '@playwright/test'
import { test, seedSession } from './support/session'

const OUT = process.env.BOOT81_SHOT_DIR || path.resolve('artifacts/pc-boot81-ui')
const WATERMARK = '前端 mock 数据'

fs.mkdirSync(OUT, { recursive: true })

async function stamp(page: Page) {
  await page.evaluate((text) => {
    const id = 'boot81-mock-watermark'
    let el = document.getElementById(id)
    if (!el) {
      el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    }
    el.textContent = text
    Object.assign(el.style, {
      position: 'fixed',
      right: '12px',
      bottom: '12px',
      zIndex: '2147483647',
      padding: '4px 8px',
      borderRadius: '4px',
      background: 'rgba(0,0,0,0.55)',
      color: '#fff',
      fontSize: '12px',
      pointerEvents: 'none'
    })
  }, WATERMARK)
}

async function mockApis(page: Page, opts: { needChangePassword?: boolean } = {}) {
  const info = {
    userId: 1,
    userName: 'admin',
    nickName: 'Admin',
    email: 'admin@example.com',
    roles: ['R_SUPER'],
    buttons: ['*:*:*'],
    needChangePassword: !!opts.needChangePassword,
    watermark: false,
    gisEnabled: true,
    trackEnabled: true,
    aiEnabled: true
  }
  const ok = (data: unknown, msg = 'ok') => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg, data })
  })
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const u = route.request().url()
      const method = route.request().method()
      if (u.includes('/auth/info')) {
        await route.fulfill(ok(info))
        return
      }
      if (u.includes('/auth/sm2-public-key')) {
        await route.fulfill(ok({ gmEnabled: false, publicKey: '' }))
        return
      }
      if (u.includes('/crypto/bootstrap')) {
        await route.fulfill(
          ok({ algorithm: 'SM4-GCM', keyHex: '00'.repeat(16), keySource: 'mock' })
        )
        return
      }
      if (u.includes('/system/tenant/create') && method === 'POST') {
        await route.fulfill(
          ok(
            { tenantCode: '866786', initialPassword: 'OtP-Mock-Tenant-9x' },
            '已创建。编号 866786。管理员账号 admin，一次性口令仅此一次返回；首次登录须改密'
          )
        )
        return
      }
      if (u.includes('/system/tenant/list') || u.includes('/system/tenant-package')) {
        await route.fulfill(
          ok([
            {
              id: 1,
              tenantName: '演示租户',
              tenantCode: '100000',
              status: 1,
              packageId: 1,
              packageName: '基础套餐'
            }
          ])
        )
        return
      }
      if (u.includes('/system/user/reset-password') && method === 'POST') {
        await route.fulfill(
          ok(
            [{ id: 2, username: 'fronttest', initialPassword: 'OtP-Mock-Reset-3k' }],
            '已重置为一次性口令，请立刻交给对方；首次登录须改密'
          )
        )
        return
      }
      if (u.includes('/system/user/page')) {
        await route.fulfill(
          ok({
            records: [
              {
                id: 2,
                username: 'fronttest',
                nickname: 'Front',
                status: 1,
                createTime: '2026-01-01 00:00:00'
              }
            ],
            total: 1,
            current: 1,
            size: 10
          })
        )
        return
      }
      if (u.includes('/system/user/submit') && method === 'POST') {
        await route.fulfill(
          ok({ initialPassword: 'OtP-Mock-Create-7q' }, '已创建。一次性口令仅此一次返回')
        )
        return
      }
      if (u.includes('/system/dept') || u.includes('/system/post') || u.includes('/system/dict')) {
        await route.fulfill(ok([]))
        return
      }
      if (u.includes('/system/gis/status')) {
        await route.fulfill(
          ok({ enabled: true, providers: [{ code: 'mock', configured: true, enabled: true }] })
        )
        return
      }
      if (/\/(page|list)\b/.test(u)) {
        await route.fulfill(ok({ records: [], list: [], rows: [], total: 0, current: 1, size: 10 }))
        return
      }
      await route.fulfill(ok([]))
    }
  )
  await page.routeWebSocket(/\/api\/ws\//, () => {})
}

async function shot(page: Page, name: string) {
  await stamp(page)
  await page.screenshot({
    path: path.join(OUT, name),
    fullPage: false
  })
}

test.describe('boot81 otp / force-change shots', () => {
  test('force-change banner on user-center (zh light 1440)', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedSession(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText(/请先修改初始口令|Change your password first/)).toBeVisible({
      timeout: 30_000
    })
    await shot(page, '01-force-change-user-center-zh-light-1440.png')
  })

  test('force-change banner dark + narrow', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedSession(page, 'zh', 'dark')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText(/请先修改初始口令/)).toBeVisible({ timeout: 30_000 })
    await shot(page, '02-force-change-user-center-zh-dark-390.png')
  })

  test('force-change banner en', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedSession(page, 'en', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText(/Change your password first/)).toBeVisible({ timeout: 30_000 })
    await shot(page, '03-force-change-user-center-en-light-1440.png')
  })

  test('tenant create OTP dialog', async ({ page }) => {
    await mockApis(page, { needChangePassword: false })
    await seedSession(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/saas/tenant')
    await expect(page.locator('.tenant-page, .el-table').first()).toBeVisible({ timeout: 30_000 })
    // 打开新建
    const createBtn = page.getByRole('button', { name: /新建|新增|创建|New|Create|Add/ }).first()
    await createBtn.click()
    const dialog = page
      .locator('.el-dialog')
      .filter({ hasText: /租户|Tenant/ })
      .last()
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await dialog.locator('input').first().fill('截图租户')
    await dialog.getByRole('button', { name: /提交|保存|确定|Submit|Save|OK/ }).click()
    await expect(page.getByText('OtP-Mock-Tenant-9x')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.el-message-box')).toBeVisible()
    await page.waitForTimeout(200)
    await shot(page, '04-tenant-create-otp-dialog-zh-light-1440.png')
  })

  test('user reset OTP dialog', async ({ page }) => {
    await mockApis(page, { needChangePassword: false })
    await seedSession(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user')
    await expect(page.getByText('fronttest')).toBeVisible({ timeout: 30_000 })
    // 行操作「重置密码」
    const row = page.locator('.el-table__row').filter({ hasText: 'fronttest' }).first()
    await row.getByRole('button', { name: /重置|Reset/ }).click()
    await page.getByRole('button', { name: /确定|确认|OK|Confirm/ }).click()
    await expect(page.getByText('OtP-Mock-Reset-3k')).toBeVisible({ timeout: 15_000 })
    await shot(page, '05-user-reset-otp-dialog-zh-light-1440.png')
  })
})
