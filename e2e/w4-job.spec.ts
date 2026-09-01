import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * W4 定时任务真可用：处理器注册表 / jobParams / 真实处理器端到端。
 * 修复前：所有任务空转 DemoProcessor、UI 无法选处理器/传参。
 */

function redis(...args: string[]): string {
  return execSync(`docker exec blade-redis redis-cli -n 3 ${args.join(' ')}`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page
/** 任务名逐轮唯一：PowerJob 软删仍留在列表，固定名会撞 strict mode */
const JOB_NAME = `W4缓存清理验证${Date.now() % 100000}`

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  // W4-3 末尾走 UI 删除；这里兜底，避免断言失败时任务残留在 PowerJob 列表
  try {
    await page.goto('/#/system/job')
    const root = page.locator('.job-page')
    const rows = root.getByRole('row', { name: new RegExp(JOB_NAME) })
    const n = await rows.count()
    for (let i = 0; i < n; i++) {
      const row = rows.first()
      if (!(await row.isVisible().catch(() => false))) break
      await row.getByText('删除').click()
      await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
      await page.waitForTimeout(400)
    }
  } catch {
    /* 页面已关时不阻断收尾 */
  }
  await page?.close()
})

test('W4-1 处理器注册表：新建任务可选全部已注册处理器', async () => {
  await page.goto('/#/system/job')
  await expect(page.getByRole('button', { name: '新建任务' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: '新建任务' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('处理器', { exact: true })).toBeVisible()
  await dialog.locator('.el-form-item', { hasText: '处理器' }).locator('.el-select').first().click()
  // 注册表含两个真实处理器与演示处理器
  for (const name of ['LogCleanProcessor', 'CacheEvictProcessor', 'DemoProcessor']) {
    await expect(page.getByRole('option', { name })).toBeVisible({ timeout: 5_000 })
  }
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: '取消' }).click()
})

test('W4-2 不选处理器提交被拦（前端必填 + 后端校验）', async () => {
  await page.goto('/#/system/job')
  await page.getByRole('button', { name: '新建任务' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('请输入任务名称').fill('W4校验任务')
  await dialog.getByRole('button', { name: '提交' }).click()
  // 前端必填提示
  await expect(dialog.getByText('请选择处理器')).toBeVisible({ timeout: 5_000 })
  await dialog.getByRole('button', { name: '取消' }).click()
})

test('W4-3 缓存清理处理器：建任务→带参执行→真实清键→日志可见', async () => {
  // 前置：造两个 mugsun:dict 键（处理器目标分组）
  redis('SET', 'mugsun:dict:e2e_w4_a', '1')
  redis('SET', 'mugsun:dict:e2e_w4_b', '1')
  expect(redis('KEYS', 'mugsun:dict:e2e_w4_*').length).toBeGreaterThan(0)

  await page.goto('/#/system/job')
  await page.getByRole('button', { name: '新建任务' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('请输入任务名称').fill(JOB_NAME)
  await dialog.locator('.el-form-item', { hasText: '处理器' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: 'CacheEvictProcessor' }).click()
  await dialog.getByPlaceholder(/jobParams/).fill('mugsun:dict')
  const saveResp = page.waitForResponse((r) => r.url().includes('/system/job/save'))
  await dialog.getByRole('button', { name: '提交' }).click()
  expect((await saveResp).status()).toBe(200)
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // 列表行：处理器/参数/下次触发列齐全
  const row = page.getByRole('row', { name: new RegExp(JOB_NAME) }).first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('CacheEvictProcessor')).toBeVisible()
  await expect(row.getByText('mugsun:dict')).toBeVisible()

  // 立即执行 → 等实例出结果
  await row.getByText('立即执行').click()
  await expect(page.getByText(/已触发/)).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(4000)

  // 真实清键核验
  expect(redis('KEYS', 'mugsun:dict:e2e_w4_*'), '处理器应真实删除目标键').toBe('')

  // 执行日志：实例成功 + 结果含清理摘要
  await row.getByText('日志').click()
  const logDialog = page.getByRole('dialog')
  await expect(logDialog.getByText('成功').first()).toBeVisible({ timeout: 10_000 })
  await expect(logDialog.getByText(/缓存分组 mugsun:dict 已清理/)).toBeVisible()
  await page.keyboard.press('Escape')

  // 清理任务本身
  await row.getByText('删除').click()
  await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
  await expect(row).toHaveCount(0, { timeout: 10_000 })
})
