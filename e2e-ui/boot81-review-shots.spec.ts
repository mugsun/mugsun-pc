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

/** 覆盖 seedSession 写入的 user.info，强制改密态 */
async function seedForceChange(page: Page, uiLang: string, uiTheme: string) {
  await seedSession(page, uiLang, uiTheme)
  await page.addInitScript(() => {
    const VERSION = '3.0.2'
    const key = `sys-v${VERSION}-user`
    try {
      const cur = JSON.parse(localStorage.getItem(key) || '{}')
      const info = { ...(cur.info || {}), needChangePassword: true }
      localStorage.setItem(key, JSON.stringify({ ...cur, info }))
    } catch {
      /* ignore */
    }
  })
}

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
  await page.screenshot({ path: path.join(OUT, name), fullPage: false })
}

test.describe('boot81 otp / force-change shots', () => {
  test('a force-change zh 1440: nickname disabled + pwd focused', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedForceChange(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText('请先修改初始口令')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.uc-nickname-card input').first()).toBeDisabled({ timeout: 10_000 })
    await expect(page.locator('.uc-pwd-card input').first()).toBeFocused({ timeout: 10_000 })
    await shot(page, 'a-force-change-zh-light-1440.png')
  })

  test('b force-change zh 390: pwd card first', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedForceChange(page, 'zh', 'light')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText('请先修改初始口令')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    await shot(page, 'b-force-change-zh-light-390.png')
  })

  test('c tenant OTP close confirm before copy', async ({ page }) => {
    await mockApis(page, { needChangePassword: false })
    await seedSession(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/saas/tenant')
    await expect(page.locator('.tenant-page, .el-table').first()).toBeVisible({ timeout: 30_000 })
    await page
      .getByRole('button', { name: /新建|新增|创建|New|Create|Add/ })
      .first()
      .click()
    const dialog = page
      .locator('.el-dialog')
      .filter({ hasText: /租户|Tenant/ })
      .last()
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await dialog.locator('input').first().fill('截图租户')
    await dialog.getByRole('button', { name: /提交|保存|确定|Submit|Save|OK/ }).click()
    await expect(page.getByText('OtP-Mock-Tenant-9x')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.el-message-box').first()).toBeVisible()
    // 未复制：点 X → 二次确认
    await page.locator('.el-message-box__headerbtn').first().click()
    await expect(page.getByText('口令关闭后无法再查看')).toBeVisible({ timeout: 10_000 })
    await shot(page, 'c-tenant-otp-close-confirm-zh-1440.png')
  })

  test('d reset OTP rows + copied feedback zh 1440', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
      // headless 下保证 writeText 成功，才能触发「已复制」
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => undefined,
          readText: async () => ''
        }
      })
    })
    await mockApis(page, { needChangePassword: false })
    await seedSession(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user')
    await expect(page.getByText('fronttest')).toBeVisible({ timeout: 30_000 })
    const row = page.locator('.el-table__row').filter({ hasText: 'fronttest' }).first()
    await row.getByRole('button', { name: /重置|Reset/ }).click()
    await page.getByRole('button', { name: /确定|确认|OK|Confirm/ }).click()
    await expect(page.getByText('OtP-Mock-Reset-3k')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('账号', { exact: true })).toBeVisible()
    await expect(page.getByText('一次性口令', { exact: true })).toBeVisible()
    // 点口令行复制 → 已复制
    const pwdRow = page.locator('.otp-box__row').filter({ hasText: 'OtP-Mock-Reset-3k' })
    await pwdRow.getByRole('button', { name: '复制' }).click()
    await expect(pwdRow.getByRole('button', { name: '已复制' })).toBeVisible({ timeout: 5_000 })
    await shot(page, 'd-user-reset-otp-copied-zh-light-1440.png')
  })

  test('e reset OTP dark 1440', async ({ page }) => {
    await mockApis(page, { needChangePassword: false })
    await seedSession(page, 'zh', 'dark')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user')
    await expect(page.getByText('fronttest')).toBeVisible({ timeout: 30_000 })
    const row = page.locator('.el-table__row').filter({ hasText: 'fronttest' }).first()
    await row.getByRole('button', { name: /重置|Reset/ }).click()
    await page.getByRole('button', { name: /确定|确认|OK|Confirm/ }).click()
    await expect(page.getByText('OtP-Mock-Reset-3k')).toBeVisible({ timeout: 15_000 })
    await shot(page, 'e-user-reset-otp-zh-dark-1440.png')
  })
})
