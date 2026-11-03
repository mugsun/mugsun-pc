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

/** 视口内可见（非仅 DOM attached） */
async function expectInViewport(page: Page, locator: ReturnType<Page['locator']>) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, 'missing box').toBeTruthy()
  const vp = page.viewportSize()!
  expect(box!.y + box!.height > 0 && box!.y < vp.height).toBeTruthy()
}

test.describe('boot81 otp / force-change shots', () => {
  test('a-v2 force-change controls disabled zh 1440', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedForceChange(page, 'zh', 'light')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText('请先修改初始口令')).toBeVisible({ timeout: 30_000 })

    const avatarBtn = page.getByRole('button', { name: '更换头像' })
    const saveBtn = page.locator('.uc-nickname-save')
    await expect(avatarBtn).toBeDisabled({ timeout: 10_000 })
    await expect(saveBtn).toBeDisabled({ timeout: 10_000 })
    await expect(avatarBtn).toHaveAttribute('aria-disabled', 'true')
    await expect(saveBtn).toHaveAttribute('aria-disabled', 'true')

    // 局部特写：把头像区与昵称保存拼进同一张图（滚动昵称卡入视口后裁切两区）
    await stamp(page)
    const avatarShot = path.join(OUT, '_tmp-avatar.png')
    const nickShot = path.join(OUT, '_tmp-nick.png')
    await page.locator('.uc-avatar-row').screenshot({ path: avatarShot })
    await page.locator('.uc-nickname-card').scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await page.locator('.uc-nickname-card').screenshot({ path: nickShot })

    // 用页面合成一条标注条图，避免依赖本机 Pillow；改用 canvas 在 page 内拼
    await page.evaluate(
      async ({ aB64, nB64, outHint }) => {
        const load = (b64: string) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const img = new Image()
            img.onload = () => res(img)
            img.onerror = rej
            img.src = 'data:image/png;base64,' + b64
          })
        const a = await load(aB64)
        const n = await load(nB64)
        const pad = 16
        const labelH = 28
        const w = Math.max(a.width, n.width) + pad * 2
        const h = labelH + a.height + pad + labelH + n.height + pad * 2
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#f5f7fa'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#303133'
        ctx.font = '14px sans-serif'
        ctx.fillText('更换头像（强制改密 · 已禁用）', pad, 20)
        ctx.drawImage(a, pad, labelH)
        ctx.fillText('昵称保存（强制改密 · 已禁用）', pad, labelH + a.height + pad + 20)
        ctx.drawImage(n, pad, labelH + a.height + pad + labelH)
        ;(window as any).__boot81Composite = canvas.toDataURL('image/png')
        void outHint
      },
      {
        aB64: fs.readFileSync(avatarShot).toString('base64'),
        nB64: fs.readFileSync(nickShot).toString('base64'),
        outHint: 'a-v2'
      }
    )
    const dataUrl = await page.evaluate(() => (window as any).__boot81Composite as string)
    const b64 = dataUrl.split(',')[1]
    fs.writeFileSync(
      path.join(OUT, 'a-v2-force-change-controls-zh-1440.png'),
      Buffer.from(b64, 'base64')
    )
    fs.rmSync(avatarShot, { force: true })
    fs.rmSync(nickShot, { force: true })
  })

  test('b-v2 force-change zh 390 first screen banner+pwd', async ({ page }) => {
    await mockApis(page, { needChangePassword: true })
    await seedForceChange(page, 'zh', 'light')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#/system/user-center')
    await expect(page.getByText('请先修改初始口令')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(500)
    await expectInViewport(page, page.locator('.uc-force-pwd-alert'))
    await expectInViewport(page, page.locator('.uc-pwd-card'))
    await expectInViewport(page, page.locator('.uc-pwd-card').getByText('原密码', { exact: false }))
    await expectInViewport(
      page,
      page.locator('.uc-pwd-card').getByRole('button', { name: /保存|Save/ })
    )
    await shot(page, 'b-v2-force-change-zh-390.png')
  })

  test('c-v2 tenant OTP close confirm both dialogs', async ({ page }) => {
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
    const otpBox = page.locator('.el-message-box').filter({ hasText: 'OtP-Mock-Tenant-9x' })
    await expect(otpBox).toBeVisible()
    // 未复制：点 X → 二次确认（主弹窗须仍在）
    await otpBox.locator('.el-message-box__headerbtn').click()
    const confirmBox = page.locator('.el-message-box.otp-close-confirm-box')
    await expect(confirmBox).toBeVisible({ timeout: 10_000 })
    await expect(confirmBox.getByText('口令关闭后无法再查看，确定关闭？')).toBeVisible()
    await expect(confirmBox.getByRole('button', { name: '继续查看' })).toBeVisible()
    await expect(confirmBox.getByRole('button', { name: '仍要关闭' })).toBeVisible()
    // 主 OTP + 二次确认必须同屏
    await expect(otpBox).toBeVisible()
    await expect(page.getByText('OtP-Mock-Tenant-9x')).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, 'c-v2-tenant-otp-close-confirm-zh-1440.png')
  })

  test('d reset OTP rows + copied feedback zh 1440', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.addInitScript(() => {
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
    const pwdRow = page.locator('.otp-box__row').filter({ hasText: 'OtP-Mock-Reset-3k' })
    await pwdRow.getByRole('button', { name: '复制' }).click()
    await expect(pwdRow.getByRole('button', { name: '已复制' })).toBeVisible({ timeout: 5_000 })
    await shot(page, 'd-user-reset-otp-copied-zh-light-1440.png')
  })

  test('e-v2 reset OTP dark dialog open 1440', async ({ page }) => {
    await mockApis(page, { needChangePassword: false })
    await seedSession(page, 'zh', 'dark')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/#/system/user')
    await expect(page.getByText('fronttest')).toBeVisible({ timeout: 30_000 })
    const row = page.locator('.el-table__row').filter({ hasText: 'fronttest' }).first()
    await row.getByRole('button', { name: /重置|Reset/ }).click()
    await page.getByRole('button', { name: /确定|确认|OK|Confirm/ }).click()
    const otp = page.locator('.el-message-box').filter({ hasText: 'OtP-Mock-Reset-3k' })
    await expect(otp).toBeVisible({ timeout: 15_000 })
    await expect(otp.getByText('账号', { exact: true })).toBeVisible()
    await expect(otp.getByText('一次性口令', { exact: true })).toBeVisible()
    await expect(otp.getByRole('button', { name: '复制' }).first()).toBeVisible()
    await expect(otp.locator('.otp-box__row')).toHaveCount(2)
    await shot(page, 'e-v2-user-reset-otp-zh-dark-1440.png')
  })
})
