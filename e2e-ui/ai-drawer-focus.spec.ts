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

/**
 * 抽屉 chunk 加载中 / 加载失败时 48px 顶栏仍在，关闭按钮可用，关闭后焦点回到触发按钮。
 * 拦截 AiDrawerChat 的 chunk：加载中 = 一直不响应，加载失败 = abort。
 */
for (const mode of ['loading', 'error'] as const) {
  test(`AI 抽屉：${mode === 'loading' ? '加载中' : '加载失败'}也能关闭，焦点回到触发按钮`, async ({
    page,
    uiLang,
    uiTheme
  }) => {
    await seedSession(page, uiLang, uiTheme)
    await mockAll(page)
    await page.route(/AiDrawerChat(\.vue|-[\w-]+\.js)/, (route) =>
      mode === 'error' ? route.abort() : new Promise<void>(() => {})
    )
    await page.goto('/#/dashboard/console')
    const fab = page.locator('.ai-fab')
    await expect(fab).toBeVisible({ timeout: 30_000 })
    await fab.click()
    const close = page.getByTestId('ai-drawer-close')
    await expect(close).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.ai-dshell__hd')).toHaveAttribute('data-state', mode, {
      timeout: 30_000
    })
    if (mode === 'loading') {
      // 顶栏先出，加载提示 200ms 后才出现
      await expect(page.locator('.ai-drawer__state[role="status"]')).toBeVisible()
    }
    const hd = await page.locator('.ai-dshell__hd').boundingBox()
    expect(hd?.height).toBe(48)
    if (mode === 'error') {
      await expect(page.locator('.ai-drawer__state.is-error .el-button')).toHaveCount(1)
    }
    if (uiTheme === 'light') {
      // 键盘聚焦关闭按钮：有 2px 描边
      await close.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      const o = await close.evaluate((e) => {
        const cs = getComputedStyle(e)
        return `${cs.outlineStyle} ${cs.outlineWidth}`
      })
      expect(o).toBe('solid 2px')
    }
    await close.click()
    await expect(page.locator('.ai-dshell__hd')).toBeHidden()
    await expect(fab).toBeFocused()
  })
}
