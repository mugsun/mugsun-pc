import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { purgePosts, purgeTenant } from './helpers/cleanup'
import { createTenant, ensurePost } from './helpers/prepare'

/**
 * W2 组织域搜索栏验证：部门/岗位/参数/租户/租户套餐 五页搜索过滤与重置。
 * 写法对齐 w2-user.spec.ts（serial + 共享 page + login fixture）。
 * 注意：keepAlive 页面驻留 DOM，所有行/输入定位必须按页面根类作用域化。
 * 岗位与租户行由本 spec 自建（不依赖种子/残留），跑完物理清掉。
 */

test.describe.configure({ mode: 'serial' })

let page: Page
const POST_NAME = '开发工程师'
const TENANT_NAME = `E2E组织租户${Date.now() % 100000}`
let tenantCode = ''

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
  await ensurePost(page, POST_NAME, 'dev')
  tenantCode = await createTenant(page, TENANT_NAME)
})

test.afterAll(async () => {
  purgeTenant(tenantCode)
  purgePosts(POST_NAME)
  await page?.close()
})

test('部门页搜索栏：名称过滤（命中+祖先）与重置', async () => {
  await page.goto('/#/system/dept')
  const root = page.locator('.dept-page')
  // 等树首屏数据（种子含 研发中心）
  await expect(root.getByRole('row', { name: /研发中心/ }).first()).toBeVisible({ timeout: 10_000 })

  // 名称过滤：研发中心 → 命中行在（祖先行保留）
  const nameInput = root.getByPlaceholder('请输入部门名称')
  await nameInput.fill('研发中心')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.getByRole('row', { name: /研发中心/ }).first()).toBeVisible({ timeout: 10_000 })

  // 无命中关键字 → 树为空
  await nameInput.fill('e2e不存在部门xyz')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.locator('.el-table__row:visible')).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、全树回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(root.getByRole('row', { name: /研发中心/ }).first()).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveValue('')
})

test('岗位页搜索栏：名称/编码过滤与重置', async () => {
  await page.goto('/#/system/post')
  const root = page.locator('.post-page')
  // 等表格首屏数据（种子含 开发工程师）
  await expect(root.getByRole('row', { name: /开发工程师/ }).first()).toBeVisible({
    timeout: 10_000
  })

  // 名称过滤：开发 → 开发工程师行在
  const nameInput = root.getByPlaceholder('请输入岗位名称')
  await nameInput.fill('开发')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.getByRole('row', { name: /开发工程师/ }).first()).toBeVisible({
    timeout: 10_000
  })

  // 编码过滤：无命中关键字 → 列表为空
  await root.getByPlaceholder('请输入岗位编码').fill('e2e不存在编码xyz')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.getByRole('row', { name: /开发工程师/ })).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(root.getByRole('row', { name: /开发工程师/ }).first()).toBeVisible({
    timeout: 10_000
  })
  await expect(nameInput).toHaveValue('')
})

test('参数页搜索栏：名称过滤与重置', async () => {
  await page.goto('/#/system/param')
  const root = page.locator('.param-page')
  // 等表格首屏数据（首行参数名动态取，避免硬编码种子）
  const firstRow = root.locator('.el-table__row').first()
  await expect(firstRow).toBeVisible({ timeout: 10_000 })
  const paramName = (await firstRow.locator('td').nth(1).innerText()).trim()
  expect(paramName).not.toBe('')

  // 名称过滤：按首行参数名搜 → 该行仍在
  const nameInput = root.getByPlaceholder('请输入参数名称')
  await nameInput.fill(paramName)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.getByRole('row', { name: new RegExp(paramName) }).first()).toBeVisible({
    timeout: 10_000
  })

  // 无命中关键字 → 列表为空
  await nameInput.fill('e2e不存在参数xyz')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.locator('.el-table__row:visible')).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(root.locator('.el-table__row:visible').first()).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveValue('')
})

test('租户页搜索栏：名称/状态过滤与重置', async () => {
  await page.goto('/#/saas/tenant')
  const root = page.locator('.tenant-page')
  // 等表格首屏数据（首行租户名动态取）
  const firstRow = root.locator('.el-table__row').first()
  await expect(firstRow).toBeVisible({ timeout: 10_000 })
  // 列序：序号 / 租户编号 / 租户名称
  const tenantName = (await firstRow.locator('td').nth(2).innerText()).trim()
  expect(tenantName).not.toBe('')

  // 名称过滤：按首行租户名搜 → 该行仍在
  const nameInput = root.getByPlaceholder('请输入租户名称')
  await nameInput.fill(tenantName)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.getByRole('row', { name: new RegExp(tenantName) }).first()).toBeVisible({
    timeout: 10_000
  })

  // 状态过滤：正常 → 仍有行
  await root.locator('.el-form-item', { hasText: '状态' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: '正常' }).click()
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.locator('.el-table__row:visible').first()).toBeVisible({ timeout: 10_000 })

  // 无命中关键字 → 列表为空
  await nameInput.fill('e2e不存在租户xyz')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.locator('.el-table__row:visible')).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(root.locator('.el-table__row:visible').first()).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveValue('')
})

test('租户套餐页搜索栏：名称/状态过滤与重置', async () => {
  await page.goto('/#/saas/tenant-package')
  const root = page.locator('.tpkg-page')
  // 等表格首屏数据（首行套餐名动态取）
  const firstRow = root.locator('.el-table__row').first()
  await expect(firstRow).toBeVisible({ timeout: 10_000 })
  // 列序：序号 / 套餐名称
  const packageName = (await firstRow.locator('td').nth(1).innerText()).trim()
  expect(packageName).not.toBe('')

  // 名称过滤：按首行套餐名搜 → 该行仍在
  const nameInput = root.getByPlaceholder('请输入套餐名称')
  await nameInput.fill(packageName)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.getByRole('row', { name: new RegExp(packageName) }).first()).toBeVisible({
    timeout: 10_000
  })

  // 状态过滤：启用 → 仍有行（种子套餐默认启用）
  await root.locator('.el-form-item', { hasText: '状态' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: '启用' }).click()
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.locator('.el-table__row:visible').first()).toBeVisible({ timeout: 10_000 })

  // 无命中关键字 → 列表为空
  await nameInput.fill('e2e不存在套餐xyz')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(root.locator('.el-table__row:visible')).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(root.locator('.el-table__row:visible').first()).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveValue('')
})
