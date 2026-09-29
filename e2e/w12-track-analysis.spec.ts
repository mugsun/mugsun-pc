import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W12 漏斗分析 + 留存分析全链路验证（G103）：
 * 漏斗：页面内 fetch 真实摄入 3 个有序自定义事件（同 actor 同 session，分 3 批发送保 received_at 严格递增
 * ——漏斗 SQL 要求后步 received_at > 前步）→ psql 轮询落库 → /#/track/funnel 构建三步漏斗 → 查询
 * → 漏斗图 canvas + 明细表 1/1/1 + psql 反证。
 * 留存：建一个本 spec 独占的应用，psql 直灌历史事件构造双 actor cohort
 * （独占 app_key 才能保证 cohort 规模恒为 2；his_a D0/D+1/D+2 回访、his_b 仅 D0）
 * → /#/track/retention 查询 → 网格单元格精确值（100/50/50/未来格·）+ tooltip + psql 反证 → 测后清理。
 * 前置：mugsun-boot(:8080) 已重启加载 G103 代码（V67 迁移已执行）；vite dev(:3007) 在跑。
 */

/** 默认应用种子 app_key（与后端 track 库 T2 迁移种子一致） */
const SEED_APP_KEY = 'ak_000000000000000000000001'
/** 漏斗三步事件名（过 CUSTOM_EVENT_NAME 正则；摄入后自动注册事件定义进下拉） */
const FUNNEL_EVENTS = ['funnel_step_a', 'funnel_step_b', 'funnel_step_c'] as const
/** 测试起点（epoch 毫秒）：psql 反证/清理的统一时间窗下界 */
let testStart = 0
/** 本 spec 独占 actor/session 标识（带 testStart 后缀防跨次运行串数据） */
let funnelActor = ''
let funnelSession = ''
let hisA = ''
let hisB = ''
/** 留存 cohort 日（UTC，yyyy-MM-dd；固定取 todayUtc-2，覆盖 D+0/D+1/D+2 三格） */
let cohortDate = ''
/** 留存专用应用：cohort 规模必须只由本 spec 的两个 actor 决定，故独占一个 app_key */
let retentionAppKey = ''
let retentionAppName = ''
/** 选取 cohort 日时的 todayUtc（yyyy-MM-dd；W12-4 据此判定未来格边界） */
let todayUtc = ''

function psqlTrack(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page
/** 全程收集的 console 错误（favicon 等静态资源噪声除外） */
const consoleErrors: string[] = []

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()
  funnelActor = `e2e_funnel_actor_${testStart}`
  funnelSession = `e2e-funnel-${testStart}`
  hisA = `e2e_his_a_${testStart}`
  hisB = `e2e_his_b_${testStart}`
  // 留存专用应用（app_key 上限 32 字符）：种子应用天天有真实浏览器会话产生事件，
  // 别的 actor 一旦在 cohort 日首访，cohort 规模就不是 2，网格精确值无从断言
  retentionAppKey = `ak_e2e_ret_${String(testStart).slice(-13)}`
  retentionAppName = `E2E留存应用${String(testStart).slice(-6)}`
  psqlTrack(
    `INSERT INTO track_app (id, app_key, app_name, platform, tenant_id, sample_rate, enabled)` +
      ` VALUES (${testStart}, '${retentionAppKey}', '${retentionAppName}', 'web', '000000', 100, 1)`
  )
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
  if (testStart <= 0) return
  // 等尾批落库（beacon 传输 + 消费侧批量写）
  await new Promise((r) => setTimeout(r, 4_000))

  // track_session 先删：以窗口内事件的 session_id 集合定位（口径同 w8/w9）
  const sessions = psqlTrack(
    `DELETE FROM track_session WHERE session_id IN (SELECT DISTINCT session_id FROM track_event` +
      ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
  )
  const events = psqlTrack(
    `DELETE FROM track_event WHERE received_at >= to_timestamp(${testStart} / 1000.0)`
  )
  // 留存直灌历史事件（received_at 在窗口外，按 actor 精确删）
  const his = psqlTrack(`DELETE FROM track_event WHERE distinct_id IN ('${hisA}', '${hisB}')`)
  // 摄入自动注册的漏斗事件定义（G105 前无此行，测试数据专用不留痕）
  const defs = psqlTrack(
    `DELETE FROM track_event_def WHERE app_key = '${SEED_APP_KEY}'` +
      ` AND event_name IN ('${FUNNEL_EVENTS.join("', '")}')`
  )
  // 留存专用应用连带其事件一起清（应用留着会挤进应用下拉，干扰其他埋点用例的选择器）
  if (retentionAppKey) {
    psqlTrack(`DELETE FROM track_event WHERE app_key = '${retentionAppKey}'`)
    psqlTrack(`DELETE FROM track_app WHERE app_key = '${retentionAppKey}'`)
  }
  console.log(
    `[w12-track-analysis] 清理测试数据：track_event ${events}，track_session ${sessions}，` +
      `历史直灌 ${his}，事件定义 ${defs}，留存应用 ${retentionAppKey}`
  )
})

