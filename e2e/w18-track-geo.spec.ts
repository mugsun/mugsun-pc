import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * G106 埋点地理：地域分布看板 + GIS 工作台叠加埋点热力 + 接入开关 + 表单选点积木。
 */

const SEED_APP_KEY = 'ak_000000000000000000000001'
const FORM_KEY = 'g106_gis_pick'
let testStart = 0
const EVENT_IDS: string[] = []

function psqlTrack(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

function psqlBiz(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

function seedGeoRows(): void {
  const id1 = `g106e1${testStart}`
  const id2 = `g106e2${testStart}`
  EVENT_IDS.push(id1, id2)
  const sql =
    `INSERT INTO track_event (id, event_id, app_key, event_name, client_ts, ts, received_at,` +
    ` clock_skewed, distinct_id, session_id, tenant_id, ip_region, geo_lon, geo_lat, props)` +
    ` VALUES` +
    ` (${testStart}1, '${id1}', '${SEED_APP_KEY}', '$pageview', now(), now(), now(), 0,` +
    ` 'g106-e2e-a', 'g106-sess-a', '000000', '中国|0|北京|北京市|联通', 116.3974, 39.9092, '{}'),` +
    ` (${testStart}2, '${id2}', '${SEED_APP_KEY}', '$pageview', now(), now(), now(), 0,` +
    ` 'g106-e2e-b', 'g106-sess-b', '000000', '中国|0|浙江省|杭州市|电信', 120.15, 30.28, '{}')`
  psqlTrack(sql)
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  testStart = Date.now()
  seedGeoRows()
  page = await browser.newPage()
  await login(page)
  await page.evaluate((k) => localStorage.setItem('track:appKey', k), SEED_APP_KEY)
})

test.afterAll(async () => {
  await page?.close()
  if (EVENT_IDS.length) {
    const inList = EVENT_IDS.map((id) => `'${id}'`).join(',')
    psqlTrack(`DELETE FROM track_event WHERE event_id IN (${inList})`)
  }
  psqlBiz(`DELETE FROM sys_form_data WHERE form_key = '${FORM_KEY}'`)
  psqlBiz(`DELETE FROM sys_form WHERE form_key = '${FORM_KEY}'`)
})

test('W18-1 概览地域分布出现省份并渲染热力容器', async () => {
  await page.goto('/#/track/overview')
  await expect(page.getByText('地域分布')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('cell', { name: '北京' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('cell', { name: '浙江省' })).toBeVisible()
  await expect(page.getByTestId('gis-heat-map')).toBeVisible()
})

test('W18-2 工作台可叠加埋点热力', async () => {
  await page.goto('/#/gis/workspace')
  await expect(page.getByRole('button', { name: '保存场景' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '更多' }).click()
  await page.getByRole('menuitem', { name: /埋点热力/ }).click()
  await page.getByRole('button', { name: '图层', exact: true }).click()
  await expect(page.locator('.gis-ov-card').filter({ hasText: '埋点热力' })).toBeVisible({
    timeout: 10_000
  })
})

test('W18-3 接入管理可见精确位置开关', async () => {
  await page.goto('/#/track/app')
  await expect(page.getByRole('button', { name: '新增应用' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '新增应用' }).click()
  await expect(page.getByText('精确位置')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/征求定位后随会话上报/)).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
})

test('W18-4 表单设计器辅助栏有地图选点', async () => {
  await page.goto('/#/system/form-designer')
  await expect(page.getByRole('button', { name: '新建表单' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '新建表单' }).click()
  await page.getByPlaceholder('请输入表单名称').fill('G106地图选点')
  await page.getByPlaceholder('唯一英文标识，如 leave_apply').fill(FORM_KEY)
  await page.getByRole('button', { name: '创建并设计' }).click()
  await expect(page.getByRole('dialog', { name: /设计表单/ })).toBeVisible({ timeout: 15_000 })
  const pick = page.locator('._fc-l-name', { hasText: '地图选点' })
  await pick.scrollIntoViewIfNeeded()
  await expect(pick).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: '取消' }).click()
})
