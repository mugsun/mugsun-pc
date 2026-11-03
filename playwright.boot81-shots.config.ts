import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.BOOT81_SHOT_PORT || 3094)

export default defineConfig({
  testDir: './e2e-ui',
  testMatch: /boot81-review-shots\.spec\.ts/,
  timeout: 4 * 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'artifacts/pc-boot81-ui-pw',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    env: { VITE_ACCESS_MODE: 'frontend', UI_CHECK: '1' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000
  }
})
