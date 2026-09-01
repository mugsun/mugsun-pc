import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { purgePosts } from './helpers/cleanup'
import { ensureDataTestRole, ensurePost } from './helpers/prepare'

/**
 * W2-S1/S3 用户页黄金验证：搜索栏真实过滤 + 建档挂部门/岗位/角色端到端。
 */

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
  // 建档要挂岗位与角色，前置由本 spec 自建（不依赖种子或上一轮残留）
  await ensurePost(page, '开发工程师', 'dev')
  await ensureDataTestRole(page)
})

test.afterAll(async () => {
  purgePosts('开发工程师')
  await page?.close()
})

test('W2-S1 用户页搜索栏：条件过滤与重置', async () => {
  await page.goto('/#/system/user')
  // 等表格首屏数据
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })

  // 用户名过滤：admin → admin 行在、fronttest 行不在
  const usernameInput = page.getByPlaceholder('请输入用户名')
  await usernameInput.fill('admin')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /fronttest/ })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible()

  // 叠加状态过滤：停用 → admin(启用) 也不见（状态/部门项默认收起，先展开）
  await page.getByText('展开').first().click()
  await page.locator('.el-form-item', { hasText: '状态' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: '停用' }).click()
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /admin/ })).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })
  await expect(usernameInput).toHaveValue('')
})

test('W2-S3 建档挂部门/岗位/角色：创建→落库→回显', async () => {
  const username = `e2e_s3_${Date.now() % 100000}`
  await page.goto('/#/system/user')
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })

  // 打开新增弹窗：组织字段可见
  await page.getByRole('button', { name: '新增用户' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('部门', { exact: true })).toBeVisible()
  await expect(dialog.getByText('岗位', { exact: true })).toBeVisible()
  await expect(dialog.getByText('角色', { exact: true })).toBeVisible()
  await expect(dialog.getByText('邮箱', { exact: true })).toBeVisible()

  await dialog.getByPlaceholder('请输入用户名').fill(username)
  await dialog.getByPlaceholder('请输入昵称').fill('S3验证用户')

  // 部门：树选择 研发中心
  await dialog.locator('.el-form-item', { hasText: '部门' }).locator('.el-select').first().click()
  await page.getByRole('tree').getByText('研发中心').first().click()
  await page.keyboard.press('Escape')
  // 岗位：开发工程师
  await dialog.locator('.el-form-item', { hasText: '岗位' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: '开发工程师' }).first().click()
  await page.keyboard.press('Escape')
  // 角色：数据测试
  await dialog.locator('.el-form-item', { hasText: '角色' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: '数据测试' }).click()
  await page.keyboard.press('Escape')
  // 邮箱
  await dialog.getByPlaceholder(/请输入邮箱/).fill('s3@test.com')

  const submitResp = page.waitForResponse((r) => r.url().includes('/system/user/submit'))
  await dialog.getByRole('button', { name: '提交' }).click()
  expect((await submitResp).status(), '建档提交须 200').toBe(200)
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // 列表行展示部门/岗位/角色名
  const row = page.getByRole('row', { name: new RegExp(username) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('研发中心')).toBeVisible()
  await expect(row.getByText('开发工程师')).toBeVisible()
  await expect(row.getByText('数据测试')).toBeVisible()

  // 落库核对：dept_id/post_id/email + user_role
  const userId = psql(`SELECT id FROM sys_user WHERE username='${username}';`)
  expect(userId).not.toBe('')
  const org = psql(
    `SELECT dept_id || '|' || post_id || '|' || email FROM sys_user WHERE id=${userId};`
  )
  expect(org).toContain('|s3@test.com')
  const roleCnt = psql(
    `SELECT count(*) FROM sys_user_role WHERE user_id=${userId} AND is_deleted=0;`
  )
  expect(roleCnt).toBe('1')

  // 编辑弹窗回显：角色/部门已选（编辑图标带 bg-secondary 类）
  await row.locator('td').last().locator('[class*="bg-secondary"]').first().click()
  await expect(dialog.getByText('数据测试')).toBeVisible({ timeout: 10_000 })
  await expect(dialog.locator('.el-form-item', { hasText: '部门' })).toContainText('研发中心')
  await expect(dialog.locator('.el-form-item', { hasText: '岗位' })).toContainText('开发工程师')
  await dialog.getByRole('button', { name: '取消' }).click()

  // 清理
  psql(
    `DELETE FROM sys_user_role WHERE user_id=${userId}; DELETE FROM sys_user WHERE id=${userId};`
  )
})
