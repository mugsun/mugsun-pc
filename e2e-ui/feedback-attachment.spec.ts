/**
 * 反馈管理页的「附件」列（PC-019）：
 * - 带附件的反馈显示文件名，没带的显示「—」；不点不请求附件；
 * - 点图片附件：按反馈编号请求 /api/system/feedback/attachment/{id}，取到的图在页面里放大显示；
 * - 取不到（比如文件已删除）时只提示一次原因，不打开空的看图窗口。
 */
import { expect, type Page } from '@playwright/test'
import { test, mockAll, seedSession } from './support/session'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
const WITH_IMAGE = {
  id: '501',
  content: 'PC019 带截图的反馈',
  contact: '',
  attachId: '9101',
  attachName: 'pc019-shot.png',
  status: 0,
  createTime: '2026-01-01 09:00:00'
}
const WITHOUT = {
  id: '502',
  content: 'PC019 没带附件的反馈',
  contact: '',
  attachId: null,
  attachName: null,
  status: 0,
  createTime: '2026-01-01 09:01:00'
}
const OPEN_FAILED = { zh: '附件没有打开', en: 'Could not open the attachment' }

/** 模拟反馈列表和附件接口；返回附件接口被请求的路径 */
async function mockFeedback(page: Page, opts: { missing?: boolean } = {}) {
  const calls: string[] = []
  await mockAll(page)
  await page.route('**/api/system/feedback/page**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        msg: 'ok',
        data: { records: [WITH_IMAGE, WITHOUT], totalRow: 2 }
      })
    })
  )
  await page.route('**/api/system/feedback/attachment/**', (r) => {
    calls.push(new URL(r.request().url()).pathname)
    return opts.missing
      ? r.fulfill({ status: 404, contentType: 'text/html', body: '' })
      : r.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })
  return calls
}

async function openPage(page: Page) {
  await page.goto('/#/system/feedback')
  const row = page.locator('.el-table__row').filter({ hasText: WITH_IMAGE.content })
  await expect(row).toBeVisible({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  return row
}

test('反馈管理：附件列显示文件名，点开在页面里看图', async ({ page, uiLang, uiTheme }) => {
  await seedSession(page, uiLang, uiTheme)
  const calls = await mockFeedback(page)
  const row = await openPage(page)

  const link = row.getByRole('button', { name: WITH_IMAGE.attachName })
  await expect(link).toBeVisible()
  await expect(
    page.locator('.el-table__row').filter({ hasText: WITHOUT.content }).locator('.fb-attach-none')
  ).toHaveText('—')
  expect(calls).toEqual([])

  await link.click()
  const img = page.locator('.el-image-viewer__canvas img')
  await expect(img).toBeVisible()
  await expect(img).toHaveAttribute('src', /^blob:/)
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0)
  expect(calls).toEqual([`/api/system/feedback/attachment/${WITH_IMAGE.id}`])
  await expect(page.locator('.el-message--error')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(page.locator('.el-image-viewer__wrapper')).toHaveCount(0)
})

test('反馈管理：附件取不到时只提示一次原因，不打开看图窗口', async ({ page, uiLang, uiTheme }) => {
  await seedSession(page, uiLang, uiTheme)
  const calls = await mockFeedback(page, { missing: true })
  const row = await openPage(page)

  await row.getByRole('button', { name: WITH_IMAGE.attachName }).click()
  const error = page.locator('.el-message--error')
  await expect(error).toContainText(OPEN_FAILED[uiLang])
  await expect(error).toHaveCount(1)
  await expect(page.locator('.el-image-viewer__wrapper')).toHaveCount(0)
  expect(calls).toEqual([`/api/system/feedback/attachment/${WITH_IMAGE.id}`])
})
