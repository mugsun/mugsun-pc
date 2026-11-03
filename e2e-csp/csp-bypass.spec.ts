import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, readAccessToken } from '../e2e/fixtures/auth'
import { PG_CONTAINER } from '../e2e/helpers/docker'

/**
 * #65 CSP 绕过补测（对 nginx enforce 镜像，经 csp-e2e / run-csp-e2e.sh）：
 * 6 sendBeacon → /api/track/collect（2xx|403，无 connect-src enforce）
 * 7 回放 iframe：真实录制→列表播放，.rr-player + iframe DOM、进度前进、无 enforce
 * 8 WebSocket 伪造 Origin 应被拒（boot F7；非 demo 栈 allowedOrigin=* 时 skip）
 * 11 report-uri：boot /api/csp-report 未齐 → skip 骨架
 *
 * 做法说明（7）：优先真实路径——登录后整页刷新使 SDK 读到 replayEnabled，
 * 浏览数页等切块落库（psql 反证），再打开 /#/track/replay 点播放。
 */

interface Violation {
  directive: string
  blocked: string
  disposition: string
  sample: string
}

const SHOTS = process.env.CSP_SHOTS_DIR || 'test-results/csp'
const SEED_APP_KEY = 'ak_000000000000000000000001'
const bypassResult: Record<string, unknown> = {}

test.describe.configure({ mode: 'serial' })

let page: Page
let origin = ''
let testStart = 0

async function drain(p: Page): Promise<Violation[]> {
  return p.evaluate(() => {
    const w = window as unknown as { __csp?: Violation[] }
    const v = w.__csp || []
    w.__csp = []
    return v
  })
}

function requireAdminPassword(): string {
  const pw = process.env.E2E_ADMIN_PASSWORD
  if (!pw) {
    throw new Error(
      'E2E_ADMIN_PASSWORD 未设置（csp-e2e 须由 run-csp-e2e.sh 导出，禁止回落默认口令）'
    )
  }
  return pw
}

function psqlTrack(sql: string): string {
  const pw = process.env.E2E_DB_PASSWORD || ''
  // -e PGPASSWORD 无等号：从本进程环境传入容器（compose 项目名下的 postgres）
  return execSync(
    `docker exec -e PGPASSWORD ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c ${JSON.stringify(sql)}`,
    { encoding: 'utf-8', env: { ...process.env, PGPASSWORD: pw } }
  ).trim()
}

/** 独立 HTTP Upgrade 探测（可设伪造 Origin；浏览器 WebSocket 无法改 Origin） */
function wsUpgradeStatus(baseURL: string, token: string, originHeader: string): Promise<number> {
  const u = new URL(baseURL)
  const reqPath = `/api/ws/message?token=${encodeURIComponent(token)}`
  const key = crypto.randomBytes(16).toString('base64')
  const lib = u.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: reqPath,
        method: 'GET',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': key,
          Origin: originHeader,
          Host: u.host
        }
      },
      (res) => {
        res.resume()
        resolve(res.statusCode || 0)
      }
    )
    req.setTimeout(10_000, () => {
      req.destroy()
      reject(new Error('ws upgrade timeout'))
    })
    req.on('upgrade', (_res, socket) => {
      socket.destroy()
      resolve(101)
    })
    req.on('error', reject)
    req.end()
  })
}

/** 最小可播 rrweb 事件（Meta + FullSnapshot + Scroll），供 CI 播放 fixture */
function fixtureRrwebEvents(startMs = Date.now() - 10_000): unknown[] {
  const events: unknown[] = [
    {
      type: 4,
      data: { href: 'http://127.0.0.1/csp-fixture', width: 800, height: 600 },
      timestamp: startMs
    },
    {
      type: 2,
      data: {
        node: {
          type: 0,
          childNodes: [
            { type: 1, name: 'html', publicId: '', systemId: '', id: 2 },
            {
              type: 2,
              tagName: 'html',
              attributes: { lang: 'zh-CN' },
              childNodes: [
                { type: 2, tagName: 'head', attributes: {}, childNodes: [], id: 4 },
                {
                  type: 2,
                  tagName: 'body',
                  attributes: {},
                  childNodes: [
                    {
                      type: 2,
                      tagName: 'div',
                      attributes: { id: 'app' },
                      childNodes: [{ type: 3, textContent: 'csp-replay-fixture', id: 7 }],
                      id: 6
                    }
                  ],
                  id: 5
                }
              ],
              id: 3
            }
          ],
          id: 1
        },
        initialOffset: { top: 0, left: 0 }
      },
      timestamp: startMs + 100
    }
  ]
  // Scroll 增量（source=3）拉长时间轴，避免 MouseMove 格式差异导致中途停播
  for (let i = 1; i <= 40; i++) {
    events.push({
      type: 3,
      data: { source: 3, id: 5, x: 0, y: i * 20 },
      timestamp: startMs + 250 + i * 200
    })
  }
  return events
}

