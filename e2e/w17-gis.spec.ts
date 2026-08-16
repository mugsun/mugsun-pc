import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * GIS 侧栏切页不得被示例页 query.code 监听拽回；工作台图层面板内点目录即可叠加。
 */

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

async function clickGisMenu(name: string): Promise<void> {
  await page.getByRole('complementary').first().getByRole('menuitem', { name, exact: true }).click()
}

test('W17-1 示例页侧栏可切到地图 / 图层 / 底图', async () => {
  await page.goto('/#/gis/lab?code=poi')
  await expect(page.getByRole('button', { name: '兴趣点' })).toBeVisible({ timeout: 15_000 })

  await clickGisMenu('地图')
  await expect(page).toHaveURL(/#\/gis\/workspace/)
  await expect(page.getByRole('button', { name: '保存场景' })).toBeVisible({ timeout: 15_000 })

  await clickGisMenu('图层')
  await expect(page).toHaveURL(/#\/gis\/layer/)
  await expect(page.getByRole('button', { name: '入库图层' })).toBeVisible({ timeout: 15_000 })

  await clickGisMenu('底图')
  await expect(page).toHaveURL(/#\/gis\/provider/)
  await expect(page.getByText('天地图')).toBeVisible({ timeout: 15_000 })

  await clickGisMenu('示例')
  await expect(page).toHaveURL(/#\/gis\/lab/)
  await expect(page.getByRole('button', { name: '兴趣点' })).toBeVisible({ timeout: 15_000 })
})

test('W17-2 工作台图层 HUD 点目录叠加，无弹窗表格', async () => {
  await page.goto('/#/gis/workspace')
  await expect(page.getByRole('button', { name: '保存场景' })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: '图层', exact: true }).click()
  await expect(page.getByText('叠加图层')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const catalog = page.locator('.gis-hud-panel .gis-feat-row').first()
  if ((await catalog.count()) > 0) {
    await catalog.click()
    await expect(page.locator('.gis-ov-card').first()).toBeVisible({ timeout: 10_000 })
    const slider = page.getByRole('slider')
    await expect(slider).toBeVisible()
    await slider.focus()
    await page.keyboard.press('Home')
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveAttribute('aria-valuenow', '1')

    const box = page.locator('.gis-ov-card .el-checkbox').first()
    await expect(box).toHaveClass(/is-checked/)
    await box.click()
    await expect(box).not.toHaveClass(/is-checked/)
    await box.click()
    await expect(box).toHaveClass(/is-checked/)
  }
})
