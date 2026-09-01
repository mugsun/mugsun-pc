import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { purgeTenant } from './helpers/cleanup'

/**
 * W15 租户运营：新增租户（一键初始化）→ 列表可见 → 删除清理。
 */

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page
const tenantName = `E2E租户${Date.now() % 100000}`
let tenantCode = ''

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  // 产品语义上删租户是逻辑删，但"一键初始化"给租户建了 admin/角色/岗位/部门；
  // 测试造的租户必须连这些一起物理清掉，否则 sys_user 里的 admin 逐轮堆积
  purgeTenant(tenantCode)
  await page?.close()
})

test('W15-1 新增租户并落库', async () => {
  await page.goto('/#/saas/tenant')
  const root = page.locator('.tenant-page')
  await expect(root.getByRole('button', { name: '新增租户' })).toBeVisible({ timeout: 10_000 })

  await root.getByRole('button', { name: '新增租户' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('请输入租户名称').fill(tenantName)
  await dialog.getByPlaceholder('请输入联系人').fill('E2E联系人')

  const createResp = page.waitForResponse(
    (r) => r.url().includes('/system/tenant/create') && r.request().method() === 'POST'
  )
  await dialog.getByRole('button', { name: '提交' }).click()
  const resp = await createResp
  expect(resp.status()).toBe(200)
  const body = await resp.json()
  expect(body.code).toBe(200)
  tenantCode = String(body.data || '')
  expect(tenantCode.length).toBeGreaterThan(0)
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  await expect(root.getByRole('row', { name: new RegExp(tenantName) }).first()).toBeVisible({
    timeout: 10_000
  })
  const dbName = psql(
    `SELECT tenant_name FROM sys_tenant WHERE tenant_code = '${tenantCode}' AND is_deleted = 0`
  )
  expect(dbName).toContain(tenantName)
})

test('W15-2 删除租户清理', async () => {
  await page.goto('/#/saas/tenant')
  const root = page.locator('.tenant-page')
  const row = root.getByRole('row', { name: new RegExp(tenantName) }).first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByRole('button', { name: '删除' }).click()
  await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
  await expect(root.getByRole('row', { name: new RegExp(tenantName) })).toHaveCount(0, {
    timeout: 10_000
  })

  const left = psql(
    `SELECT count(*) FROM sys_tenant WHERE tenant_code = '${tenantCode}' AND is_deleted = 0`
  )
  expect(Number(left)).toBe(0)
})
