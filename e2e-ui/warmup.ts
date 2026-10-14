/**
 * globalSetup：正式检查前把所有路由打开一遍，让 vite dev server 完成冷编译。
 * 否则第一个组合里个别弹窗组件编译慢，会在等待时间内打不开。
 */
import { chromium, type FullConfig } from '@playwright/test'
import { mockAll, seedSession } from './support/session'

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
  const started = Date.now()
  // 直接调用每个路由的懒加载函数：等 import() 完成，dev server 就把页面及其依赖都编译好了
  const n: number = await page.evaluate(async () => {
    const router = (document.querySelector('#app') as any).__vue_app__.config.globalProperties
      .$router
    const loaders = router
      .getRoutes()
      .map((r: any) => r.components?.default)
      .filter((c: any) => typeof c === 'function')
    for (const load of loaders) await Promise.resolve(load()).catch(() => {})
    return loaders.length
  })
  console.log(
    `[warmup] ${n} 个路由组件预热完成，用时 ${Math.round((Date.now() - started) / 1000)}s`
  )
  await browser.close()
}
