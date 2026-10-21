import { defineConfig, devices } from '@playwright/test'

/**
 * 验证码开启时的拦截用例（e2e/captcha-on/），独立配置：不带 globalSetup，不需要 PowerJob。
 * 前置：mugsun-boot 验证码开启（默认），vite dev 已启动（E2E_BASE_URL，默认 :3007）。
 * 运行：pnpm test:e2e:captcha-on
 */
export default defineConfig({
  testDir: './e2e/captcha-on',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3007',
    locale: 'zh-CN'
  },
  projects: [{ name: 'captcha-on', use: { ...devices['Desktop Chrome'] } }]
})
