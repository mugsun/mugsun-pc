import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, readAccessToken } from './fixtures/auth'
import { PG_CONTAINER, REDIS_CONTAINER } from './helpers/docker'

/**
 * W13 圈选式可视化埋点（G104）+ 回放会话事件打点（G105c）全链路验证：
 * 圈选闭环（主链全 UI）：接入管理「圈选规则」tab → 进入圈选（令牌签发 + window.open inspect 页）
 * → inspect 页顶部提示条 → 点稳定元素（侧边栏菜单项）→ 底部面板填事件名提交草稿
 * → 管理端 3s 轮询出草稿行 → UI 确认成规则 → 规则表出现 → 新开页面两次启动使 config 生效
 * → 点击同一元素（按规则表 selector 定位）→ psql 反证 e2e_visual_click 带 vs_selector 落库
 * → 管理页删除规则。
 * 回放打点：独立 context 浏览 3 路由沉淀会话事件与回放块（独立会话关页静默后墙钟窗冻结，
 * 打点计数可与 API/psql 精确比对——共享 localStorage 会话会随管理页活动持续前移存在竞态）
 * → psql 定位会话 → /#/track/replay 播放 → .rr-player + .track-replay-event-track 圆点 ≥2
 * → 点击圆点 seek 无 console error → /track/replay/events API 与 psql 反证一致。
 * 前置：mugsun-boot(:8080) 已重启加载 G104/G105 代码（V67/V68/T8 迁移已执行）；vite dev(:3007) 在跑。
 */

/** 默认应用种子 app_key（与后端 track 库 T2/T4 迁移种子一致） */
const SEED_APP_KEY = 'ak_000000000000000000000001'
/** 圈选事件名（过 CUSTOM_EVENT_NAME 正则） */
const VISUAL_EVENT = 'e2e_visual_click'
/** SDK 远端配置 localStorage 缓存键（storagePrefix 默认 mst；启动时应用上次缓存，拉新下次生效） */
const CONFIG_CACHE_KEY = `mst:${SEED_APP_KEY}:config`
/** dev 本地存储根（application.yml x-file-storage local-plus storage-path） */
const DEV_STORAGE_ROOT = '/tmp/mugsun-files/'
/** 测试起点（epoch 毫秒）：psql 反证/清理的统一时间窗下界 */
let testStart = 0
/** 圈选令牌（inspect 页 URL 捕获；afterAll 清 Redis 令牌/草稿键用） */
let visualToken = ''

function psqlTrack(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page
/** 显式持有的浏览器上下文（browser.newPage() 的隐式上下文禁止再开页，normalPage 复用其登录态） */
let ctx: import('@playwright/test').BrowserContext
/** 本 spec 开过的全部页面（afterAll 统一关闭冲刷尾批） */
const openedPages: Page[] = []
/** 全程收集的 console 错误（favicon 等静态资源噪声除外） */
const consoleErrors: string[] = []

/** 已知良性 console 噪音：favicon 静态资源；rrweb-player 沙箱 iframe 拦截被录页面脚本
 *  （回放安全语义设计使然——被录页面的 <script> 本就不允许在回放沙箱内执行，非平台缺陷）；
 *  「请求已取消」（工作台等页在导航/关页时主动取消在途 axios 请求，PromiseError 噪声，设计行为） */
const CONSOLE_NOISE =
  /favicon|Blocked script execution in .* the document's frame is sandboxed|请求已取消/

/** 页面纳入管理：console 错误收集 + afterAll 关闭清单 */
function watchPage(p: Page): Page {
  p.on('console', (msg) => {
    if (msg.type() === 'error' && !CONSOLE_NOISE.test(msg.text())) {
      consoleErrors.push(msg.text())
    }
  })
  p.on('pageerror', (err) => {
    if (!CONSOLE_NOISE.test(String(err))) consoleErrors.push(String(err))
  })
  openedPages.push(p)
  return p
}

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()
  ctx = await browser.newContext()
  page = watchPage(await ctx.newPage())
  await login(page)
})

