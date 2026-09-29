import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { minify } from 'terser'
import { SourceMapConsumer } from 'source-map-js'
import { login, readAccessToken } from './fixtures/auth'
import { PG_CONTAINER, REDIS_CONTAINER } from './helpers/docker'

/**
 * W10 错误堆栈 sourcemap 还原 + 符号表管理 + 错误告警全链路验证（G101）：
 * terser 真实压缩产出 .map fixture → 接入管理「符号表」tab 上传 → evaluate 直调 SDK track('$error')
 * 制造带 release=e2e-w10 的错误 → 错误页指纹分组 → 详情抽屉「还原堆栈」（前端 source-map-js 懒加载映射）
 * → 应用弹窗开告警（阈值 3）→ 同指纹连发 3 条 → /system/message/my/page 断言「埋点错误告警」
 * → 测后清理（track_event/session/sourcemap 行 + 存储文件 + sys_message 告警信 + Redis 告警键 + track_app 告警复位）。
 * 前置：mugsun-boot(:8080) 已重启加载 G101 代码（T6 迁移已执行）；vite dev(:3007) 在跑。
 */

/** 默认应用种子 app_key（与后端 track 库 T2 迁移种子一致） */
const SEED_APP_KEY = 'ak_000000000000000000000001'
/** 本次测试使用的 release（错误事件 props.release 与符号表 release 对齐） */
const RELEASE = 'e2e-w10'
/** 还原阶段的错误消息 / 告警阶段的错误消息（不同 message → 不同指纹，互不干扰） */
const RESTORE_MESSAGE = 'w10 boom'
const ALERT_MESSAGE = 'w10 alert boom'
/** 压缩文件 URL（仅作堆栈帧定位与符号表文件名匹配，无需真实存在） */
const MINIFIED_URL = 'http://localhost:3007/e2e/w10-fixture.min.js'
const MAP_FILENAME = 'w10-fixture.min.js.map'
/** dev 本地存储根（application.yml x-file-storage local-plus storage-path） */
const DEV_STORAGE_ROOT = '/tmp/mugsun-files/'
/** 前端 baseURL（消息接口断言用） */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3007'

/** 测试起点（epoch 毫秒）：psql 反证/清理的统一时间窗下界 */
let testStart = 0
/** fixture：还原/告警两阶段共用的压缩堆栈（帧位置由 fixture sourcemap 反推，保证可还原回已知原始行） */
let restoreStack = ''
let restoreFingerprint = ''
let alertFingerprint = ''
/** fixture .map 临时文件路径（el-upload setInputFiles 用） */
let mapFilePath = ''

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

// ===== 指纹算法与 SDK 保持一致（mugsun-track core/utils fnv1a + plugins/error firstFrame） =====
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function firstFrame(stack: string): string {
  for (const line of stack.split('\n')) {
    const m = line.match(/(https?:\/\/\S+?|file:\/\/\S+?|webpack:\/\/\S+?)(:\d+){1,2}/)
    if (m) return m[0].replace(/(:\d+){1,2}$/, '')
  }
  return ''
}

function fingerprintOf(message: string, stack: string): string {
  return fnv1a(`${message}|${firstFrame(stack)}`)
    .toString(16)
    .padStart(8, '0')
}

