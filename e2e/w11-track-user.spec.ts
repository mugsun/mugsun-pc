import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER, REDIS_CONTAINER } from './helpers/docker'

/**
 * W11 用户细查（行为时间线）+ 接口监控 + 响应体采集全链路验证（G102）：
 * 应用弹窗开「接口监控」+「响应体采集」（psql 反证开关落库）→ 两次刷新使 SDK 远端配置生效
 * （语义：启动用上次缓存配置、拉新配置下次启动生效；第一次刷新拉新入缓存，第二次刷新应用）
 * → 浏览 3 个页面产生真实 api_request（XHR，JSON 响应体经独立通道上传）→ psql 反证事件带 body_ref
 * + api-body 对象文件存在 → 用户细查页选中 admin → 时间线 $pageview/api_request 混排
 * → 展开 api_request 查看响应体（断言 R 信封特征）→ 会话回放入口可见
 * → 测后清理（track_event/session 行 + api-body 对象文件与幂等 Redis 键 + 应用开关复位 + 审计日志行）。
 * 前置：mugsun-boot(:8080) 已重启加载 G102 代码（V66/T7 迁移已执行）；vite dev(:3007) 在跑。
 */

/** 默认应用种子 app_key（与后端 track 库 T2 迁移种子一致） */
const SEED_APP_KEY = 'ak_000000000000000000000001'
/** SDK 远端配置 localStorage 缓存键（storagePrefix 默认 mst；启动时应用上次缓存，拉新下次生效） */
const CONFIG_CACHE_KEY = `mst:${SEED_APP_KEY}:config`
/** dev 本地存储根（application.yml x-file-storage local-plus storage-path） */
const DEV_STORAGE_ROOT = '/tmp/mugsun-files/'
/** 测试起点（epoch 毫秒）：psql 反证/清理的统一时间窗下界 */
let testStart = 0

function psqlTrack(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

function psqlBiz(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 窗口内带响应体的事件（清理对象文件/幂等键用）：每行 "event_id|yyyyMM" */
function bodyEventRows(): Array<{ eventId: string; month: string }> {
  const out = psqlTrack(
    `SELECT event_id || '|' || to_char(received_at, 'YYYYMM') FROM track_event` +
      ` WHERE received_at >= to_timestamp(${testStart} / 1000.0)` +
      ` AND props->>'body_ref' IS NOT NULL`
  )
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [eventId, month] = l.split('|')
      return { eventId, month }
    })
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  // 先关页：触发 pagehide → SDK beacon 冲刷尾批事件/收尾块，再删数据
  await page?.close()
  if (testStart <= 0) return
  // 等尾批落库（beacon 传输 + 消费侧异步落储）
  await new Promise((r) => setTimeout(r, 5_000))

  // api-body 对象文件 + 幂等 Redis 键（键 = api-body/{app}/{yyyyMM}/{event_id}.json.gz 纯推导）
  const rows = bodyEventRows()
  for (const { eventId, month } of rows) {
    fs.rmSync(
      path.join(DEV_STORAGE_ROOT, 'mugsun/api-body', SEED_APP_KEY, month, `${eventId}.json.gz`),
      {
        force: true
      }
    )
  }
  // 月目录/应用目录删空（非空说明有窗口外对象，保留）
  for (const month of [...new Set(rows.map((r) => r.month))]) {
    try {
      fs.rmdirSync(path.join(DEV_STORAGE_ROOT, 'mugsun/api-body', SEED_APP_KEY, month))
    } catch {
      /* 非空保留 */
    }
  }
  try {
    fs.rmdirSync(path.join(DEV_STORAGE_ROOT, 'mugsun/api-body', SEED_APP_KEY))
  } catch {
    /* 非空保留 */
  }
  if (rows.length > 0) {
    execSync(
      `docker exec ${REDIS_CONTAINER} redis-cli -n 3 DEL ${rows
        .map((r) => `mugsun:track:api-body:${r.eventId}`)
        .join(' ')}`,
      { encoding: 'utf-8' }
    )
  }

  // 应用三开关 + 保留期复位（默认全关）
  psqlTrack(
    `UPDATE track_app SET api_monitor_enabled = 0, api_body_enabled = 0, api_body_mask_enabled = 0,` +
      ` api_body_retention_days = 7 WHERE app_key = '${SEED_APP_KEY}'`
  )
  // 响应体查看审计日志行（业务库；create_time 为 timestamp，窗口比较去时区）
  psqlBiz(
    `DELETE FROM sys_oper_log WHERE request_uri = '/system/track/user/api-body'` +
      ` AND create_time >= to_timestamp(${testStart} / 1000.0)::timestamp`
  )
  // 事件/会话行（口径同 w8/w9/w10）
  const sessions = psqlTrack(
    `DELETE FROM track_session WHERE session_id IN (SELECT DISTINCT session_id FROM track_event` +
      ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
  )
  const events = psqlTrack(
    `DELETE FROM track_event WHERE received_at >= to_timestamp(${testStart} / 1000.0)`
  )
  console.log(
    `[w11-track-user] 清理测试数据：track_event ${events}，track_session ${sessions}，` +
      `api-body 对象 ${rows.length} 个，开关已复位，审计日志已清`
  )
})

