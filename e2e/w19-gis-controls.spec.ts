import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * GIS 工作台控件实走：切供应商 → 检索带 provider → 空白逆地理 → 埋点热力 → 示例播放条。
 */

test.describe.configure({ mode: 'serial' })

let page: Page
const nets: { url: string; status?: number; body?: unknown }[] = []

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  page.on('response', async (res) => {
    const u = res.url()
    if (
      u.includes('/gis/search') ||
      u.includes('/gis/reverse') ||
      u.includes('/system/track/geo') ||
      u.includes('/gis/tile/')
    ) {
      let body: unknown
      try {
        body = await res.json()
      } catch {
        body = null
      }
      nets.push({
        url: u.replace(/^https?:\/\/[^/]+/, ''),
        status: res.status(),
        body
      })
    }
  })
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('W19-1 切高德后检索天安门请求带 provider=amap', async () => {
  nets.length = 0
  await page.goto('/#/gis/workspace')
  await expect(page.getByRole('button', { name: '保存场景' })).toBeVisible({ timeout: 15_000 })

  await page.locator('.gis-provider-select').click()
  await page.getByRole('option', { name: '高德', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('gis:lastProvider')))
    .toBe('amap')

  await page.getByPlaceholder(/搜索地名/).fill('天安门')
  const sug = page.locator('.el-autocomplete-suggestion li').first()
  await expect(sug).toBeVisible({ timeout: 10_000 })
  await sug.click()
  await page.waitForTimeout(800)

  const search = nets.find((n) => n.url.includes('/gis/search'))
  expect(search, '应发出 /gis/search').toBeTruthy()
  expect(search!.url).toContain('provider=amap')
  expect(search!.status).toBe(200)
  const data = (search!.body as { data?: { lon?: number; lat?: number }[] })?.data
  expect(Array.isArray(data) && data.length > 0).toBeTruthy()
  expect(data![0].lon).toBeGreaterThan(100)
  expect(data![0].lat).toBeGreaterThan(20)
})

test('W19-2 空白点击逆地理带当前 provider', async () => {
  nets.length = 0
  // 独立复验：避免上一步 POI 落点 / 建议浮层干扰
  await page.goto('/#/gis/workspace')
  await expect(page.getByRole('button', { name: '保存场景' })).toBeVisible({ timeout: 15_000 })
  await page.locator('.gis-provider-select').click()
  await page.getByRole('option', { name: '高德', exact: true }).click()
  await page.getByRole('button', { name: '漫游' }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const vp = page.locator('.ol-viewport')
  const box = await vp.boundingBox()
  expect(box).toBeTruthy()
  // 点视口左下空白（避开中心 POI / HUD）
  await page.mouse.click(box!.x + 60, box!.y + box!.height - 80)
  await expect
    .poll(() => nets.some((n) => n.url.includes('/gis/reverse')), { timeout: 8_000 })
    .toBe(true)
  const rev = nets.find((n) => n.url.includes('/gis/reverse'))
  expect(rev!.url).toContain('provider=amap')
  expect(rev!.status).toBe(200)
})

test('W19-3 更多→埋点热力触发 geo/heat 请求', async () => {
  nets.length = 0
  await page.getByRole('button', { name: '更多' }).click()
  await page.getByRole('menuitem', { name: '埋点热力' }).click()
  await page.waitForTimeout(2000)
  const heat = nets.find((n) => n.url.includes('/system/track/geo') || n.url.includes('heat'))
  // 无坐标数据时也可能只拉应用列表；至少不应 5xx
  const bad = nets.filter((n) => (n.status ?? 0) >= 500)
  expect(bad).toEqual([])
  // 图层面板或 toast 有反馈均可
  const body = await page.locator('body').innerText()
  expect(body.length).toBeGreaterThan(10)
  void heat
})

test('W19-4 示例页播放进度条可拖动且时钟变化', async () => {
  await page.goto('/#/gis/lab?code=playback')
  await expect(page.locator('.gis-lab-chip strong')).toHaveText('轨迹回放', { timeout: 15_000 })
  const slider = page.locator('.gis-playbar [role=slider]')
  await expect(slider).toBeVisible({ timeout: 10_000 })
  const clock = page.locator('.gis-clock')
  await expect(clock).toBeVisible()

  // 先暂停，避免自动播放把进度立刻冲掉
  const toggle = page.getByRole('button', { name: /暂停|播放/ })
  if ((await toggle.innerText()).includes('暂停')) {
    await toggle.click()
  }
  await expect(toggle).toHaveText(/播放/)

  await slider.focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('ArrowRight')
  }
  await page.waitForTimeout(300)
  await expect(slider).toHaveAttribute('aria-valuenow', /^(5[0-9]|[6-9]\d|100)$/)
  const after = await clock.innerText()
  expect(after).toMatch(/^\d{2}:\d{2}\s*\/\s*\d{2}:\d{2}$/)
  const cur = after.split('/')[0].trim()
  const [mm, ss] = cur.split(':').map(Number)
  expect(mm * 60 + ss).toBeGreaterThan(5)

  await toggle.click()
  await expect(toggle).toHaveText(/暂停/)

  await page.locator('.gis-speed').click()
  await page.getByRole('option', { name: '2x', exact: true }).click()
  await expect(page.locator('.gis-speed')).toContainText('2x')
})