/** 页面内直调 SDK 上报 $error（经 #app.__vue_app__ 取 globalProperties.$track，无需任何测试钩子） */
async function trackError(page: Page, message: string): Promise<void> {
  await page.evaluate(
    ({ message, stack, release, fp }) => {
      const app = (document.getElementById('app') as any)?.__vue_app__
      const tracker = app?.config?.globalProperties?.$track
      if (!tracker) throw new Error('tracker 未就绪')
      tracker.track('$error', {
        error_type: 'js',
        message,
        stack,
        release,
        error_fingerprint: fp
      })
    },
    {
      message,
      stack: restoreStack,
      release: RELEASE,
      fp: message === RESTORE_MESSAGE ? restoreFingerprint : alertFingerprint
    }
  )
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()

  // ===== fixture：一小段 JS 经 terser 真实压缩产出 .map；堆栈帧位置由 map 反推（保证可还原回已知原始行） =====
  const fixtureSrc = `function e2eW10Boom() {
  throw new Error('${RESTORE_MESSAGE}')
}
function e2eW10Entry() {
  e2eW10Boom()
}
e2eW10Entry()
`
  const minified = await minify(
    { 'w10-fixture.js': fixtureSrc },
    {
      compress: true,
      mangle: true,
      sourceMap: { filename: 'w10-fixture.min.js', url: MAP_FILENAME }
    }
  )
  if (!minified.code || !minified.map) throw new Error('terser 压缩 fixture 失败')
  mapFilePath = path.join(os.tmpdir(), MAP_FILENAME)
  fs.writeFileSync(mapFilePath, String(minified.map))

  // 反推两个压缩位置：原始第 2 行（throw）与第 5 行（调用）；逐一做 roundtrip 校验，
  // 保证页面侧 originalPositionFor（GLB 默认 bias）还原后恰回到该原始行
  const consumer = new SourceMapConsumer(JSON.parse(String(minified.map)))
  const pickGenerated = (origLine: number): { line: number; column: number } => {
    for (let col = 0; col <= 80; col++) {
      const g = consumer.generatedPositionFor({
        source: 'w10-fixture.js',
        line: origLine,
        column: col,
        bias: SourceMapConsumer.LEAST_UPPER_BOUND
      })
      if (g.line == null || g.column == null) continue
      const back = consumer.originalPositionFor({ line: g.line, column: g.column })
      if (back.source === 'w10-fixture.js' && back.line === origLine) {
        return { line: g.line, column: g.column }
      }
    }
    throw new Error(`未能定位原始第 ${origLine} 行对应的压缩位置`)
  }
  const g1 = pickGenerated(2)
  const g2 = pickGenerated(5)
  ;(consumer as any).destroy?.()

  restoreStack =
    `Error: ${RESTORE_MESSAGE}\n` +
    `    at e2eW10Boom (${MINIFIED_URL}:${g1.line}:${g1.column})\n` +
    `    at e2eW10Entry (${MINIFIED_URL}:${g2.line}:${g2.column})`
  restoreFingerprint = fingerprintOf(RESTORE_MESSAGE, restoreStack)
  alertFingerprint = fingerprintOf(ALERT_MESSAGE, restoreStack)

  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  // 先关页：触发 pagehide → SDK beacon 冲刷尾批事件，再删数据（先删后关会漏掉卸载时的尾批）
  await page?.close()
  if (testStart <= 0) return
  // 等尾批落库 + 告警评估（beacon 传输 + 消费侧异步落储）
  await new Promise((r) => setTimeout(r, 5_000))

  // 符号表存储文件 + 元数据行（目录为 sourcemap/{app}/{release}/ 测试独占，整目录删）
  const keys = psqlTrack(
    `SELECT storage_key FROM track_sourcemap WHERE app_key = '${SEED_APP_KEY}' AND release = '${RELEASE}'`
  )
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)
  for (const key of keys) {
    fs.rmSync(path.join(DEV_STORAGE_ROOT, path.dirname(key)), { recursive: true, force: true })
  }
  const sourcemaps = psqlTrack(
    `DELETE FROM track_sourcemap WHERE app_key = '${SEED_APP_KEY}' AND release = '${RELEASE}'`
  )
  // 应用告警配置复位
  psqlTrack(
    `UPDATE track_app SET alert_enabled = 0, alert_threshold = 10 WHERE app_key = '${SEED_APP_KEY}'`
  )
  // 告警站内信（业务库）：按标题 + 内容含本测试指纹精确定位
  for (const fp of [restoreFingerprint, alertFingerprint]) {
    psqlBiz(
      `DELETE FROM sys_message_user WHERE message_id IN (SELECT id FROM sys_message` +
        ` WHERE title = '埋点错误告警' AND content LIKE '%${fp}%')`
    )
    psqlBiz(`DELETE FROM sys_message WHERE title = '埋点错误告警' AND content LIKE '%${fp}%'`)
  }
  // Redis 告警键（规则 A 首告去重键 TTL 7 天，须显式删；频次/抑制键 10 分钟自过期，一并清理）
  const redisKeys = [restoreFingerprint, alertFingerprint].flatMap((fp) => [
    `mugsun:track:alert-new:${SEED_APP_KEY}:${fp}`,
    `mugsun:track:alert-freq:${SEED_APP_KEY}:${fp}`,
    `mugsun:track:alert-sent:${SEED_APP_KEY}:${fp}`
  ])
  execSync(`docker exec ${REDIS_CONTAINER} redis-cli -n 3 DEL ${redisKeys.join(' ')}`, {
    encoding: 'utf-8'
  })
  // 事件/会话行（口径同 w8/w9）
  const sessions = psqlTrack(
    `DELETE FROM track_session WHERE session_id IN (SELECT DISTINCT session_id FROM track_event` +
      ` WHERE received_at >= to_timestamp(${testStart} / 1000.0))`
  )
  const events = psqlTrack(
    `DELETE FROM track_event WHERE received_at >= to_timestamp(${testStart} / 1000.0)`
  )
  if (mapFilePath) fs.rmSync(mapFilePath, { force: true })
  console.log(
    `[w10-track-error] 清理测试数据：track_event ${events}，track_session ${sessions}，` +
      `track_sourcemap ${sourcemaps}，存储目录 ${keys.length} 个，告警站内信/Redis 键已清`
  )
})