test.afterAll(async () => {
  // 先关全部页：触发 pagehide → SDK beacon 冲刷尾批事件/收尾块，再删数据
  for (const p of openedPages.splice(0)) {
    try {
      await p.close()
    } catch {
      /* 已关闭无妨 */
    }
  }
  if (testStart <= 0) return
  // 等收尾块与事件尾批落库（beacon 传输 + 消费侧异步落储）
  await new Promise((r) => setTimeout(r, 5_000))

  // 回放存储文件先删（删行前先取 storage_key 定位目录；dev 为本地 plus 存储）
  const window = `app_key = '${SEED_APP_KEY}' AND start_time >= to_timestamp(${testStart} / 1000.0)`
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
  // 圈选规则行 + 确认时同步的事件定义行（物理删；UI 删除为逻辑删，这里兜底清干净）
  const rules = psqlTrack(`DELETE FROM track_visual_rule WHERE event_name = '${VISUAL_EVENT}'`)
  const defs = psqlTrack(
    `DELETE FROM track_event_def WHERE app_key = '${SEED_APP_KEY}' AND event_name = '${VISUAL_EVENT}'`
  )
  // 圈选令牌/草稿 Redis 键（TTL 30min 自然过期，测试数据专用主动清）
  if (visualToken) {
    execSync(
      `docker exec ${REDIS_CONTAINER} redis-cli -n 3 DEL` +
        ` mugsun:track:visual-token:${visualToken} mugsun:track:visual-draft:${visualToken}`,
      { encoding: 'utf-8' }
    )
  }
  // 事件/会话行（口径同 w8/w9：session 以窗口内事件的 session_id 集合定位）
  const sessions = psqlTrack(
    `DELETE FROM track_session WHERE session_id IN (SELECT DISTINCT session_id FROM track_event` +
      ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
  )
  const events = psqlTrack(
    `DELETE FROM track_event WHERE received_at >= to_timestamp(${testStart} / 1000.0)`
  )
  console.log(
    `[w13-track-visual] 清理测试数据：track_event ${events}，track_session ${sessions}，` +
      `track_replay ${replays}，规则 ${rules}，事件定义 ${defs}，存储文件 ${filesRemoved} 个` +
      `（${keys.length} 个会话目录），令牌${visualToken ? '已清' : '未签发'}`
  )
})

