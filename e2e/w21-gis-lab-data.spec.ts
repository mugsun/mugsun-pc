import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * 示例中心新增能力实走：栅格叠加（显隐 / 透明度）、空间运算（切算子）、
 * 多格式入站（WKT / CSV / KML / GPX 解析）、三维切片（tileset 拉取 + 画布起来）。
 * 前三条都要核对「控件改了 → 接口或渲染跟着变」，不只看页面能打开。
 */

test.describe.configure({ mode: 'serial' })

let page: Page
const nets: { url: string; status?: number; body?: unknown }[] = []

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  page.on('response', async (res) => {
    const u = res.url()
    if (
      u.includes('/gis/geo/analyze') ||
      u.includes('/gis/layer/ingest') ||
      u.includes('/gis/tile/') ||
      u.includes('/gis/tileset/')
    ) {
      let body: unknown
      try {
        body = await res.json()
      } catch {
        body = null
      }
      nets.push({ url: u.replace(/^https?:\/\/[^/]+/, ''), status: res.status(), body })
    }
  })
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

const openDemo = async (code: string, title: string): Promise<void> => {
  nets.length = 0
  await page.goto(`/#/gis/lab?code=${code}`)
  await expect(page.locator('.gis-lab-chip strong')).toHaveText(title, { timeout: 20_000 })
}

test('W21-1 示例目录含数据接入分组与新示例', async () => {
  await openDemo('poi', '兴趣点')
  const nav = page.locator('.gis-lab-nav')
  await expect(nav).toContainText('数据接入')
  await expect(nav).toContainText('栅格叠加')
  await expect(nav).toContainText('多格式入站')
  await expect(nav).toContainText('空间运算')
  // track 已从目录清掉：不该出现点不到的死条目
  await expect(nav.locator('.gis-lab-item')).toHaveCount(13)
})

test('W21-2 栅格示例：叠层拉瓦片，透明度与显隐真生效', async () => {
  await openDemo('raster', '栅格叠加')
  const bar = page.locator('[data-test=lab-raster-bar]')
  await expect(bar).toBeVisible()

  await expect
    .poll(() => nets.some((n) => n.url.includes('/gis/tile/')), { timeout: 15_000 })
    .toBe(true)
  const bad = nets.filter((n) => (n.status ?? 0) >= 500)
  expect(bad, '瓦片代理不应 5xx').toEqual([])

  // OpenLayers 的透明度走 canvas 合成（globalAlpha），DOM 上看不出来，只能比渲染结果
  const viewport = page.locator('.ol-viewport')
  /** 等瓦片画完：连续两帧一致才算稳，避免把加载中的差异当成控件生效 */
  const shoot = async (): Promise<Buffer> => {
    let prev = await viewport.screenshot()
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(900)
      const cur = await viewport.screenshot()
      if (cur.equals(prev)) {
        return cur
      }
      prev = cur
    }
    throw new Error('地图渲染一直不稳定，无法判断控件是否生效')
  }

  const full = await shoot()

  const slider = bar.locator('[role=slider]')
  await slider.focus()
  await page.keyboard.press('Home')
  await expect(page.locator('[data-test=lab-raster-opacity]')).toHaveText('10%')
  const faded = await shoot()
  expect(faded.equals(full), '调到 10% 后地图渲染应变化').toBeFalsy()

  await slider.focus()
  await page.keyboard.press('End')
  await expect(page.locator('[data-test=lab-raster-opacity]')).toHaveText('100%')
  const back = await shoot()
  expect(back.equals(faded), '调回 100% 后地图渲染应再变').toBeFalsy()

  // 关掉叠层：渲染要变，开关状态不许弹回
  const sw = bar.locator('.el-switch')
  await sw.click()
  await expect(sw).not.toHaveClass(/is-checked/)
  const off = await shoot()
  expect(off.equals(back), '关掉叠层后地图渲染应变化').toBeFalsy()

  await sw.click()
  await expect(sw).toHaveClass(/is-checked/)
  const on = await shoot()
  expect(on.equals(off), '重新打开叠层后地图渲染应再变').toBeFalsy()
})