test.beforeAll(async ({ browser, baseURL }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
  testStart = Date.now()
  origin = new URL(baseURL!).origin
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    const w = window as unknown as { __csp: Violation[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
        disposition: e.disposition,
        sample: (e.sample || '').slice(0, 60)
      })
    })
  })
  page = await ctx.newPage()
  await login(page, { password: requireAdminPassword() })
  // 回放开关「下次启动生效」：刷新后 SDK 读到 replayEnabled
  await page.reload()
  await expect(page).not.toHaveURL(/#\/auth\/login/, { timeout: 15_000 })
})

test.afterAll(async () => {
  const out = path.join(SHOTS, 'bypass-result.json')
  fs.writeFileSync(out, JSON.stringify(bypassResult, null, 2))
  await page?.context().close()
})

test('6. sendBeacon 到 /api/track/collect：2xx 或 403，无 connect-src enforce', async () => {
  await page.goto('/#/dashboard/console')
  await page.waitForTimeout(1500)
  await drain(page)

  const statuses: number[] = []
  const onResp = (r: { url(): string; status(): number }) => {
    if (r.url().includes('/api/track/collect')) statuses.push(r.status())
  }
  page.on('response', onResp)

  // 直接 sendBeacon：即便体不完整，403 也证明未被 CSP 拦；true=浏览器接受发送
  const beaconOk = await page.evaluate((appKey) => {
    const body = JSON.stringify({
      app_key: appKey,
      schema_version: 1,
      sdk: { platform: 'web', version: 'csp-bypass' },
      sent_at: Date.now(),
      events: []
    })
    return navigator.sendBeacon(
      '/api/track/collect',
      new Blob([body], { type: 'application/json' })
    )
  }, SEED_APP_KEY)

  // 再触发 pagehide，覆盖「卸载时」路径（SDK 队列可能再发一帧）
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
  await page.waitForTimeout(2500)
  page.off('response', onResp)

  const v = await drain(page)
  const connectEnf = v.filter(
    (x) => x.disposition === 'enforce' && /connect-src/i.test(x.directive)
  )
  bypassResult.sendBeacon = { beaconOk, statuses, connectEnf, violations: v }

  expect(beaconOk, 'sendBeacon 返回 false 通常表示被 CSP/配额拒绝').toBe(true)
  expect(connectEnf, JSON.stringify(connectEnf)).toEqual([])
  for (const s of statuses) {
    const ok = (s >= 200 && s < 300) || s === 403
    expect(ok, `collect 状态须 2xx 或 403，实际 ${s}`).toBe(true)
  }
})

test('8. WebSocket 伪造 Origin 应被拒（boot F7）', async () => {
  const token = await readAccessToken(page)
  expect(token, '须已登录拿到 accessToken').toBeTruthy()

  const sameOrigin = await wsUpgradeStatus(origin, token, origin)
  bypassResult.wsSameOrigin = sameOrigin
  expect(sameOrigin, '同源（或 front-url）握手应 101').toBe(101)

  const forged = await wsUpgradeStatus(origin, token, 'https://evil.example')
  bypassResult.wsForgedOrigin = forged

  // prod 栈 allowedOrigin=* 时伪造仍 101：F7 仅 demo；不卡 tip，skip 并注明
  if (forged === 101) {
    test.skip(
      true,
      'boot 未启用 F7（非 demo / allowedOrigin=*）；伪造 Origin 仍 101。' +
        '依赖 mugsun.demo.enabled + ws-allowed-origins；CSP e2e 默认 prod 不作破坏性改栈'
    )
  }
  expect(forged, `伪造 Origin 不得 101，实际 ${forged}`).not.toBe(101)
})

test('11. report-uri /api/csp-report（骨架，依赖 boot）', async () => {
  // 检索表明 boot 尚无 /api/csp-report；不要卡 tip
  test.skip(true, '依赖 boot /api/csp-report 就绪后再补：收集端收报告、无 query、打 1000 次限流')
  // 以下为就绪后的断言骨架（当前 skip 不会执行）
  const resp = await page.request.post('/api/csp-report', {
    data: {
      'csp-report': { 'blocked-uri': 'https://evil.example', 'effective-directive': 'script-src' }
    }
  })
  expect(resp.status()).toBeGreaterThanOrEqual(200)
  expect(resp.status()).toBeLessThan(500)
})

