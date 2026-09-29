import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W14 工作流专属：设计→部署→发起→待办通过→审批中心可见。
 * 候选「发起人本人」保证超管自审可办（引擎对发起人==审批人会追加超管，仍可闭环）。
 */

function psql(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

test.describe.configure({ mode: 'serial' })

let page: Page
const flowCode = `e2ef${Date.now() % 100000}`
const flowName = `E2E流程${Date.now() % 100000}`
let businessId = ''

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('W14-1 设计并部署：发起人本人候选', async () => {
  await page.goto('/#/system/flow-def')
  await expect(page.getByRole('button', { name: '设计流程' })).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: '设计流程' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('流程设计器')).toBeVisible()

  await dialog.getByPlaceholder('英文标识，如 purchase').fill(flowCode)
  await dialog.getByPlaceholder('如 采购审批').fill(flowName)

  // 默认节点候选人：角色 → 改为发起人本人（无需再选值）
  await dialog.locator('.cand-type').first().click()
  await page.getByRole('option', { name: '发起人本人' }).click()

  const deployResp = page.waitForResponse(
    (r) => r.url().includes('/system/flow/design') && r.request().method() === 'POST'
  )
  await dialog.getByRole('button', { name: '部署流程' }).click()
  expect((await deployResp).status()).toBe(200)
  await expect(dialog).toBeHidden({ timeout: 10_000 })
  await expect(page.getByRole('row', { name: new RegExp(flowCode) }).first()).toBeVisible({
    timeout: 10_000
  })
})

test('W14-2 发起后进入待办并可办理通过', async () => {
  await page.goto('/#/system/flow-def')
  const row = page.getByRole('row', { name: new RegExp(flowCode) }).first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByRole('button', { name: '发起' }).click()

  const startDialog = page.getByRole('dialog')
  await expect(startDialog.getByRole('heading', { name: /发起/ })).toBeVisible()
  businessId = await startDialog
    .locator('.el-form-item', { hasText: '业务单号' })
    .locator('input')
    .inputValue()
  expect(businessId.length).toBeGreaterThan(0)

  const startResp = page.waitForResponse(
    (r) => r.url().includes('/system/flow/start') && r.request().method() === 'POST'
  )
  await startDialog.getByRole('button', { name: '发起', exact: true }).click()
  expect((await startResp).status()).toBe(200)
  await expect(startDialog).toBeHidden({ timeout: 10_000 })

  await page.goto('/#/system/flow-todo')
  await expect(page.getByRole('button', { name: '刷新' })).toBeVisible({ timeout: 10_000 })
  const todoRow = page.getByRole('row', { name: new RegExp(businessId) }).first()
  await expect(todoRow).toBeVisible({ timeout: 10_000 })

  const handleResp = page.waitForResponse(
    (r) => r.url().includes('/system/flow/task/handle/') && r.request().method() === 'POST'
  )
  await todoRow.getByRole('button', { name: '通过' }).click()
  const passDialog = page.getByRole('dialog')
  await expect(passDialog.getByRole('heading')).toBeVisible()
  await passDialog.getByRole('button', { name: '确定' }).click()
  expect((await handleResp).status()).toBe(200)
  await expect(page.getByRole('row', { name: new RegExp(businessId) })).toHaveCount(0, {
    timeout: 10_000
  })
})

test('W14-3 审批中心·我发起可见办结实例', async () => {
  await page.goto('/#/system/flow-center')
  const root = page.locator('.flow-center-page')
  await expect(root.getByRole('tab', { name: '我发起' })).toBeVisible({ timeout: 10_000 })
  await root.getByRole('tab', { name: '我发起' }).click()
  await expect(root.getByRole('row', { name: new RegExp(businessId) }).first()).toBeVisible({
    timeout: 10_000
  })
  const status = psql(
    `SELECT flow_status FROM flow_instance WHERE business_id = '${businessId}' LIMIT 1`
  )
  expect(status, '办结后实例状态应为已完成(8)').toMatch(/8/)
})