test('W13-1 圈选闭环：令牌签发 → inspect 圈选 → 草稿确认成规则 → 规则生效点击上报 → 删除规则', async () => {
  test.setTimeout(150_000)
  // ===== 接入管理「圈选规则」tab：选中种子应用 =====
  await page.goto('/#/track/app')
  await expect(page.locator('.track-app-page')).toBeVisible({ timeout: 15_000 })
  await page.locator('.el-tabs__item', { hasText: '圈选规则' }).click()
  const visualPane = page.locator('.el-tab-pane:visible')
  await visualPane.locator('.track-app-select').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()

  // ===== 进入圈选：prompt 目标 URL（默认平台 origin）→ 令牌签发 + window.open inspect 页 =====
  await visualPane.getByRole('button', { name: /进入圈选/ }).click()
  const promptBox = page.locator('.el-message-box')
  await expect(promptBox).toBeVisible({ timeout: 5_000 })
  const inspectPagePromise = page.context().waitForEvent('page')
  await promptBox.getByRole('button', { name: '进入' }).click()
  const inspectPage = watchPage(await inspectPagePromise)

  // ===== inspect 页：顶部圈选提示条（__mst_inspect 激活，不依赖远端配置）。
  // 根容器 [data-mst-inspect-ui] 无尺寸（子元素全 fixed 定位）判 hidden，断言须落在具体子元素上
  const inspectUi = inspectPage.locator('[data-mst-inspect-ui]')
  await expect(inspectUi.getByText(/圈选模式：点击元素完成圈选/)).toBeVisible({ timeout: 20_000 })
  // 捕获令牌（afterAll 清 Redis 键用）
  visualToken = new URL(inspectPage.url()).searchParams.get('__mst_inspect') ?? ''
  expect(visualToken, 'inspect 页 URL 应带 __mst_inspect 令牌').not.toBe('')

  // ===== 点击稳定元素（侧边栏「工作台」菜单项，唯一且全路由常驻）→ 底部面板填事件名 → 提交草稿 =====
  const menuItem = inspectPage.getByRole('menuitem', { name: '工作台' })
  await expect(menuItem).toBeVisible({ timeout: 15_000 })
  await menuItem.click()
  const nameInput = inspectUi.locator('input')
  await expect(nameInput).toBeVisible({ timeout: 5_000 })
  await nameInput.fill(VISUAL_EVENT)
  await inspectUi.getByRole('button', { name: '提交' }).click()
  // toast 仅显示 2.4s：按可见性轮询捕获（hidden 时 innerText 为空，toContainText 不适用）
  await expect(inspectUi.getByText('已提交圈选草稿')).toBeVisible({ timeout: 10_000 })
  // 草稿已交，关闭 inspect 页（令牌不退出，管理端轮询继续；减少后续事件流）
  await inspectPage.close()

  // ===== 管理端：3s 轮询出草稿行 → UI 确认成规则 =====
  const draftRow = page.locator('.track-visual-draft', { hasText: VISUAL_EVENT })
  await expect(draftRow).toBeVisible({ timeout: 20_000 })
  await draftRow.getByRole('button', { name: '确认' }).click()
  const confirmBox = page.locator('.el-message-box')
  await expect(confirmBox).toBeVisible({ timeout: 5_000 })
  await confirmBox.getByRole('button', { name: '确认' }).click()
  await expect(page.locator('.el-message', { hasText: '已确认为圈选规则' })).toBeVisible({
    timeout: 10_000
  })
  // 规则表出现 e2e_visual_click 行（确认后刷新）
  const ruleRow = visualPane.locator('.el-table tbody tr', { hasText: VISUAL_EVENT })
  await expect(ruleRow).toBeVisible({ timeout: 10_000 })

  // 规则 selector（psql 取回，常态点击按同一定位——等价于 inspect 时所选元素）
  const ruleSelector = psqlTrack(
    `SELECT selector FROM track_visual_rule WHERE event_name = '${VISUAL_EVENT}'` +
      ` AND is_deleted = 0 ORDER BY id DESC LIMIT 1`
  )
  expect(ruleSelector, '规则行应有 selector').not.toBe('')

  // ===== 规则生效：新开页面两次启动（首启拉新 config 入缓存，重启应用）→ 点击同元素上报 =====
  const normalPage = watchPage(await ctx.newPage())
  await normalPage.goto('/#/')
  await expect(normalPage.getByRole('menuitem', { name: '工作台' })).toBeVisible({
    timeout: 15_000
  })
  // 首启拉取含圈选规则的新配置入缓存（confirm 已 evict 服务端缓存，即时下发）
  await expect
    .poll(() => normalPage.evaluate((key) => localStorage.getItem(key) || '', CONFIG_CACHE_KEY), {
      timeout: 15_000,
      message: 'SDK 应拉取并缓存含圈选规则的新配置'
    })
    .toContain(VISUAL_EVENT)
  // 重启应用新配置（visual-track 常态监听安装）
  await normalPage.reload()
  await expect(normalPage.getByRole('menuitem', { name: '工作台' })).toBeVisible({
    timeout: 15_000
  })
  await normalPage.locator(ruleSelector).first().click()

  // psql 反证：e2e_visual_click 落库且 props 带 vs_selector（批量 5s 冲刷 + 异步落储）
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_event WHERE event_name = '${VISUAL_EVENT}'` +
              ` AND received_at >= to_timestamp(${testStart} / 1000.0)` +
              ` AND props->>'vs_selector' IS NOT NULL`
          )
        ) || 0,
      { timeout: 30_000, message: 'track_event 应有带 vs_selector 的圈选命中事件' }
    )
    .toBeGreaterThan(0)
  await normalPage.close()

  // ===== 管理页删除规则（清理主链） =====
  await ruleRow.locator('td:last-child div.rounded-md').nth(1).click()
  const deleteBox = page.locator('.el-message-box')
  await expect(deleteBox).toBeVisible({ timeout: 5_000 })
  await deleteBox.getByRole('button', { name: '删除' }).click()
  await expect(page.locator('.el-message', { hasText: '已删除' })).toBeVisible({ timeout: 10_000 })
})

test('W13-2 回放打点：会话事件时间轴圆点渲染 + 点击 seek + API/psql 反证一致', async ({
  browser
}) => {
  test.setTimeout(150_000)
  // ===== 独立 context 浏览 3 个路由：会话与管理页物理隔离（共享 localStorage 会话会让
  // 会话墙钟窗随管理页活动持续前移，打点计数比对存在竞态；独立会话关页静默后窗口冻结） =====
  const ctx2 = await browser.newContext()
  const browsePage = watchPage(await ctx2.newPage())
  await login(browsePage)
  // 回放开关由 /track/config 下发且「下次启动生效」：刷新一次让 SDK 读到首访缓存的 replayEnabled（同 w9）
  await browsePage.reload()
  await expect(browsePage).not.toHaveURL(/login/, { timeout: 10_000 })
  for (const [path, marker] of [
    ['/#/system/user', '.el-table'],
    ['/#/track/overview', '.track-overview-page'],
    ['/#/track/event', '.track-event-page']
  ] as const) {
    await browsePage.goto(path)
    await expect(browsePage.locator(marker).first()).toBeVisible({ timeout: 15_000 })
    await browsePage.waitForTimeout(2_500)
  }
  // 捕获本会话 session_id（SDK 会话存 localStorage mst:{appKey}:session）
  const replaySession = await browsePage.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')?.id || ''
    } catch {
      return ''
    }
  }, `mst:${SEED_APP_KEY}:session`)
  expect(replaySession, '应能读到浏览会话 session_id').not.toBe('')
  // 关页：pagehide beacon 冲刷收尾块与尾批事件；会话自此静默（墙钟窗冻结，打点计数可比）
  await browsePage.close()
  // 等收尾块与事件尾批落库（beacon 传输 + 消费侧异步落储）
  await new Promise((r) => setTimeout(r, 5_000))

  // 轮询反证本会话回放行（切块上传 + 异步落储）
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_replay WHERE app_key = '${SEED_APP_KEY}'` +
              ` AND session_id = '${replaySession}'`
          )
        ) || 0,
      { timeout: 45_000, message: 'track_replay 应有本会话行（切块上传 + 异步落储）' }
    )
    .toBeGreaterThan(0)
  const replayVisitor = psqlTrack(
    `SELECT distinct_id FROM track_replay WHERE session_id = '${replaySession}'`
  )

  // ===== 回放列表：本会话行（startTime 倒序第一行）点播放 =====
  await page.goto('/#/track/replay')
  await expect(page.locator('.track-replay-page')).toBeVisible({ timeout: 15_000 })
  await page.locator('.track-app-select').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()
  const firstRow = page.locator('.track-replay-page .el-table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 15_000 })
  // 访客列绑定本会话（列表无 session_id 列，distinct_id 全量文本在格内）
  await expect(firstRow).toContainText(replayVisitor)
  await firstRow.locator('.track-replay-play').click()

  // ===== 播放器抽屉：.rr-player 渲染 + 打点条圆点 ≥2（$pageview 至少） =====
  const drawer = page.locator('.el-drawer', { hasText: '会话回放' })
  await expect(drawer).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.rr-player')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.replay-meta')).toContainText(/事件\s*[1-9]\d*\s*条/, {
    timeout: 15_000
  })
  const dots = page.locator('.track-replay-event-dot')
  await expect(page.locator('.track-replay-event-track')).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() => dots.count(), { timeout: 15_000, message: '打点条圆点应 ≥2（$pageview 至少）' })
    .toBeGreaterThanOrEqual(2)
  const dotCount = await dots.count()

  // ===== API/psql 反证：打点数据源 /track/replay/events 与 track_event 一致（会话已静默，计数冻结） =====
  const token = await readAccessToken(page)
  const apiEvents: Array<{ eventName: string; ts: number }> = await page.evaluate(
    async ({ sessionId, appKey, auth }) => {
      const resp = await fetch(
        `/api/system/track/replay/events?appKey=${appKey}&sessionId=${sessionId}`,
        { headers: { Authorization: auth } }
      )
      const json = await resp.json()
      return json?.data ?? []
    },
    { sessionId: replaySession, appKey: SEED_APP_KEY, auth: token }
  )
  // 打点条口径（G105c 浏览器审查修正）：仅渲染回放可视区间 [firstEventTs, lastEventTs] 内的事件圆点，
  // 区间外事件（SDK 初始化早于 rrweb 开录等）无法 seek 到可见时刻、不打点——API 全集按同口径过滤后比对
  const replayMeta: { firstEventTs?: number; lastEventTs?: number } = await page.evaluate(
    async ({ sessionId, auth }) => {
      const resp = await fetch(`/api/system/track/replay/detail?sessionId=${sessionId}`, {
        headers: { Authorization: auth }
      })
      const json = await resp.json()
      return json?.data?.replay ?? {}
    },
    { sessionId: replaySession, auth: token }
  )
  const inWindowCount = apiEvents.filter(
    (e) =>
      replayMeta.firstEventTs != null &&
      replayMeta.lastEventTs != null &&
      e.ts >= replayMeta.firstEventTs &&
      e.ts <= replayMeta.lastEventTs
  ).length
  expect(inWindowCount, '渲染圆点数应与回放可视区间内打点事件数一致').toBe(dotCount)
  const dbCount = Number(
    psqlTrack(`SELECT count(*) FROM track_event WHERE session_id = '${replaySession}'`)
  )
  expect(dbCount, 'psql 会话事件数应不少于 API 打点事件数').toBeGreaterThanOrEqual(apiEvents.length)
  // 名称多重集比对（冻结会话 API 墙钟窗覆盖全会话；同刻并列事件 ORDER 不定，逐位比对不稳定；
  // COLLATE "C" 与 JS sort() 同字节序，防 PG 本地化排序差异）
  const dbNames = psqlTrack(
    `SELECT string_agg(event_name, ',' ORDER BY event_name COLLATE \\"C\\") FROM track_event` +
      ` WHERE session_id = '${replaySession}'`
  )
  const apiNames = apiEvents
    .map((e) => e.eventName)
    .sort()
    .join(',')
  expect(apiNames, 'API 打点事件名多重集应与 psql 一致').toBe(dbNames)
  expect(
    apiEvents.filter((e) => e.eventName === '$pageview').length,
    'API 打点应含 ≥2 个 \\$pageview（浏览 3 路由）'
  ).toBeGreaterThanOrEqual(2)

  // ===== 点击圆点 seek（player.goto）：无新增 console error 即播放器未报错。
  // 同刻事件的圆点会钳到同一 left% 互相遮挡（hit-test 失败），force 直派点击等价验证 goto 链路
  const beforeSeek = consoleErrors.length
  await dots.first().click({ force: true })
  await page.waitForTimeout(1_000)
  expect(consoleErrors.slice(beforeSeek), '点击打点圆点 seek 不应产生 console error').toEqual([])

  await ctx2.close()
})

test('W13-3 全程无 console error', async () => {
  expect(consoleErrors, 'W13 全程不应有 console error').toEqual([])
})
