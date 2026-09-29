import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W2-S2 角色/系统字典/业务字典搜索栏验证：条件真实过滤 + 重置还原。
 * 数据依据：角色种子 超级管理员/普通用户（DataInitializer，租户 000000）；
 * 系统字典种子 用户状态(user_status)/登录结果(login_result)（V21/V38 迁移）；
 * 业务字典无种子，用例内经 UI 建数、psql 清理。
 */

function psql(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('W2-S2 角色页搜索栏：名称/编码过滤与重置', async () => {
  await page.goto('/#/system/role')
  // 等表格首屏数据
  await expect(page.getByRole('row', { name: /超级管理员/ }).first()).toBeVisible({
    timeout: 10_000
  })

  // 角色名称过滤：超级管理员 → 该行在、普通用户行不在
  const nameInput = page.getByPlaceholder('请输入角色名称')
  await nameInput.fill('超级管理员')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /普通用户/ })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('row', { name: /超级管理员/ }).first()).toBeVisible()

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: /普通用户/ }).first()).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveValue('')

  // 角色编码过滤：admin → 超级管理员在、普通用户不在
  await page.getByPlaceholder('请输入角色编码').fill('admin')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /普通用户/ })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('row', { name: /超级管理员/ }).first()).toBeVisible()

  // 重置还原
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: /普通用户/ }).first()).toBeVisible({ timeout: 10_000 })
})

test('W2-S2 字典页搜索栏：名称/编码过滤与重置', async () => {
  await page.goto('/#/system/dict')
  // 等树表首屏数据（种子：用户状态/登录结果）
  await expect(page.getByRole('row', { name: /用户状态/ }).first()).toBeVisible({ timeout: 10_000 })

  // 名称过滤：用户状态 → 登录结果行不在；命中类型的子项须带出（亲属回填）
  const nameInput = page.getByPlaceholder('请输入字典名称')
  await nameInput.fill('用户状态')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /登录结果/ })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('row', { name: /用户状态/ }).first()).toBeVisible()
  await expect(page.getByRole('row', { name: /正常/ }).first()).toBeVisible()

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: /登录结果/ }).first()).toBeVisible({ timeout: 10_000 })
  await expect(nameInput).toHaveValue('')

  // 编码过滤：login_result → 用户状态行不在；子项 成功/失败 带出
  await page.getByPlaceholder('请输入字典编码').fill('login_result')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /用户状态/ })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByRole('row', { name: /登录结果/ }).first()).toBeVisible()
  await expect(page.getByRole('row', { name: /成功/ }).first()).toBeVisible()

  // 重置还原
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: /用户状态/ }).first()).toBeVisible({ timeout: 10_000 })
})

test('W2-S2 业务字典页搜索栏：建数→过滤→重置→还原', async () => {
  const stamp = Date.now() % 100000
  const nameA = `W2业务字典A${stamp}`
  const nameB = `W2业务字典B${stamp}`
  await page.goto('/#/system/dict-biz')
  // 业务字典无种子：等工具栏就绪即可（字典/业务字典同组件双实例驻留 DOM，全部按可见性定位）
  const addBtn = page.getByRole('button', { name: '新增字典' }).filter({ visible: true })
  await expect(addBtn).toBeVisible({ timeout: 10_000 })

  // 经 UI 建两个顶级业务字典（真实落库，防依赖不存在的数据）
  const addDict = async (name: string, code: string): Promise<void> => {
    // 弹窗打开后会异步拉取上级选项并重渲染（按钮会瞬态脱离 DOM，点击可能落空），
    // 轮询重试点击直至弹窗真正可见，再进入填表
    const optionsResp = page
      .waitForResponse((r) => r.url().includes('/system/dict-biz/tree'), { timeout: 10_000 })
      .catch(() => null)
    const dialog = page.locator('.el-dialog:visible')
    await expect(async () => {
      await page.getByRole('button', { name: '新增字典' }).filter({ visible: true }).click()
      await expect(dialog).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await optionsResp
    await dialog.getByPlaceholder('如 sex').fill(code)
    await dialog.getByPlaceholder('如 男').fill(name)
    const submitResp = page.waitForResponse((r) => r.url().includes('/system/dict-biz/submit'))
    await dialog.getByRole('button', { name: '提交' }).click()
    expect((await submitResp).status(), '字典提交须 200').toBe(200)
    await expect(dialog).toBeHidden({ timeout: 10_000 })
  }
  await addDict(nameA, `w2_biz_a_${stamp}`)
  await addDict(nameB, `w2_biz_b_${stamp}`)
  const bizRows = page.getByRole('row').filter({ visible: true })
  await expect(bizRows.filter({ hasText: nameA }).first()).toBeVisible({
    timeout: 10_000
  })
  await expect(bizRows.filter({ hasText: nameB }).first()).toBeVisible()

  // 名称过滤：A 在、B 不在
  const nameInput = page.getByPlaceholder('请输入字典名称').filter({ visible: true })
  await nameInput.fill(nameA)
  await page.getByRole('button', { name: '查询' }).filter({ visible: true }).click()
  await expect(bizRows.filter({ hasText: nameB })).toHaveCount(0, {
    timeout: 10_000
  })
  await expect(bizRows.filter({ hasText: nameA }).first()).toBeVisible()

  // 重置：条件清空、A/B 都回来
  await page.getByRole('button', { name: '重置' }).filter({ visible: true }).click()
  await expect(bizRows.filter({ hasText: nameB }).first()).toBeVisible({
    timeout: 10_000
  })
  await expect(nameInput).toHaveValue('')

  // 清理（物理删，防测试数据膨胀）
  psql(`DELETE FROM sys_dict_biz WHERE code LIKE 'w2_biz_%_${stamp}';`)
})
