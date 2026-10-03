import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 真实浏览器测试配置。
 * 前置：mugsun-boot(:8080，W4 须 --powerjob.worker.enabled=true) 与 vite dev(:3007) 已启动，
 * mugsun-pg / mugsun-redis / powerjob-server(:7700) 容器在跑（globalSetup 会尝试 docker start）。
 * 运行：pnpm test:e2e（串行——共享后端与数据库，避免互踩）
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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
