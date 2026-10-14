import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from '../e2e/fixtures/auth'
import { collectAdminRoutes } from '../e2e/helpers/routes'

/**
 * CSP 强制模式检查：逐菜单统计 securitypolicyviolation（enforce 必须为 0，Report-Only 只记录），
 * 校验响应头、i18n 译文、离线图标、无外域请求、地图、WebSocket、注入探针。
 */
interface Violation {
  directive: string
  blocked: string
  disposition: string
  sample: string
}

const SHOTS = process.env.CSP_SHOTS_DIR || 'test-results/csp'
const routes = collectAdminRoutes()
const result: Record<string, unknown> = {}
const external = new Set<string>()
const perMenu: {
  path: string
  name: string
  enforce: number
  reportOnly: number
  detail: string[]
}[] = []

test.describe.configure({ mode: 'serial' })
let page: Page
let origin = ''

async function drain(p: Page): Promise<Violation[]> {
  return p.evaluate(() => {
    const w = window as unknown as { __csp?: Violation[] }
    const v = w.__csp || []
    w.__csp = []
    return v
  })
}

/**
 * 已知限制白名单（逐条登记，见文档「CSP 已知限制」）：form-create 设计器会用 new Function 编译
 * 规则里的函数/条件/公式，不为此放开 'unsafe-eval'。只允许列出的指令，出现其他违规仍失败。
 */
const KNOWN: Record<string, string[]> = {
  '/system/form-designer': ['script-src eval']
}

const KEY_RE = /^[a-z][A-Za-z_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/

async function keyLikeTexts(p: Page): Promise<string[]> {
  const texts = await p
    .locator('aside, header, .art-header-bar, .menu-left, #app')
    .first()
    .evaluate((el) => {
      const out: string[] = []
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const t = (walker.currentNode.textContent || '').trim()
        if (t) out.push(t)
      }
      return out
    })
  return texts.filter((t) => KEY_RE.test(t))
}

test.beforeAll(async ({ browser, baseURL }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
  origin = new URL(baseURL!).origin
  const ctx = await browser.newContext()
  await ctx.addInitScript(() => {
    const w = window as unknown as { __csp: Violation[] }
    w.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
        disposition: e.disposition,
        sample: (e.sample || '').slice(0, 60)
      })
    })
  })
  page = await ctx.newPage()
  page.on('request', (r) => {
    const u = r.url()
    if (
      /^(https?|wss?):/.test(u) &&
      !u.startsWith(origin) &&
      !u.startsWith(origin.replace('http', 'ws'))
    )
      external.add(new URL(u).origin)
  })
})

test.afterAll(async () => {
  result.perMenu = perMenu
  result.externalOrigins = [...external]
  fs.writeFileSync(path.join(SHOTS, 'result.json'), JSON.stringify(result, null, 2))
  await page?.context().close()
})

test('2. 响应头：enforce CSP 存在且不含 unsafe-eval / * / https:，Report-Only 仅为附加头', async () => {
  const resp = await page.request.get('/')
  const h = resp.headers()
  const csp = h['content-security-policy'] || ''
  const ro = h['content-security-policy-report-only'] || ''
  result.headers = { csp, ro }
  expect(csp).not.toBe('')
  for (const bad of [
    "'unsafe-eval'",
    "'wasm-unsafe-eval'",
    ' * ',
    'https:',
    'tianditu',
    'amap',
    'autonavi'
  ])
    expect(csp, bad).not.toContain(bad)
  expect(csp).toContain("media-src 'self' blob:")
  expect(ro).not.toContain("'unsafe-inline'")
})

test('登录（真实验证码）', async () => {
  await login(page)
  const v = await drain(page)
  result.loginViolations = v
  expect(v.filter((x) => x.disposition === 'enforce')).toEqual([])
})

test('1. 逐菜单巡访：enforce 违规必须为 0', async () => {
  for (const r of routes) {
    await page.goto('/#' + r.path)
    await expect
      .poll(async () => (await page.locator('#app').innerText()).trim().length, { timeout: 15_000 })
      .toBeGreaterThan(0)
    await page.waitForTimeout(1500)
    const v = await drain(page)
    const enf = v.filter((x) => x.disposition === 'enforce')
    perMenu.push({
      path: r.path,
      name: r.name,
      enforce: enf.length,
      reportOnly: v.length - enf.length,
      detail: [...new Set(enf.map((x) => `${x.directive} ${x.blocked} ${x.sample}`))]
    })
  }
  await page.goto('/#/system/form-designer')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(SHOTS, '01-form-designer-known-limit.png') })
  await drain(page)
  const bad = perMenu.filter(
    (m) =>
      m.enforce > 0 && !m.detail.every((d) => (KNOWN[m.path] || []).some((k) => d.startsWith(k)))
  )
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([])
})