test('W10-1 符号表管理：上传 .map（UI 全链路），列表可见', async () => {
  await page.goto('/#/track/app')
  await expect(page.locator('.track-app-page')).toBeVisible({ timeout: 15_000 })
  // 切到「符号表」tab
  await page.locator('.el-tabs__item', { hasText: '符号表' }).click()
  // 显式选中种子应用（应用下拉默认可能落在其他应用上）
  await page.locator('.track-app-select:visible').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()

  // 上传弹窗：release + 手动选文件 → 提交
  await page.getByRole('button', { name: '上传符号表' }).click()
  const dialog = page.locator('.el-dialog', { hasText: '上传符号表' })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.getByPlaceholder('与错误事件 release 对齐').fill(RELEASE)
  await dialog.locator('input[type="file"]').setInputFiles(mapFilePath)
  await dialog.getByRole('button', { name: '上传', exact: true }).click()

  await expect(page.locator('.el-message', { hasText: '上传成功' })).toBeVisible({
    timeout: 10_000
  })
  // 列表出现该符号表行（release + 文件名）
  const row = page.locator('.el-table tbody tr', { hasText: MAP_FILENAME })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row).toContainText(RELEASE)
  await page.screenshot({ path: '/tmp/g101-sourcemap-tab.png', fullPage: true })
})

test('W10-2 制造带 release 的错误事件：psql 落库反证 + 错误页指纹分组可见', async () => {
  await trackError(page, RESTORE_MESSAGE)
  // SDK 批量队列 5s 冲刷 + 消费侧异步落储，轮询反证
  await expect
    .poll(
      () =>
        Number(
          psqlTrack(
            `SELECT count(*) FROM track_event WHERE event_name = '\\$error'` +
              ` AND error_fingerprint = '${restoreFingerprint}'`
          )
        ) || 0,
      { timeout: 30_000, message: 'track_event 应有本测试 $error 行' }
    )
    .toBeGreaterThan(0)

  await page.goto('/#/track/error')
  await expect(page.locator('.track-error-page')).toBeVisible({ timeout: 15_000 })
  await page.locator('.track-app-select:visible').click()
  await page.getByRole('option', { name: 'mugsun-pc 自监控' }).click()
  const row = page.locator('.track-error-page .el-table tbody tr', { hasText: RESTORE_MESSAGE })
  await expect(row).toBeVisible({ timeout: 15_000 })
})