test('W11-1 应用弹窗：开「接口监控」+「响应体采集」（开关联动出现脱敏/保留期），psql 反证落库', async () => {
  await page.goto('/#/track/app')
  await expect(page.locator('.track-app-page')).toBeVisible({ timeout: 15_000 })
  // keepAlive 下显式切回应用管理 tab（与 w10-4 同口径）
  await page.locator('.el-tabs__item', { hasText: '应用管理' }).click()
  const appRow = page.locator('.el-tab-pane:visible .el-table tbody tr', {
    hasText: 'mugsun-pc 自监控'
  })
  await appRow.locator('td:last-child div.rounded-md').first().click()
  const dialog = page.locator('.el-dialog', { hasText: '编辑应用' })
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  // 开「接口监控」→「响应体采集」联动出现 → 再开 →「响应体脱敏/保留期」联动出现
  await dialog.locator('.el-form-item', { hasText: '接口监控' }).locator('.el-switch').click()
  const bodyItem = dialog.locator('.el-form-item', { hasText: '响应体采集' })
  await expect(bodyItem).toBeVisible({ timeout: 5_000 })
  await bodyItem.locator('.el-switch').click()
  await expect(dialog.locator('.el-form-item', { hasText: '响应体脱敏' })).toBeVisible({
    timeout: 5_000
  })
  const retentionItem = dialog.locator('.el-form-item', { hasText: '响应体保留期' })
  await expect(retentionItem).toBeVisible({ timeout: 5_000 })
  await expect(retentionItem.locator('input')).toHaveValue('7')
  await page.screenshot({ path: '/tmp/g102-app-switches.png', fullPage: true })

  await dialog.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('.el-message', { hasText: '保存成功' })).toBeVisible({
    timeout: 10_000
  })
  // psql 反证配置落库（monitor:body:mask:retention）
  const cfg = psqlTrack(
    `SELECT api_monitor_enabled || ':' || api_body_enabled || ':' || api_body_mask_enabled || ':' ||` +
      ` api_body_retention_days FROM track_app WHERE app_key = '${SEED_APP_KEY}'`
  )
  expect(cfg, '接口监控/响应体采集配置应落库（1:1:0:7）').toBe('1:1:0:7')
})

