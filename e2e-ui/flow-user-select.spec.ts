/**
 * 待办工作台、审批中心的选人框（PC-012）：
 * - 打开页面不请求用户管理的选人接口 /api/system/user/select。普通员工没有那个权限，
 *   以前一进页面就弹「没有访问权限」，转办时也选不到人；
 * - 点转办时才按这条待办请求 /api/system/flow/task/user-select，候选人能选上；
 * - 接口拒绝时，原因显示在选人框下方，不弹全局提示。
 */
import { expect, type Page } from '@playwright/test'
import { test, mockAll, seedSession } from './support/session'

const TASK = {
  taskId: '9001',
  instanceId: '8001',
  businessId: 'PC012-0001',
  flowName: 'mock-flow',
  nodeName: 'mock-node',
  flowStatus: '1',
  createTime: '2026-01-01 09:00:00'
}
const CANDIDATE = { value: '7', label: '张三（zhangsan）' }
const DENIED = '只有这条待办的办理人可以选人。请刷新列表，确认它还在你的待办里'
const TRANSFER = { zh: '转办', en: 'Transfer' }

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

/** 模拟一个手上有一条待办、但没有用户管理权限的员工；返回两个选人接口被请求的情况 */
async function mockFlow(page: Page, opts: { deny?: boolean } = {}) {
  const calls = { userSelect: 0, taskUserSelect: [] as string[] }
  await mockAll(page)
  await page.route('**/api/system/flow/my-todo**', (r) =>
    r.fulfill(json({ code: 200, msg: 'ok', data: [TASK] }))
  )
  await page.route('**/api/system/user/select**', (r) => {
    calls.userSelect++
    return r.fulfill(json({ code: 403, msg: '没有访问权限' }, 403))
  })
  await page.route('**/api/system/flow/task/user-select**', (r) => {
    calls.taskUserSelect.push(new URL(r.request().url()).search)
    return r.fulfill(
      opts.deny
        ? json({ code: 500, msg: DENIED })
        : json({ code: 200, msg: 'ok', data: [CANDIDATE] })
    )
  })
  return calls
}

async function openTodo(page: Page, route: string) {
  await page.goto(route)
  await expect(page.getByText(TASK.businessId).first()).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
}

/** 在待办工作台第一行点「更多 → 转办」，返回打开的弹窗 */
async function openTransfer(page: Page, uiLang: 'zh' | 'en') {
  await page.locator('.flow-more button').first().hover()
  await page
    .locator('.el-dropdown-menu__item')
    .filter({ hasText: new RegExp(`^\\s*${TRANSFER[uiLang]}\\s*$`) })
    .click()
  const dialog = page.locator('.el-dialog').filter({ has: page.locator('.el-select') })
  await expect(dialog).toBeVisible()
  return dialog
}

test('待办工作台：打开页面不取用户列表，点转办才按这条待办取候选人', async ({
  page,
  uiLang,
  uiTheme
}) => {
  await seedSession(page, uiLang, uiTheme)
  const calls = await mockFlow(page)
  await openTodo(page, '/#/system/flow-todo')
  expect(calls.userSelect).toBe(0)
  expect(calls.taskUserSelect).toEqual([])
  await expect(page.locator('.el-message--error')).toHaveCount(0)

  const dialog = await openTransfer(page, uiLang)
  await expect.poll(() => calls.taskUserSelect).toEqual([`?taskId=${TASK.taskId}`])
  await dialog.locator('.el-select').click()
  const option = page.locator('.el-select-dropdown__item').filter({ hasText: CANDIDATE.label })
  await expect(option).toBeVisible()
  await option.click()
  await expect(dialog.locator('.el-select')).toContainText(CANDIDATE.label)
  await expect(dialog.locator('.el-form-item__error')).toHaveCount(0)

  expect(calls.userSelect).toBe(0)
  await expect(page.locator('.el-message--error')).toHaveCount(0)
})

test('待办工作台：取不到候选人时，原因显示在选人框下方，不弹全局提示', async ({
  page,
  uiLang,
  uiTheme
}) => {
  await seedSession(page, uiLang, uiTheme)
  const calls = await mockFlow(page, { deny: true })
  await openTodo(page, '/#/system/flow-todo')

  const dialog = await openTransfer(page, uiLang)
  await expect(dialog.locator('.el-form-item__error')).toHaveText(DENIED)
  expect(calls.userSelect).toBe(0)
  await expect(page.locator('.el-message--error')).toHaveCount(0)
})

test('审批中心：打开页面不取用户列表，没有错误提示', async ({ page, uiLang, uiTheme }) => {
  await seedSession(page, uiLang, uiTheme)
  const calls = await mockFlow(page)
  await openTodo(page, '/#/system/flow-center')

  expect(calls.userSelect).toBe(0)
  expect(calls.taskUserSelect).toEqual([])
  await expect(page.locator('.el-message--error')).toHaveCount(0)
})