test('W10-3 详情抽屉「还原堆栈」：压缩帧映射回原始文件与行列', async () => {
  const row = page.locator('.track-error-page .el-table tbody tr', { hasText: RESTORE_MESSAGE })
  // 打开指纹组详情抽屉（操作列唯一按钮 = 查看）
  await row.locator('td:last-child div.rounded-md').first().click()
  const drawer = page.locator('.el-drawer', { hasText: '错误详情' })
  await expect(drawer).toBeVisible({ timeout: 10_000 })
  // 展开首条事件行
  await drawer.locator('.el-table__expand-icon').first().click()

  // 点击「还原堆栈」：拉 page 查符号表 → 逐个拉 raw → source-map-js 懒加载映射
  await page.getByRole('button', { name: '还原堆栈' }).click()
  const restored = drawer.locator('.track-restore-pre')
  await expect(restored).toBeVisible({ timeout: 15_000 })
  // 还原后帧位置 = 原始文件 + 构造 fixture 时校验过的原始行（2=throw 行，5=调用行）
  const text = await restored.innerText()
  expect(text, '还原堆栈应包含原始文件名与 throw 行').toContain('w10-fixture.js:2:')
  expect(text, '还原堆栈应包含原始文件名与调用行').toContain('w10-fixture.js:5:')
  await page.screenshot({ path: '/tmp/g101-restore.png', fullPage: true })
  await page.keyboard.press('Escape')
})

test('W10-4 错误告警：应用弹窗开启（阈值 3）→ 同指纹连发 → 站内信「埋点错误告警」', async () => {
  test.setTimeout(90_000)
  // 应用管理 tab 编辑种子应用：开错误告警 + 阈值 3
  await page.goto('/#/track/app')
  await expect(page.locator('.track-app-page')).toBeVisible({ timeout: 15_000 })
  // keepAlive 下重回本页会保留上次 tab 选中态（W10-1 停在符号表），显式切回应用管理再定位行
  await page.locator('.el-tabs__item', { hasText: '应用管理' }).click()
  const appRow = page.locator('.el-tab-pane:visible .el-table tbody tr', {
    hasText: 'mugsun-pc 自监控'
  })
  await appRow.locator('td:last-child div.rounded-md').first().click()
  const dialog = page.locator('.el-dialog', { hasText: '编辑应用' })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await dialog.locator('.el-form-item', { hasText: '错误告警' }).locator('.el-switch').click()
  await dialog.locator('.el-form-item', { hasText: '告警阈值' }).locator('input').fill('3')
  await dialog.getByRole('button', { name: '提交' }).click()
  await expect(page.locator('.el-message', { hasText: '保存成功' })).toBeVisible({
    timeout: 10_000
  })
  // psql 反证配置落库
  const cfg = psqlTrack(
    `SELECT alert_enabled || ':' || alert_threshold FROM track_app WHERE app_key = '${SEED_APP_KEY}'`
  )
  expect(cfg, '告警配置应落库（enabled=1, threshold=3）').toBe('1:3')

  // 同指纹连发 3 条（规则 A 首告 + 规则 B 达阈值各发一条）
  for (let i = 0; i < 3; i++) await trackError(page, ALERT_MESSAGE)

  // 走「我的消息」接口断言（比页面角标/推送更稳）
  const token = await readAccessToken(page)
  await expect
    .poll(
      async () => {
        const resp = await page.request.get(
          `${BASE_URL}/api/system/message/my/page?pageNum=1&pageSize=20`,
          { headers: { Authorization: token } }
        )
        const json = await resp.json()
        const records: any[] = json?.data?.records ?? []
        return records.filter(
          (r) => r.title === '埋点错误告警' && String(r.content ?? '').includes(alertFingerprint)
        ).length
      },
      { timeout: 45_000, message: '应收到本测试指纹的「埋点错误告警」站内信' }
    )
    .toBeGreaterThan(0)

  // 页面侧佐证：我的消息列表可见该告警
  await page.goto('/#/system/message')
  await expect(page.locator('.my-message-page')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.my-message-page').first()).toContainText('埋点错误告警', {
    timeout: 15_000
  })
  await page.screenshot({ path: '/tmp/g101-alert-message.png', fullPage: true })
})