test('W11-2 浏览页面沉淀接口事件：api_request 带 body_ref 落库 + api-body 对象文件存在', async () => {
  test.setTimeout(120_000)
  // SDK 远端配置「下次启动生效」：第一次刷新拉新配置入缓存（轮询 localStorage 落定），第二次刷新应用
  await page.reload()
  await expect(page).not.toHaveURL(/login/, { timeout: 10_000 })
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key) || '', CONFIG_CACHE_KEY), {
      timeout: 15_000,
      message: 'SDK 应拉取并缓存含接口监控开关的新配置'
    })
    .toContain('"apiMonitorEnabled":true')
  await page.reload()
  await expect(page).not.toHaveURL(/login/, { timeout: 10_000 })

  // 浏览 3 个页面（真实 XHR 列表接口，JSON 响应体经独立通道上传）
  for (const [path, marker] of [
    ['/#/system/user', '.el-table'],
    ['/#/system/role', '.el-table'],
    ['/#/track/overview', '.track-overview-page']
  ] as const) {
    await page.goto(path)
    await expect(page.locator(marker).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(2_500)
  }

  // 事件批量 5s 冲刷 + 异步落储：轮询反证带 body_ref 的 api_request 行
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_event WHERE event_name = 'api_request'` +
              ` AND received_at >= to_timestamp(${testStart} / 1000.0)` +
              ` AND props->>'body_ref' IS NOT NULL`
          )
        ) || 0,
      { timeout: 45_000, message: 'track_event 应有带 body_ref 的 api_request 行' }
    )
    .toBeGreaterThan(0)

  // api-body 对象文件真实落盘（键 = api-body/{app}/{yyyyMM}/{event_id}.json.gz）
  const rows = bodyEventRows()
  expect(rows.length, '应能取到带响应体的事件清单').toBeGreaterThan(0)
  const objectPath = path.join(
    DEV_STORAGE_ROOT,
    'mugsun/api-body',
    SEED_APP_KEY,
    rows[0].month,
    `${rows[0].eventId}.json.gz`
  )
  expect(fs.existsSync(objectPath), `api-body 对象文件应存在：${objectPath}`).toBe(true)
})

test('W11-3 用户细查页：选中 admin → 时间线 $pageview/api_request 混排 + 会话回放入口可见', async () => {
  test.setTimeout(90_000)
  await page.goto('/#/track/user')
  await expect(page.locator('.track-user-page')).toBeVisible({ timeout: 15_000 })
  // 显式选中种子应用（应用下拉默认可能落在其他应用上）
  await page.locator('.track-app-select').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()

  // 用户选择器远程搜索 admin（昵称 + @username 回显）
  await page.locator('.track-user-select').click()
  await page.locator('.track-user-select input').fill('admin')
  await page
    .getByRole('option', { name: /@admin/ })
    .first()
    .click()
  await page.getByRole('button', { name: '查询' }).click()

  // 时间线混排：页面浏览与接口事件同时出现（默认时间范围近 1 天覆盖测试窗口）
  await expect(page.locator('.track-event-pv').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.track-event-api').first()).toBeVisible({ timeout: 10_000 })
  // 会话头：开始时间/持续/页面数
  const sessionHead = page.locator('.track-session-head').first()
  await expect(sessionHead).toContainText('持续')
  await expect(sessionHead).toContainText('页面')

  // 回放块按 5s 切块上传：先 psql 等本窗口出现 has_replay=1 会话，再断言行内入口可见
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_session WHERE has_replay = 1 AND session_id IN` +
              ` (SELECT DISTINCT session_id FROM track_event` +
              ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
          )
        ) || 0,
      { timeout: 45_000, message: '本窗口应有 has_replay=1 的会话' }
    )
    .toBeGreaterThan(0)
  // 重查一次让时间线带上最新回放标记
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.locator('.track-session-replay').first()).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: '/tmp/g102-timeline.png', fullPage: true })
})

test('W11-4 展开 api_request：请求详情可见 + 「查看响应体」JSON 美化（R 信封特征）', async () => {
  test.setTimeout(60_000)
  // 逐行展开找一条带响应体的后端接口行（限定 /api/ 后端调用——图标库等第三方 JSON 也在时间线里，无 R 信封）；
  // 无 body 的行应显示「响应体未采集」占位
  const apiRows = page.locator('.track-event-api', { hasText: '/api/' })
  const rowCount = await apiRows.count()
  expect(rowCount, '时间线应有后端 api_request 行').toBeGreaterThan(0)
  let expanded = false
  for (let i = 0; i < Math.min(rowCount, 8); i++) {
    const row = apiRows.nth(i)
    await row.click()
    const detail = row.locator('.track-api-detail')
    await expect(detail).toBeVisible({ timeout: 5_000 })
    if ((await detail.locator('.track-api-body-btn').count()) > 0) {
      expanded = true
      break
    }
    // 未采集行：断言占位文案后收起，试下一行
    await expect(detail.locator('.track-body-hint').first()).toContainText('响应体未采集')
    await row.click()
  }
  expect(expanded, '应能找到带响应体的后端 api_request 行').toBe(true)

  // 展开详情：方法/状态/耗时/响应大小 + 完整 URL（含查询串）
  const detail = page.locator('.track-api-detail:visible')
  await expect(detail).toContainText('方法')
  await expect(detail).toContainText('耗时')
  await expect(detail).toContainText('响应大小')
  await expect(detail.locator('.track-api-url')).toContainText('/api/')

  // 查看响应体 → JSON 美化 pre（纯文本渲染），断言 R 信封特征
  await detail.locator('.track-api-body-btn').click()
  const pre = detail.locator('.track-api-body-pre')
  await expect(pre).toBeVisible({ timeout: 15_000 })
  const bodyText = await pre.innerText()
  expect(bodyText, '响应体应为 R 信封 JSON（含 code 字段）').toContain('"code"')
  await page.screenshot({ path: '/tmp/g102-api-body.png', fullPage: true })
})
