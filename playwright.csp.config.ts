import { defineConfig, devices } from '@playwright/test'

/**
 * CSP 强制模式检查（安全审查 boot58 任务二的 Playwright 部分）。
 * 必须对 nginx 镜像跑（不是 vite dev/preview，后者不下发 CSP 头）：
 *   docker build --build-context track=../mugsun-track -t mugsun/pc:csp-test .
 *   docker run -d -p 3094:8080 -e MUGSUN_CSP_MODE=enforce -e MUGSUN_API_UPSTREAM=http://host.docker.internal:<后端端口> mugsun/pc:csp-test
 *   E2E_BASE_URL=http://localhost:3094 pnpm exec playwright test -c playwright.csp.config.ts
 * 截图与结果：CSP_SHOTS_DIR（默认 test-results/csp）。
 */
export default defineConfig({
  testDir: './e2e-csp',
  timeout: 600_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3094',
    locale: 'zh-CN',
    actionTimeout: 10_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
