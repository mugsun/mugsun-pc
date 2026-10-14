/**
 * AI 助手抽屉的键盘焦点：
 * - 打开后焦点落在输入框（AiDrawerChat onMounted 里 senderRef.focus('end')）
 * - Tab 从输入框到模型 chip，chip 上有 :focus-visible 描边
 * - Esc 关闭后焦点回到触发按钮（AiDrawerHost @closed → fabRef.focus()）
 */
import { expect } from '@playwright/test'
import { test, mockAll, seedSession } from './support/session'

test('AI 抽屉：打开聚焦输入框，Tab 到 chip 有描边，Esc 回到触发按钮', async ({
  page,
  uiLang,
  uiTheme
}) => {
  await seedSession(page, uiLang, uiTheme)
  await mockAll(page)
  await page.goto('/#/dashboard/console')
  const fab = page.locator('.ai-fab')
  await expect(fab).toBeVisible({ timeout: 30_000 })
  await fab.click()
  const sender = page.locator('.ai-dchat__sender')
  await expect(sender).toBeVisible({ timeout: 30_000 })

  // 1. 打开后焦点在输入框（contenteditable 编辑区）
  await expect
    .poll(() =>
      page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null
        return !!a?.isContentEditable && !!a.closest('.ai-dchat__sender')
      })
    )
    .toBe(true)

  // 2. Tab 到第一个 chip（宽屏）或「设置」（窄屏），带 2px 描边
  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement
    const cs = getComputedStyle(a)
    return {
      inChips: !!a.closest('.ai-dchat__chips'),
      fv: a.matches(':focus-visible'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`
    }
  })
  expect(focused).toEqual({ inChips: true, fv: true, outline: 'solid 2px' })

  // 3. Esc 关闭，焦点回到触发按钮
  await page.keyboard.press('Escape')
  await expect(page.locator('.ai-dchat__sender')).toBeHidden()
  await expect(fab).toBeFocused()
})
