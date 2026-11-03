import { defineConfig, devices } from '@playwright/test'

/**
 * CSP 强制模式检查（安全审查 boot58 任务二的 Playwright 部分）。
 * 必须对 nginx 镜像跑（不是 vite dev/preview，后者不下发 CSP 头）。
 * CI：`csp-e2e` job（scripts/ci/run-csp-e2e.sh）会起 compose 并上传 test-results/csp/。
 * CI `csp-e2e` 钉 boot/core SHA（见 .github/workflows/ci.yml）：
 *   boot 289eb068dda51a10447deffc134bc8353ddbe8ee
 *   core 50c5843684c2f297f6aa37193fcc4e0c48ff12c6
 * 避 #70 JetCache tip 炸栈；升钉条件见 AGENTS.md（至少含 boot 289eb068）。
 * 本地最短路径：
 *   docker build -t mugsun/pc:csp-test .
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
