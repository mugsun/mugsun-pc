import type { Page, Route } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * 接入健康 tab + 用户细查 devicesTruncated 提示。
 * 健康/时间线接口用 page.route 桩数据固定各状态（空 / 加载失败 / 超时告警 / 从未收到 / 拒绝原因详情），
 * 登录走真实后端。前置同其它 track 用例：mugsun-boot(:8080) + vite dev(:3007)。
 */
const HOUR = 3_600_000

function ok(route: Route, data: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, success: true, data, msg: 'ok' })
  })
}

async function openHealth(page: Page): Promise<void> {
  await page.goto('/#/track/app')
  await page.getByRole('tab', { name: '接入健康' }).click()
}

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('空态：无应用', async ({ page }) => {
  await page.route('**/api/system/track/app/health/summary', (r) => ok(r, []))
  await openHealth(page)
  await expect(page.getByTestId('track-health-empty')).toBeVisible()
})

test('错误态 + 重试恢复', async ({ page }) => {
  let fail = true
  await page.route('**/api/system/track/app/health/summary', (r) =>
    fail ? r.fulfill({ status: 500, body: 'boom' }) : ok(r, [])
  )
  await openHealth(page)
  await expect(page.getByTestId('track-health-error')).toBeVisible()
  fail = false
  await page.getByTestId('track-health-error').getByRole('button').click()
  await expect(page.getByTestId('track-health-empty')).toBeVisible()
})

test('超时告警 / 从未收到 / 拒绝原因与修复建议', async ({ page }) => {
  const now = Date.now()
  await page.route('**/api/system/track/app/health/summary', (r) =>
    ok(r, [
      {
        appKey: 'ak_stale',
        appName: 'Stale',
        enabled: true,
        lastReceivedAt: now - 30 * HOUR,
        lastReceivedSource: 'redis',
        staleAfterMs: 24 * HOUR,
        fail7d: 3,
        warn7d: 1,
        topCodes: ['APP_DISABLED']
      },
      {
        appKey: 'ak_never',
        appName: 'Never',
        enabled: true,
        lastReceivedAt: null,
        lastReceivedSource: null,
        staleAfterMs: 24 * HOUR,
        fail7d: 0,
        warn7d: 0,
        topCodes: []
      },
      {
        appKey: 'ak_fresh',
        appName: 'Fresh',
        enabled: true,
        lastReceivedAt: now - 60_000,
        lastReceivedSource: 'redis',
        staleAfterMs: 24 * HOUR,
        fail7d: 0,
        warn7d: 0,
        topCodes: []
      }
    ])
  )
  await page.route('**/api/system/track/app/health?*', (r) =>
    ok(r, {
      appKey: 'ak_stale',
      reasons: [
        {
          code: 'APP_DISABLED',
          severity: 'fail',
          description: '应用已停用',
          suggestion: '在应用管理中启用',
          today: 2,
          last7d: 3,
          lastAt: now - HOUR,
          lastMessage: '应用已停用'
        },
        {
          code: 'CLOCK_SKEWED',
          severity: 'warn',
          description: '客户端时钟偏差',
          suggestion: '校准设备时间',
          today: 0,
          last7d: 1,
          lastAt: now - 2 * HOUR,
          lastMessage: null
        }
      ]
    })
  )
  await openHealth(page)
  const stale = page.locator('[data-app-key="ak_stale"]')
  await expect(stale.getByTestId('track-health-stale')).toBeVisible()
  await expect(
    page.locator('[data-app-key="ak_never"]').getByTestId('track-health-never')
  ).toBeVisible()
  const fresh = page.locator('[data-app-key="ak_fresh"]')
  await expect(fresh.getByTestId('track-health-stale')).toHaveCount(0)
  await expect(fresh.getByTestId('track-health-last')).toContainText('分钟')

  await stale.getByTestId('track-health-detail').click()
  const reasons = page.getByTestId('track-health-reason')
  await expect(reasons).toHaveCount(2)
  await expect(reasons.first()).toContainText('APP_DISABLED')
  await expect(reasons.first()).toContainText('在应用管理中启用')
})

test('用户细查：devicesTruncated 提示改用 distinctId', async ({ page }) => {
  await page.route('**/api/system/track/user/timeline?*', (r) =>
    ok(r, { records: [], nextCursor: null, deviceCount: 1000, devicesTruncated: true })
  )
  await page.goto('/#/track/user')
  // 访客模式（distinctId）无需选用户；应用默认取种子应用，时间范围有默认值
  await page.locator('.el-radio-button').nth(1).click()
  await page.locator('.track-user-select input').fill('00000000-0000-0000-0000-000000000001')
  await page.locator('.track-toolbar').getByRole('button').last().click()
  await expect(page.getByTestId('track-devices-truncated')).toContainText('1000')
})
