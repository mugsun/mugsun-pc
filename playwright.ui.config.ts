import { defineConfig, devices } from '@playwright/test'

/**
 * UI 自检（表单校验提示 / 标签布局）。
 * 不依赖后端：前端路由模式 + 浏览器内拦截 /api/** 返回 mock。
 * 运行：pnpm test:ui-check（会自动在 :3092 起 vite dev server）
 */
const PORT = Number(process.env.UI_CHECK_PORT || 3092)
const combos = [
  { name: 'zh-light', lang: 'zh', theme: 'light' },
  { name: 'en-light', lang: 'en', theme: 'light' },
  { name: 'zh-dark', lang: 'zh', theme: 'dark' },
  { name: 'en-dark', lang: 'en', theme: 'dark' }
] as const

export default defineConfig({
  testDir: './e2e-ui',
  timeout: 20 * 60_000,
  expect: { timeout: 5_000 },
  retries: 0,
  workers: process.env.CI ? 2 : 2,
  reporter: [['list'], ['json', { outputFile: 'e2e-ui-report/results.json' }]],
  outputDir: 'e2e-ui-report/artifacts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    actionTimeout: 5_000
  },
  webServer: {
    // 用 dev server 而不是 build+preview：生产构建开了 drop_console，console.error 会被删掉，冒烟测试就抓不到报错
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    env: { VITE_ACCESS_MODE: 'frontend', UI_CHECK: '1' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000
  },
  projects: combos.map((c) => ({
    name: c.name,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      locale: c.lang === 'en' ? 'en-US' : 'zh-CN',
      colorScheme: c.theme,
      uiLang: c.lang,
      uiTheme: c.theme
    }
  }))
})