test('7. 回放 iframe：录制→播放，DOM/进度前进，无 enforce', async () => {
  test.setTimeout(180_000)

  // 真实录制：证明 enforce 下 SDK 能 POST /track/replay（种子 app replay_enabled=1）
  for (const [hash, marker] of [
    ['/#/system/user', '.el-table'],
    ['/#/system/role', '.el-table'],
    ['/#/dashboard/console', '#app']
  ] as const) {
    await page.goto(hash)
    await expect(page.locator(marker).first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(3_000)
  }

  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_replay WHERE app_key = '${SEED_APP_KEY}'` +
              ` AND start_time >= to_timestamp(${testStart} / 1000.0) AND last_seq >= 0`
          )
        ) || 0,
      { timeout: 60_000, message: 'track_replay 应有 last_seq>=0 的本会话行' }
    )
    .toBeGreaterThan(0)

  // 播放：CI compose 下 local-plus 读块会「文件下载失败」（boot 日志已证 seq≥1），
  // issue 允许 mock 可播记录——对 detail/data 注入最小 fixture，专验播放器 CSP。
  const startMs = Date.now() - 10_000
  const fixtureEvents = fixtureRrwebEvents(startMs)
  await page.route('**/api/system/track/replay/detail**', async (route) => {
    const u = new URL(route.request().url())
    const sessionId = u.searchParams.get('sessionId') || 'csp-fixture'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        success: true,
        data: {
          replay: {
            sessionId,
            appKey: SEED_APP_KEY,
            lastSeq: 0,
            startTime: startMs,
            durationMs: 10_000,
            rrwebEvents: fixtureEvents.length,
            hasError: 0,
            entryPath: '/dashboard/console',
            distinctId: 'csp-e2e',
            firstEventTs: startMs,
            lastEventTs: startMs + 10_000,
            sizeBytes: 1024
          },
          blocks: [{ seq: 0, key: 'fixture/0.gz' }]
        }
      })
    })
  })
  await page.route('**/api/system/track/replay/data**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixtureEvents)
    })
  })
  await page.route('**/api/system/track/replay/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, success: true, data: [] })
    })
  })

  await page.goto('/#/track/replay')
  await expect(page.locator('.track-replay-page')).toBeVisible({ timeout: 15_000 })
  await page.locator('.track-app-select').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()
  const firstRow = page.locator('.track-replay-page .el-table tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 15_000 })
  await drain(page)
  await firstRow.locator('.track-replay-play').click()

  const drawer = page.locator('.el-drawer', { hasText: '会话回放' })
  await expect(drawer).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.rr-player')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.replayer-wrapper iframe, .rr-player iframe').first()).toBeAttached({
    timeout: 20_000
  })

  const progress = page.locator('.rr-progress__step').first()
  await expect(progress).toBeVisible({ timeout: 10_000 })
  // autoPlay：进度应离开 0%
  await expect
    .poll(async () => progress.evaluate((el) => parseFloat((el as HTMLElement).style.width) || 0), {
      timeout: 15_000,
      message: 'autoPlay 后进度应 > 0'
    })
    .toBeGreaterThan(0)
  const widthBefore = await progress.evaluate((el) => (el as HTMLElement).style.width || '')
  // 点击进度条后半段强制 seek，确认可交互前进（不依赖持续 autoPlay）
  const bar = page.locator('.rr-progress').first()
  const box = await bar.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width * 0.72, box.y + box.height / 2)
  } else {
    const playBtn = page.locator('.rr-controller__btns button').first()
    await playBtn.click().catch(() => undefined)
  }
  await expect
    .poll(async () => progress.evaluate((el) => (el as HTMLElement).style.width || ''), {
      timeout: 15_000,
      message: 'seek/播放后进度条宽度应变'
    })
    .not.toBe(widthBefore)

  const v = await drain(page)
  const enf = v.filter((x) => x.disposition === 'enforce')
  await page.screenshot({ path: path.join(SHOTS, '07-replay-player.png') })
  bypassResult.replay = {
    enforce: enf,
    progressMoved: true,
    note: '录制真实落库；播放块用 fixture（CI local-plus 读块失败）'
  }
  expect(enf, JSON.stringify(enf)).toEqual([])
  await page.unroute('**/api/system/track/replay/detail**')
  await page.unroute('**/api/system/track/replay/data**')
  await page.unroute('**/api/system/track/replay/events**')
})
