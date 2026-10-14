/**
 * globalSetup：正式检查前把所有路由打开一遍，让 vite dev server 完成冷编译。
 * 否则第一个组合里个别弹窗组件编译慢，会在等待时间内打不开。
 */
import { chromium, type FullConfig } from '@playwright/test'
import { mockAll, seedSession, SKIP_ROUTE } from './support/session'

export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string
  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await seedSession(page, 'zh', 'light')
  await mockAll(page)
  await page.goto('/')
  await page.waitForFunction(() => (document.querySelector('#app') as any)?.__vue_app__, null, {
    timeout: 120_000
  })
  const paths: string[] = await page.evaluate(() =>
    (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$router
      .getRoutes()
      .filter((r: any) => r.components?.default && !r.children?.length)
      .map((r: any) => r.path)
  )
  const targets = [...new Set(paths)].filter((p) => p !== '/' && !SKIP_ROUTE.test(p))
  const started = Date.now()
  for (const p of targets) {
    await page.goto('/#' + p)
    await page.waitForLoadState('networkidle', { timeout: 60_000 })
  }
  console.log(
    `[warmup] ${targets.length} 个路由预热完成，用时 ${Math.round((Date.now() - started) / 1000)}s`
  )
  await browser.close()
}
