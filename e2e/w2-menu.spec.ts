import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W2-D 菜单管理字段补齐验证：图标选择器新增 → 表格图标列渲染 → 落库核对 → 搜索过滤 → 编辑回显。
 */

function psql(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page
const menuName = `e2e_menu_${Date.now() % 100000}`

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('W2-D1 新增菜单带图标：选择器录入 + 表格渲染 + 落库', async () => {
  await page.goto('/#/system/menu')
  // 等表格首屏数据
  await expect(page.locator('.el-table__row').first()).toBeVisible({ timeout: 10_000 })

  // 打开新增弹窗：新字段表单项可见
  await page.getByRole('button', { name: '新增菜单' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('图标', { exact: true })).toBeVisible()
  await expect(dialog.getByText('是否隐藏', { exact: true })).toBeVisible()
  await expect(dialog.getByText('页面缓存', { exact: true })).toBeVisible()
  await expect(dialog.getByText('是否外链', { exact: true })).toBeVisible()

  await dialog.getByPlaceholder('请输入菜单名称').fill(menuName)

  // 图标选择器：点输入框出网格，选 ri:home-line
  await dialog.locator('.el-form-item', { hasText: '图标' }).locator('input').first().click()
  const popper = page.locator('.icon-selector-popper')
  await expect(popper).toBeVisible()
  // 搜索缩小范围后点选（网格单元格带 data-icon 锚点）
  await popper.getByPlaceholder('搜索图标名称').fill('home-line')
  await popper.locator('.icon-cell[data-icon="ri:home-line"]').click()
  await expect(popper).toBeHidden()
  await expect(
    dialog.locator('.el-form-item', { hasText: '图标' }).locator('input').first()
  ).toHaveValue('ri:home-line')

  // 开关：隐藏打开、缓存关闭（外链保持默认关）
  await dialog.locator('.el-form-item', { hasText: '是否隐藏' }).locator('.el-switch').click()
  await dialog.locator('.el-form-item', { hasText: '页面缓存' }).locator('.el-switch').click()

  const submitResp = page.waitForResponse((r) => r.url().includes('/system/menu/submit'))
  await dialog.getByRole('button', { name: '提交' }).click()
  expect((await submitResp).status(), '菜单提交须 200').toBe(200)
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // 表格：图标列渲染真实图标（.menu-icon 锚点带 data-icon），隐藏/缓存列标签正确
  const row = page.getByRole('row', { name: new RegExp(menuName) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.locator('.menu-icon[data-icon="ri:home-line"]')).toBeVisible()
  await expect(row.getByText('隐藏', { exact: true })).toBeVisible()
  await expect(row.getByText('否', { exact: true }).first()).toBeVisible()

  // 落库核对：icon / is_hide / is_keep_alive / is_external
  const cols = psql(
    `SELECT icon || '|' || is_hide || '|' || is_keep_alive || '|' || is_external FROM sys_menu WHERE menu_name='${menuName}';`
  )
  expect(cols).toBe('ri:home-line|1|0|0')
})

test('W2-D2 搜索栏过滤 + 编辑弹窗回显', async () => {
  await page.goto('/#/system/menu')
  await expect(page.locator('.el-table__row').first()).toBeVisible({ timeout: 10_000 })

  // 菜单名称过滤：唯一名命中后只剩一行（父链被滤的节点由后端提升为根，保证可见）
  await page.locator('.art-search-bar').getByPlaceholder('请输入菜单名称').fill(menuName)
  await page.getByRole('button', { name: '查询' }).click()
  const row = page.getByRole('row', { name: new RegExp(menuName) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.el-table__row')).toHaveCount(1, { timeout: 10_000 })

  // 编辑回显：图标输入框与开关态与提交一致
  await row.getByRole('button', { name: '编辑' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.locator('.el-form-item', { hasText: '图标' }).locator('input').first()
  ).toHaveValue('ri:home-line', { timeout: 10_000 })
  await expect(
    dialog.locator('.el-form-item', { hasText: '是否隐藏' }).locator('.el-switch')
  ).toHaveClass(/is-checked/)
  await expect(
    dialog.locator('.el-form-item', { hasText: '页面缓存' }).locator('.el-switch')
  ).not.toHaveClass(/is-checked/)
  await expect(
    dialog.locator('.el-form-item', { hasText: '是否外链' }).locator('.el-switch')
  ).not.toHaveClass(/is-checked/)
  await dialog.getByRole('button', { name: '取消' }).click()

  // 重置：条件清空、全量树回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.locator('.art-search-bar').getByPlaceholder('请输入菜单名称')).toHaveValue('')
  await expect(page.locator('.el-table__row').first()).toBeVisible({ timeout: 10_000 })
  await expect
    .poll(() => page.locator('.el-table__row').count(), { timeout: 10_000 })
    .toBeGreaterThan(1)

  // 清理
  psql(`DELETE FROM sys_menu WHERE menu_name='${menuName}';`)
})