test('W12-1 漏斗数据摄入：页面内 fetch POST /track/collect 三步有序事件落库', async () => {
  test.setTimeout(60_000)
  // 三步分 3 批发送（间隔 1.2s）：漏斗 SQL 要求后步 received_at 严格大于前步，同批到达会被同刻排除
  const statuses = await page.evaluate(
    async ({ appKey, actor, session, names }) => {
      const out: number[] = []
      const base = Date.now()
      for (let i = 0; i < names.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 1200))
        const resp = await fetch('/api/track/collect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            app_key: appKey,
            schema_version: '1.0',
            sdk: { platform: 'web', version: 'e2e' },
            sent_at: Date.now(),
            events: [
              {
                event_id: crypto.randomUUID(),
                event: names[i],
                ts: base + i * 1000,
                distinct_id: actor,
                user_id: null,
                session_id: session,
                props: { url_path: '/e2e/funnel' }
              }
            ]
          })
        })
        out.push(resp.status)
      }
      return out
    },
    { appKey: SEED_APP_KEY, actor: funnelActor, session: funnelSession, names: [...FUNNEL_EVENTS] }
  )
  expect(statuses, 'collect 三批响应须全部 2xx').toEqual([200, 200, 200])

  // 消费侧批量落库：轮询反证 3 条（事件定义与事件同批 upsert，落库即进漏斗下拉）
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_event WHERE distinct_id = '${funnelActor}'` +
              ` AND event_name IN ('${FUNNEL_EVENTS.join("', '")}')`
          )
        ) || 0,
      { timeout: 20_000, message: 'track_event 应有本 actor 漏斗三步事件' }
    )
    .toBe(3)
})

test('W12-2 漏斗页：构建三步漏斗查询 → canvas 渲染 + 明细 1/1/1 + psql 反证', async () => {
  test.setTimeout(60_000)
  await page.goto('/#/track/funnel')
  await expect(page.locator('.track-funnel-page')).toBeVisible({ timeout: 15_000 })
  // 显式选中种子应用（应用下拉按 id 倒序，默认可能落在其他应用上；选中同项也无碍）
  await page.locator('.track-app-select').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()

  // 默认 2 步，补到 3 步
  await page.locator('.track-funnel-add').click()
  await expect(page.locator('.track-funnel-step-select')).toHaveCount(3)
  for (let i = 0; i < FUNNEL_EVENTS.length; i++) {
    const select = page.locator('.track-funnel-step-select').nth(i)
    await select.click()
    await select.locator('input').fill(FUNNEL_EVENTS[i])
    // 选项列表随事件定义加载响应式刷新：等目标选项出现即完成加载，无需等待特定响应
    const option = page.getByRole('option', { name: FUNNEL_EVENTS[i], exact: true })
    await expect(option).toBeVisible({ timeout: 15_000 })
    await option.click()
  }

  await page.getByRole('button', { name: '查询' }).click()

  // 漏斗图（echarts canvas）渲染
  await expect(page.locator('.track-funnel-chart canvas')).toBeVisible({ timeout: 15_000 })
  // 明细表三步：事件名序 + 人数 1/1/1（单 actor 有序触达）
  const rows = page.locator('.track-funnel-table-card .el-table tbody tr')
  await expect(rows).toHaveCount(3, { timeout: 15_000 })
  for (let i = 0; i < FUNNEL_EVENTS.length; i++) {
    await expect(rows.nth(i).locator('td').nth(1)).toHaveText(FUNNEL_EVENTS[i])
    await expect(rows.nth(i).locator('td').nth(2)).toHaveText('1')
  }

  // psql 反证：窗口内三步事件各 1 条且同属 1 个 actor（与漏斗 API 计数 1/1/1 一致）
  for (const name of FUNNEL_EVENTS) {
    const pair = psqlTrack(
      `SELECT count(*) || ':' || count(DISTINCT distinct_id) FROM track_event` +
        ` WHERE app_key = '${SEED_APP_KEY}' AND event_name = '${name}'` +
        ` AND received_at >= to_timestamp(${testStart} / 1000.0)`
    )
    expect(pair, `${name} 窗口内应 1 条事件 / 1 个 actor`).toBe('1:1')
  }
})

test('W12-3 留存数据直灌：零事件日双 actor cohort（his_a D0/D+1/D+2，his_b 仅 D0）', async () => {
  // cohort 日固定取 todayUtc-2：D+0/D+1/D+2 三格都已过去，D+3 为未来格。
  // 隔离靠独占 app_key 而非"找零事件日"——活跃 dev 库里每天都有真实会话事件，零事件日根本不存在
  todayUtc = psqlTrack(`SELECT to_char((now() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`)
  cohortDate = psqlTrack(`SELECT to_char((now() AT TIME ZONE 'UTC')::date - 2, 'YYYY-MM-DD')`)
  console.log(
    `[w12-track-analysis] 留存 cohort 日 = ${cohortDate}（todayUtc = ${todayUtc}，应用 ${retentionAppKey}）`
  )

  // 直灌历史事件：received_at 决定 UTC 日切与分区归属（锚定当日 10:00 UTC）。
  // his_a 的 D+2 锚定 cohort+2 而非恒 now()：cohort 日回退超过 2 天时 now() 会错落到 D+3 列，D+2 格真实为 0；
  // 又 retention SQL 有 received_at <= now 上界，cohort+2 = 今日时 10:00 可能在未来被排除——故取 LEAST(d(2), now()) 两态兼容
  const d = (offsetDays: number) =>
    `(('${cohortDate}'::date + interval '${offsetDays} days' + interval '10 hours')::timestamp AT TIME ZONE 'UTC')`
  const row = (actor: string, session: string, tsExpr: string) =>
    `((random()*9007199254740991)::bigint, gen_random_uuid()::text, '${retentionAppKey}',` +
    ` '\\$pageview', ${tsExpr}, ${tsExpr}, ${tsExpr}, 0, '${actor}', NULL, '${session}',` +
    ` '000000', '/e2e/retention', '{}'::jsonb, now())`
  psqlTrack(
    `INSERT INTO track_event (id, event_id, app_key, event_name, client_ts, ts, received_at,` +
      ` clock_skewed, distinct_id, user_id, session_id, tenant_id, url_path, props, create_time) VALUES ` +
      [
        row(hisA, `e2e-his-a-0-${testStart}`, d(0)),
        row(hisA, `e2e-his-a-1-${testStart}`, d(1)),
        row(hisA, `e2e-his-a-2-${testStart}`, `LEAST(${d(2)}, now())`),
        row(hisB, `e2e-his-b-0-${testStart}`, d(0))
      ].join(', ')
  )

  // 直灌核验：4 行落库；cohort 日除本 actor 外零事件（cohortSize=2 的前提不变量）
  const inserted = Number(
    psqlTrack(`SELECT count(*) FROM track_event WHERE distinct_id IN ('${hisA}', '${hisB}')`)
  )
  expect(inserted, '直灌历史事件应 4 行落库').toBe(4)
  const foreign = Number(
    psqlTrack(
      `SELECT count(*) FROM track_event WHERE app_key = '${retentionAppKey}'` +
        ` AND distinct_id NOT IN ('${hisA}', '${hisB}')`
    )
  )
  expect(foreign, '留存专用应用内不应有其他 actor 事件（否则 cohort 规模被污染）').toBe(0)
})

test('W12-4 留存页：cohort 网格精确值（100/50/50/未来格）+ tooltip + psql 反证', async () => {
  test.setTimeout(60_000)
  await page.goto('/#/track/retention')
  await expect(page.locator('.track-retention-page')).toBeVisible({ timeout: 15_000 })
  // 显式选中留存专用应用（默认天数 7，覆盖 cohort 窗）
  await page.locator('.track-app-select').click()
  await page.getByRole('option', { name: retentionAppName }).click()
  await page.getByRole('button', { name: '查询' }).click()

  // cohort 行：日期 + 规模 新客 2 人
  const row = page.locator('.track-retention-grid tbody tr', { hasText: cohortDate })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row.locator('.track-retention-cohort-size')).toHaveText('新客 2 人')
  // 单元格：D+0=100.0%（2/2）、D+1=50.0%（his_a）、D+2=50.0%（his_a）；
  // D+3 格随 cohort 日回退深度而定——cohort=todayUtc-2 时为未来格占位「·」，回退更深时该格已过去/今日（无回访 0.0%）
  const cells = row.locator('td.track-retention-cell')
  await expect(cells.nth(0)).toHaveText('100.0%')
  await expect(cells.nth(1)).toHaveText('50.0%')
  await expect(cells.nth(2)).toHaveText('50.0%')
  const dayDiff = Math.round(
    (Date.parse(`${todayUtc}T00:00:00Z`) - Date.parse(`${cohortDate}T00:00:00Z`)) / 86_400_000
  )
  await expect(cells.nth(3)).toHaveText(dayDiff >= 3 ? '0.0%' : '·')

  // tooltip：hover D+1 单元格 → 「D+1 留存 1/2 = 50.0%」（EP 2.x popper role=tooltip）
  await cells.nth(1).locator('.track-retention-cell-text').hover()
  await expect(page.locator('[role="tooltip"]', { hasText: 'D+1 留存 1/2 = 50.0%' })).toBeVisible({
    timeout: 10_000
  })

  // psql 反证：his_a 活跃 3 个 UTC 日（D0/D+1/D+2 → 留存 50/50），his_b 仅 1 日（D+1 起流失）
  const daysA = psqlTrack(
    `SELECT count(DISTINCT (received_at AT TIME ZONE 'UTC')::date) FROM track_event` +
      ` WHERE distinct_id = '${hisA}'`
  )
  const daysB = psqlTrack(
    `SELECT count(DISTINCT (received_at AT TIME ZONE 'UTC')::date) FROM track_event` +
      ` WHERE distinct_id = '${hisB}'`
  )
  expect(daysA, 'his_a 应活跃 3 个 UTC 日（与网格 100/50/50 一致）').toBe('3')
  expect(daysB, 'his_b 应仅活跃 1 个 UTC 日（与 D+1 起 0 回访一致）').toBe('1')
})

test('W12-5 全程无 console error', async () => {
  expect(consoleErrors, 'W12 全程不应有 console error').toEqual([])
})
