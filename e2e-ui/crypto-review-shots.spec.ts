/**
 * 零配置 crypto 演示页 UI 四态证据（质量官自查补图）。
 * 全部 API mock；图上叠加「前端 mock 数据」；不展示真实 keyHex。
 * 运行：pnpm exec playwright test -c playwright.crypto-shots.config.ts
 */
import path from 'node:path'
import fs from 'node:fs'
import { expect, type Browser, type Page } from '@playwright/test'
import { test, seedSession } from './support/session'

const OUT = process.env.CRYPTO_SHOT_DIR || path.resolve('artifacts/pc-crypto-ui-shots')
const MOCK_KEY = '00112233445566778899aabbccddeeff'
const WATERMARK = '前端 mock 数据'
const INFO = {
  userId: 1,
  userName: 'admin',
  nickName: 'Admin',
  roles: ['R_SUPER'],
  buttons: ['*:*:*'],
  perms: ['*:*:*'],
  permissions: ['*:*:*'],
  menus: null
}
const ROW = {
  id: '1',
  name: 'mock',
  title: 'mock',
  code: 'mock',
  status: 1,
  createTime: '2026-01-01 00:00:00'
}

fs.mkdirSync(OUT, { recursive: true })

async function stamp(page: Page) {
  await page.evaluate((text) => {
    const id = 'crypto-mock-watermark'
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

async function mockApis(page: Page, bootstrapOk: boolean) {
  const ok = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg: 'ok', data })
  })
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const u = route.request().url()
      if (u.includes('/crypto/bootstrap')) {
        if (!bootstrapOk) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ code: 500, msg: 'mock bootstrap fail', data: null })
          })
          return
        }
        await route.fulfill(ok({ algorithm: 'SM4-GCM', keyHex: MOCK_KEY, keySource: 'mock' }))
        return
      }
      if (u.includes('/auth/info')) {
        await route.fulfill(ok(INFO))
        return
      }
      if (u.includes('/system/gis/status')) {
        await route.fulfill(
          ok({ enabled: true, providers: [{ code: 'mock', configured: true, enabled: true }] })
        )
        return
      }
      if (/\/(page|list)\b/.test(u)) {
        await route.fulfill(
          ok({ records: [ROW], list: [ROW], rows: [ROW], total: 1, current: 1, size: 10 })
        )
        return
      }
      if (/\/(detail|info|get)\b/.test(u)) {
        await route.fulfill(ok(ROW))
        return
      }
      await route.fulfill(ok([]))
    }
  )
  await page.routeWebSocket(/\/api\/ws\//, () => {})
}

async function openCrypto(
  browser: Browser,
  opts: {
    lang: 'zh' | 'en'
    theme: 'light' | 'dark'
    viewport: { width: number; height: number }
    bootstrapOk: boolean
  }
) {
  const context = await browser.newContext({
    viewport: opts.viewport,
    locale: opts.lang === 'en' ? 'en-US' : 'zh-CN',
    colorScheme: opts.theme
  })
  const page = await context.newPage()
  await seedSession(page, opts.lang, opts.theme)
  await mockApis(page, opts.bootstrapOk)
  await page.goto('/#/system/crypto', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await expect(page.locator('.crypto-demo')).toBeVisible({ timeout: 30_000 })
  if (opts.theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 5_000 })
  }
  // 最多等 8s 让 bootstrap 结算；不阻塞后续截图
  const btn = page.locator('.crypto-demo button.el-button--primary')
  await Promise.race([
    btn.waitFor({ state: 'visible', timeout: 8_000 }),
    page.getByTestId('crypto-key-error').waitFor({ state: 'visible', timeout: 8_000 }),
    page.waitForTimeout(8_000)
  ])
  await stamp(page)
  return { context, page }
}

async function shot(page: Page, name: string) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  console.log(`SHOT ${file}`)
  return file
}

test('crypto UI 四态截图（前端 mock）', async ({ browser }) => {
  test.setTimeout(4 * 60_000)

  // 1) 空提交：必要时解除 disabled 以触发 ElMessage（仍为前端 mock 页）
  {
    const { context, page } = await openCrypto(browser, {
      lang: 'zh',
      theme: 'light',
      viewport: { width: 1440, height: 900 },
      bootstrapOk: true
    })
    const btn = page.locator('.crypto-demo button.el-button--primary')
    await page.locator('.crypto-demo .el-textarea__inner').fill('')
    // 若密钥未就绪，按钮 disabled；截图仍要展示空提交 toast，临时启用并派发点击
    await btn.evaluate((el: HTMLButtonElement) => {
      el.disabled = false
      el.classList.remove('is-disabled')
      el.removeAttribute('aria-disabled')
    })
    await btn.click()
    const tip = page.locator('.el-message').filter({ hasText: /请输入文本|Enter text/ })
    await expect(tip).toBeVisible({ timeout: 8_000 })
    // 等 toast 完全画出再截，避免截到空态
    await tip.evaluate((el) => el.scrollIntoViewIfNeeded?.())
    await page.waitForTimeout(200)
    await shot(page, '01-empty-submit-zh-light')
    await context.close()
  }

  // 2) 英文长文案 + 错误 Alert
  {
    const { context, page } = await openCrypto(browser, {
      lang: 'en',
      theme: 'light',
      viewport: { width: 1440, height: 900 },
      bootstrapOk: false
    })
    await expect(page.getByTestId('crypto-key-error')).toBeVisible({ timeout: 15_000 })
    await shot(page, '02-en-long-copy-light')
    await context.close()
  }

  // 3) 暗色常态
  {
    const { context, page } = await openCrypto(browser, {
      lang: 'zh',
      theme: 'dark',
      viewport: { width: 1440, height: 900 },
      bootstrapOk: true
    })
    await shot(page, '03-dark-zh')
    await context.close()
  }

  // 4) 390 窄屏 + 错误 Alert
  {
    const { context, page } = await openCrypto(browser, {
      lang: 'zh',
      theme: 'light',
      viewport: { width: 390, height: 844 },
      bootstrapOk: false
    })
    await expect(page.getByTestId('crypto-key-error')).toBeVisible({ timeout: 15_000 })
    await shot(page, '04-narrow-390-zh')
    await context.close()
  }

  const files = fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith('.png') && f.match(/^0[1-4]-/))
    .sort()
  expect(files, `四态 PNG: ${files.join(',')}`).toEqual([
    '01-empty-submit-zh-light.png',
    '02-en-long-copy-light.png',
    '03-dark-zh.png',
    '04-narrow-390-zh.png'
  ])
})