test('W21-3 空间运算示例：切算子发 analyze，指标随之变化', async () => {
  await openDemo('ops', '空间运算')
  const metrics = page.locator('[data-test=lab-ops-metrics]')
  await expect(metrics).toContainText('相交', { timeout: 15_000 })
  const first = await metrics.innerText()

  const analyze = nets.filter((n) => n.url.includes('/gis/geo/analyze'))
  expect(analyze.length, '进页面即应跑一次运算').toBeGreaterThan(0)
  expect(analyze[0].status).toBe(200)

  nets.length = 0
  await page.locator('.gis-ops-select').click()
  await page.getByRole('option', { name: '融合', exact: true }).click()
  await expect
    .poll(() => nets.filter((n) => n.url.includes('/gis/geo/analyze')).length, { timeout: 15_000 })
    .toBeGreaterThan(0)
  const union = nets.find((n) => n.url.includes('/gis/geo/analyze'))
  expect(union!.status).toBe(200)
  const unionBody = union!.body as { data?: { op?: string; collection?: { count?: number } } }
  expect(unionBody.data?.op).toBe('union')
  expect(unionBody.data?.collection?.count).toBeGreaterThan(0)
  await expect(metrics).not.toHaveText(first)

  nets.length = 0
  await page.locator('.gis-ops-select').click()
  await page.getByRole('option', { name: '距离', exact: true }).click()
  await expect
    .poll(() => nets.filter((n) => n.url.includes('/gis/geo/analyze')).length, { timeout: 15_000 })
    .toBeGreaterThan(0)
  const dist = nets.find((n) => n.url.includes('/gis/geo/analyze'))
  expect((dist!.body as { data?: { op?: string } }).data?.op).toBe('distance')
  await expect(metrics).toContainText('距离', { timeout: 10_000 })
})

test('W21-4 多格式入站示例：四种原文都能解析出要素', async () => {
  await openDemo('ingest', '多格式入站')
  const bar = page.locator('[data-test=lab-ingest-bar]')
  await expect(bar).toBeVisible()
  const count = page.locator('[data-test=lab-ingest-count]')

  for (const label of ['WKT', 'CSV', 'KML', 'GPX']) {
    nets.length = 0
    const pick = bar.locator('.el-radio-button', {
      has: page.locator('.el-radio-button__inner', { hasText: new RegExp(`^${label}$`) })
    })
    await pick.locator('.el-radio-button__inner').click()
    await expect(pick, `${label} 选中态不应弹回`).toHaveClass(/is-active/)
    const text = await bar.locator('textarea').inputValue()
    expect(text.trim().length, `${label} 示例原文不应为空`).toBeGreaterThan(10)

    await bar.getByRole('button', { name: '解析' }).click()
    await expect
      .poll(() => nets.filter((n) => n.url.includes('/gis/layer/ingest')).length, {
        timeout: 15_000
      })
      .toBeGreaterThan(0)
    const call = nets.find((n) => n.url.includes('/gis/layer/ingest'))
    expect(call!.status, `${label} 解析不应报错`).toBe(200)
    const parsed = call!.body as { code?: number; msg?: string; data?: { count?: number } }
    expect(parsed.code, `${label} 业务码应为 200，实际返回 ${JSON.stringify(parsed)}`).toBe(200)
    expect(parsed.data?.count, `${label} 应解析出要素`).toBeGreaterThan(0)
    await expect(count).toContainText(/\d/, { timeout: 10_000 })
  }
})

test('W21-5 三维切片示例：拉到 tileset.json 且 Cesium 画布起来', async () => {
  await openDemo('tiles3d', '三维切片')
  await expect
    .poll(() => nets.some((n) => n.url.includes('/gis/tileset/demo-city/tileset.json')), {
      timeout: 30_000
    })
    .toBe(true)
  const manifest = nets.find((n) => n.url.includes('tileset.json'))
  expect(manifest!.status).toBe(200)

  const canvas = page.locator('canvas.cesium-widget-credits, .cesium-widget canvas, canvas')
  await expect(canvas.first()).toBeVisible({ timeout: 30_000 })
  const size = await page.evaluate(() => {
    const c = document.querySelector('.cesium-widget canvas') as HTMLCanvasElement | null
    return c ? { w: c.width, h: c.height } : null
  })
  expect(size, 'Cesium 画布应存在').toBeTruthy()
  expect(size!.w).toBeGreaterThan(100)
  expect(size!.h).toBeGreaterThan(100)
  await expect(page.locator('.gis-loading')).toHaveCount(0, { timeout: 30_000 })
})
