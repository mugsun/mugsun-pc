import { execSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import type { Page, Request } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W8 埋点全链路验证（G99 收官）：
 * SDK 接入（$pageview 真实上报）→ 五个看板页渲染 → psql 落库反证 → 测试数据物理清理。
 * 前置：mugsun-boot(:8080) 与 vite dev(:3007) 已重启加载埋点代码；track 库 T2 种子应用已就位。
 */

/** 默认应用种子 app_key（与后端 track 库 T2 迁移种子一致） */
const SEED_APP_KEY = 'ak_000000000000000000000001'
/** 测试起点（epoch 毫秒）：psql 反证/清理的统一时间窗下界 */
let testStart = 0

function psqlTrack(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** collect 请求体文本（SDK 超 1KB 走 gzip 压缩上传，须先解压再断言） */
function postBodyText(req: Request): string {
  const buf = req.postDataBuffer()
  if (!buf || buf.length === 0) return ''
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      return gunzipSync(buf).toString('utf-8')
    } catch {
      return ''
    }
  }
  return buf.toString('utf-8')
}

test.describe.configure({ mode: 'serial' })

let page: Page
/** 看板页渲染期间收集的 console 错误（favicon 等静态资源噪声除外） */
const consoleErrors: string[] = []

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()
  page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))
  await login(page)
})

test.afterAll(async () => {
  // 先关页：触发 pagehide → SDK beacon 冲刷尾批事件，再删数据（先删后关会漏掉卸载时的尾批）
  await page?.close()
  // 测后清理：物理删除本会话窗口内的埋点数据（测试数据专用，不留痕）。
  if (testStart > 0) {
    // 等尾批落库（beacon 传输 + 消费侧批量写）
    await new Promise((r) => setTimeout(r, 4_000))
    // track_session 先删：以窗口内事件的 session_id 集合定位（其 create_time 为 JVM 本地墙钟，
    // 与 received_at 的 UTC 口径有偏移，不能直接按 testStart 过滤）
    const sessions = psqlTrack(
      `DELETE FROM track_session WHERE session_id IN (SELECT DISTINCT session_id FROM track_event` +
        ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
    )
    const events = psqlTrack(
      `DELETE FROM track_event WHERE received_at >= to_timestamp(${testStart} / 1000.0)`
    )
    console.log(`[w8-track] 清理测试数据：track_event ${events}，track_session ${sessions}`)
  }
})

test('W8-1 登录后浏览页面：/track/collect 真实上报 $pageview', async () => {
  // 武装响应等待（SDK 批量队列 5s 定时冲刷，浏览 3 页期间必有批次发出）
  const collectHit = page.waitForResponse(
    (r) =>
      r.url().includes('/track/collect') &&
      r.request().method() === 'POST' &&
      postBodyText(r.request()).includes('$pageview'),
    { timeout: 20_000 }
  )

  await page.goto('/#/system/user')
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 })
  await page.goto('/#/system/role')
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 })
  // 回工作台（根路径由守卫重定向到首页）
  await page.goto('/#/')
  await expect(page).not.toHaveURL(/#\/system\/role/, { timeout: 10_000 })

  const resp = await collectHit
  expect(resp.ok(), '/track/collect 响应须 2xx').toBe(true)
})

test('W8-2 埋点概览：PV 卡片 > 0 + 趋势图 canvas 渲染', async () => {
  await page.goto('/#/track/overview')
  const pvCard = page.locator('.track-stat-card', { hasText: '浏览量(PV)' })
  await expect(pvCard).toBeVisible({ timeout: 15_000 })
  // overview 卡片当日口径直算 track_event 明细，本会话 PV 落库后可见（含异步消费等待）
  await expect
    .poll(
      async () => {
        const text = await pvCard.locator('.track-stat-count').innerText()
        return Number(text.replace(/\D/g, '')) || 0
      },
      { timeout: 15_000, message: 'PV 卡片数值应 > 0' }
    )
    .toBeGreaterThan(0)
  // 访问趋势图（echarts canvas）
  await expect(page.locator('.track-chart-card canvas').first()).toBeVisible({ timeout: 15_000 })
})

test('W8-3 事件分析：实时事件流或事件表有行', async () => {
  await page.goto('/#/track/event')
  const realtimeRows = page.locator('.track-realtime-card .el-table tbody tr')
  const tableRows = page.locator('.track-event-page .art-table-card .el-table tbody tr')
  // 两表任一有行即过（不用 .or() 断言可见性：两者皆有行时 strict mode 冲突）
  await expect
    .poll(async () => (await realtimeRows.count()) + (await tableRows.count()), {
      timeout: 15_000,
      message: '实时事件流或事件表应有行'
    })
    .toBeGreaterThan(0)
})

test('W8-4 性能/错误/应用三页渲染无 console error', async () => {
  for (const [path, marker] of [
    ['/#/track/perf', '.track-perf-page'],
    ['/#/track/error', '.track-error-page'],
    ['/#/track/app', '.track-app-page']
  ] as const) {
    const before = consoleErrors.length
    await page.goto(path)
    await expect(page.locator(marker)).toBeVisible({ timeout: 15_000 })
    // 等首屏数据请求落定（应用下拉加载 + 首查）
    await page.waitForTimeout(1_500)
    const fresh = consoleErrors.slice(before)
    expect(fresh, `${path} 渲染期间不应有 console error`).toEqual([])
  }
})

test('W8-5 psql 反证：本会话 $pageview 已落库', async () => {
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_event WHERE app_key = '${SEED_APP_KEY}'` +
              ` AND event_name = '\\$pageview'` +
              ` AND received_at >= to_timestamp(${testStart} / 1000.0)`
          )
        ) || 0,
      { timeout: 15_000, message: 'track_event 应有本会话 $pageview 行' }
    )
    .toBeGreaterThanOrEqual(3)
})
