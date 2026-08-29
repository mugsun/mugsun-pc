import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * 入库图层的拓扑闸门在界面上的表现：脏几何要么被拒收并留住用户已填的数据，
 * 要么修好并如实告知改了什么。历史事故是越界坐标被静默丢弃——用户以为存进去了，
 * 直到查询结果对不上才发现，所以这里连「提示文案有没有真弹出来」一起锁住。
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

/** 打开入库弹窗并填好名称与数据 */
async function fillIngest(name: string, payload: string): Promise<void> {
  await page.goto('/#/gis/layer')
  await page.getByRole('button', { name: '入库图层' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  await dialog.getByRole('textbox').first().fill(name)
  await dialog.locator('textarea').fill(payload)
}

async function save(): Promise<void> {
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
}

test('W20-1 坐标越界被拒收，弹窗不关、已填数据不丢', async () => {
  const payload = '[{"lon":116.3975,"lat":39.9087},{"lon":12958065,"lat":4852834}]'
  await fillIngest('E2E拓扑-越界', payload)
  await save()

  await expect(page.locator('.el-message').filter({ hasText: '坐标越界' })).toBeVisible({
    timeout: 15_000
  })
  // 拒收后必须让用户能就地改：弹窗留着，输入还在
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('textarea')).toHaveValue(payload)

  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(page.getByText('E2E拓扑-越界')).toHaveCount(0)
})

test('W20-2 退化几何被拒收（线只有一个位置）', async () => {
  await fillIngest(
    'E2E拓扑-退化',
    JSON.stringify({
      type: 'Feature',
      properties: { name: '退化线' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [116.39, 39.9],
          [116.39, 39.9]
        ]
      }
    })
  )
  await save()

  await expect(page.locator('.el-message').filter({ hasText: '两个不同的点' })).toBeVisible({
    timeout: 15_000
  })
  await page.getByRole('dialog').getByRole('button', { name: '取消' }).click()
})

test('W20-3 自相交的面修复后入库，并告知用户改了什么', async () => {
  const name = `E2E拓扑-自相交-${Date.now()}`
  // 蝴蝶结：对角相连，中间交叉一次，是手绘标绘与轨迹转面的常见产物
  await fillIngest(
    name,
    JSON.stringify({
      type: 'Feature',
      properties: { name: '蝴蝶结' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [116.39, 39.9],
            [116.41, 39.92],
            [116.41, 39.9],
            [116.39, 39.92],
            [116.39, 39.9]
          ]
        ]
      }
    })
  )
  await save()

  const fixedToast = page.locator('.el-message').filter({ hasText: '几何被修复' })
  await expect(fixedToast).toBeVisible({ timeout: 15_000 })
  await expect(fixedToast).toContainText('自相交')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // 修好的图层要真进列表，而不是只弹个提示
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 })
})
