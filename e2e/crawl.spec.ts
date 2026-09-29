import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { collectAdminRoutes } from './helpers/routes'
import { PageProbe, assertProbeClean } from './helpers/probe'

/**
 * 全页面巡访 smoke：admin 登录后逐页真实访问，
 * 抓 白屏/未捕获异常/5xx/console.error——「别人打开每个页面都不能出问题」的底线网。
 * 路由清单自动解析自路由源码（含 modules/gis、track、ai），新增页面自动纳入。
 */
const routes = collectAdminRoutes()

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test(`巡访范围校验（≥40 页）`, async () => {
  expect(routes.length).toBeGreaterThanOrEqual(40)
})

for (const r of routes) {
  test(`巡访 ${r.path}（${r.name}）`, async () => {
    const probe = new PageProbe(page)
    probe.attach()
    try {
      await page.goto('/#' + r.path)
      // 等 SPA 真正渲染出内容（异步 chunk 加载有快慢，轮询而非固定等待）
      await expect
        .poll(async () => (await page.locator('#app').innerText()).trim().length, {
          timeout: 15_000,
          message: `${r.path} 页面白屏`
        })
        .toBeGreaterThan(0)
      // 给迟发的异步错误（接口 5xx、渲染异常）留出暴露时间
      await page.waitForTimeout(800)
    } finally {
      probe.detach()
    }
    assertProbeClean(r.path, probe.issue)
    if (probe.issue.clientErrors.length) {
      console.log(`[4xx 记录] ${r.path}: ${probe.issue.clientErrors.join(' | ')}`)
    }
  })
}
