import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 真实浏览器测试配置。
 * 前置：mugsun-boot(:8080，W4 须 --powerjob.worker.enabled=true) 与 vite dev(:3007) 已启动，
 * mugsun-pg / mugsun-redis 在跑；PowerJob Server(:7700) 须已可达（globalSetup 只检查；设 E2E_START_POWERJOB=1 才会 docker start）。
 * 运行：pnpm test:e2e（主套，后端须关闭验证码）；pnpm test:e2e:captcha-on（后端须开启验证码，独立配置 playwright.captcha-on.config.ts）。
 * 均串行——共享后端与数据库，避免互踩
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/helpers/powerjob.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3007',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
    actionTimeout: 10_000
  },
  // 主套要求后端关闭验证码；验证码开启的拦截用例走 playwright.captcha-on.config.ts
  testIgnore: /captcha-on\//,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
