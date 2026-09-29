import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W9 会话回放全链路验证（G100）：
 * 登录（首访缓存回放配置）→ 刷新使配置生效（SDK 语义：远端配置下次启动生效）→ 浏览页面沉淀录制内容
 * → 等切块上传（5s 间隔）→ psql 反证 track_replay 行 → /#/track/replay 列表点播放
 * → rrweb-player 渲染（.rr-player）+ 事件数 > 0 → 测后清理（DB 行 + 本地存储文件）。
 * 前置：mugsun-boot(:8080) 已重启加载 G100 代码（含 T4 种子应用开回放）；vite dev(:3007) 在跑。
 */

/** 默认应用种子 app_key（与后端 track 库 T2/T4 迁移种子一致） */
const SEED_APP_KEY = 'ak_000000000000000000000001'
/** dev 本地存储根（application.yml x-file-storage local-plus storage-path） */
const DEV_STORAGE_ROOT = '/tmp/mugsun-files/'
/** 测试起点（epoch 毫秒）：psql 反证/清理的统一时间窗下界 */
let testStart = 0
/** 本会话 session_id（W9-1 反证时捕获，W9-2 列表定位用） */
let recordedSession = ''

function psqlTrack(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()
  page = await browser.newPage()
  await login(page)
  // 回放开关由 /track/config 下发且「下次启动生效」：登录后整页刷新一次，
  // SDK 重启读到首访缓存的 replayEnabled=true，录制自此开始（会话经 localStorage 延续）
  await page.reload()
  await expect(page).not.toHaveURL(/login/, { timeout: 10_000 })
})

test.afterAll(async () => {
  // 先关页：触发 pagehide → SDK beacon 发 gzip:false 收尾块，再删数据
  await page?.close()
  if (testStart <= 0) return
  // 等收尾块与事件尾批落库（beacon 传输 + 消费侧异步落储）
  await new Promise((r) => setTimeout(r, 5_000))

  const window = `app_key = '${SEED_APP_KEY}' AND start_time >= to_timestamp(${testStart} / 1000.0)`
  // 存储文件先删（删行前先取 storage_key 定位目录；dev 为本地 plus 存储）
  const keys = psqlTrack(`SELECT storage_key FROM track_replay WHERE ${window}`)
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)
  let filesRemoved = 0
  for (const key of keys) {
    const dir = path.join(DEV_STORAGE_ROOT, path.dirname(key))
    if (fs.existsSync(dir)) {
      filesRemoved += fs.readdirSync(dir).length
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  const replays = psqlTrack(`DELETE FROM track_replay WHERE ${window}`)
  // track_session 以窗口内事件的 session_id 集合定位（口径同 w8：create_time 与 received_at 时钟有偏移）
  const sessions = psqlTrack(
    `DELETE FROM track_session WHERE session_id IN (SELECT DISTINCT session_id FROM track_event` +
      ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
  )
  const events = psqlTrack(
    `DELETE FROM track_event WHERE received_at >= to_timestamp(${testStart} / 1000.0)`
  )
  console.log(
    `[w9-replay] 清理测试数据：track_replay ${replays}，track_event ${events}，` +
      `track_session ${sessions}，存储文件 ${filesRemoved} 个（${keys.length} 个会话目录）`
  )
})

test('W9-1 浏览页面沉淀录制：切块上传落库（psql 反证 track_replay 行）', async () => {
  test.setTimeout(90_000)
  // 浏览 4 个页面，每页停留 ~3s 让录制有内容（rrweb 增量事件流）
  for (const [path, marker] of [
    ['/#/system/user', '.el-table'],
    ['/#/system/role', '.el-table'],
    ['/#/track/overview', '.track-overview-page'],
    ['/#/track/event', '.track-event-page']
  ] as const) {
    await page.goto(path)
    await expect(page.locator(marker).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3_000)
  }

  // 切块间隔 5s：浏览期间已有块上传；异步落储轮询反证（会话窗口口径）
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_replay WHERE app_key = '${SEED_APP_KEY}'` +
              ` AND start_time >= to_timestamp(${testStart} / 1000.0)`
          )
        ) || 0,
      { timeout: 45_000, message: 'track_replay 应有本会话行（切块上传 + 异步落储）' }
    )
    .toBeGreaterThan(0)

  recordedSession = psqlTrack(
    `SELECT session_id FROM track_replay WHERE app_key = '${SEED_APP_KEY}'` +
      ` AND start_time >= to_timestamp(${testStart} / 1000.0) ORDER BY start_time DESC LIMIT 1`
  )
  expect(recordedSession, '应能取到本会话 session_id').not.toBe('')
  const events = Number(
    psqlTrack(`SELECT rrweb_events FROM track_replay WHERE session_id = '${recordedSession}'`)
  )
  expect(events, '回放事件数应 > 0（录制有内容）').toBeGreaterThan(0)
})

test('W9-2 回放列表页：本会话行可见', async () => {
  await page.goto('/#/track/replay')
  await expect(page.locator('.track-replay-page')).toBeVisible({ timeout: 15_000 })
  // 显式选中种子应用（应用下拉按 id 倒序，默认可能落在其他应用上）
  await page.locator('.track-app-select').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()
  // 列表应出现本窗口会话行（startTime 倒序，最新即本会话）
  const firstRow = page.locator('.track-replay-page .el-table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 15_000 })
  // 入口页列为登录后首个路由（工作台 /index/index 重定向前页面路径之一），仅断言行有实质内容
  await expect(firstRow.locator('td').nth(1)).not.toBeEmpty()
})

test('W9-3 点播放：rrweb-player 渲染且事件数 > 0（录放闭环截图）', async () => {
  test.setTimeout(90_000)
  const firstRow = page.locator('.track-replay-page .el-table tbody tr').first()
  await firstRow.locator('.track-replay-play').click()

  // 播放器抽屉：逐 seq 拉块（skipEnvelope 裸 JSON）→ 拼接 → rrweb-player 挂载
  const drawer = page.locator('.el-drawer', { hasText: '会话回放' })
  await expect(drawer).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.rr-player')).toBeVisible({ timeout: 30_000 })
  // 元数据头事件数 > 0（「事件 N 条」）
  await expect(page.locator('.replay-meta')).toContainText(/事件\s*[1-9]\d*\s*条/, {
    timeout: 15_000
  })
  // 播放器渲染帧沉淀后截图（录放闭环证据）
  await page.waitForTimeout(1_500)
  await page.screenshot({ path: '/tmp/replay-e2e.png', fullPage: true })
})