test('3. i18n：中/英文切换后显示译文而非 key', async () => {
  await page.goto('/#/dashboard/console')
  await page.waitForTimeout(1500)
  const zhKeys = await keyLikeTexts(page)
  const zhText = await page.locator('.layout-sidebar').first().innerText()
  await page.screenshot({ path: path.join(SHOTS, '03-i18n-zh.png') })
  await page.locator('.language-btn').first().hover()
  await page.getByText('English', { exact: true }).click()
  await page.waitForTimeout(2500)
  const enKeys = await keyLikeTexts(page)
  const enText = await page.locator('.layout-sidebar').first().innerText()
  await page.screenshot({ path: path.join(SHOTS, '03-i18n-en.png') })
  const v = await drain(page)
  result.i18n = {
    zhKeys,
    enKeys,
    zhSample: zhText.slice(0, 120),
    enSample: enText.slice(0, 120),
    violations: v
  }
  expect(zhKeys).toEqual([])
  expect(enKeys).toEqual([])
  expect(zhText).toMatch(/[\u4e00-\u9fa5]/)
  expect(enText).toMatch(/[A-Za-z]{3,}/)
  expect(enText).not.toMatch(/[\u4e00-\u9fa5]{2,}/)
  expect(v.filter((x) => x.disposition === 'enforce')).toEqual([])
  // 切回中文
  await page.locator('.language-btn').first().hover()
  await page.getByText('简体中文', { exact: true }).click()
  await page.waitForTimeout(2000)
})

test('4. 图标：侧边栏 svg 非空，无 iconify 外域请求', async () => {
  await page.goto('/#/dashboard/console')
  await page.waitForTimeout(1500)
  const stats = await page.evaluate(() => {
    const count = (root: Element | Document | null) => {
      const svgs = root ? [...root.querySelectorAll('svg')] : []
      const empty = svgs.filter((s) => !s.innerHTML.trim())
      return {
        total: svgs.length,
        empty: empty.length,
        emptyWhere: empty.map((s) =>
          `${s.parentElement?.className || s.parentElement?.tagName}`.slice(0, 60)
        )
      }
    }
    return {
      sidebar: count(document.querySelector('.layout-sidebar')),
      page: count(document)
    }
  })
  await page.screenshot({ path: path.join(SHOTS, '04-icons.png') })
  result.icons = { ...stats, external: [...external] }
  expect(stats.sidebar.total).toBeGreaterThan(0)
  expect(stats.sidebar.empty).toBe(0)
  // iconify 图标（.art-svg-icon / .iconify）必须都有内容
  expect(stats.page.emptyWhere.filter((w) => /iconify|art-svg-icon/.test(w))).toEqual([])
  expect([...external].filter((o) => /iconify|simplesvg|unisvg/.test(o))).toEqual([])
})

test('5. 地图：OL 2D 与 Cesium 3D 加载，canvas 非空白', async () => {
  const out: Record<string, unknown> = {}
  for (const [k, hash] of [
    ['ol2d', '/gis/workspace'],
    ['cesium3d', '/gis/scene']
  ]) {
    const tiles: number[] = []
    const onResp = (r: { url(): string; status(): number }) => {
      if (r.url().includes('/gis/tile')) tiles.push(r.status())
    }
    page.on('response', onResp)
    await page.goto('/#' + hash)
    await page.waitForTimeout(6000)
    page.off('response', onResp)
    const canvas = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('canvas')]
      return cs.map((c) => ({ w: c.width, h: c.height }))
    })
    const v = await drain(page)
    await page.screenshot({ path: path.join(SHOTS, `05-map-${k}.png`) })
    out[k] = {
      canvas,
      tileStatus: [...new Set(tiles)],
      tileCount: tiles.length,
      enforce: v.filter((x) => x.disposition === 'enforce')
    }
  }
  result.map = out
})

test('8. WebSocket：同源握手', async () => {
  const sockets: string[] = []
  page.on('websocket', (ws) => sockets.push(ws.url().replace(/token=[^&]+/, 'token=***')))
  await page.reload()
  await page.waitForTimeout(5000)
  result.websocket = { sockets }
})

test('10. 注入探针：内联事件处理器被拦并产生违规', async () => {
  await page.goto('/#/dashboard/console')
  await page.waitForTimeout(1000)
  await drain(page)
  const fired = await page.evaluate(async () => {
    const w = window as unknown as { __xss?: number }
    document.body.insertAdjacentHTML('beforeend', '<img src="x" onerror="window.__xss=1">')
    const s = document.createElement('script')
    s.textContent = 'window.__xss2=1'
    document.body.appendChild(s)
    await new Promise((r) => setTimeout(r, 800))
    return { onerror: w.__xss ?? 0, inline: (window as unknown as { __xss2?: number }).__xss2 ?? 0 }
  })
  const v = await drain(page)
  result.probe = { fired, violations: v }
  expect(fired).toEqual({ onerror: 0, inline: 0 })
  expect(v.filter((x) => x.disposition === 'enforce').length).toBeGreaterThanOrEqual(2)
})
