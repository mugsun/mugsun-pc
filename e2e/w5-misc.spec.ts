import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, readAccessToken } from './fixtures/auth'
import { PG_CONTAINER } from './helpers/docker'

/**
 * W5 任务G 杂项清理验证：
 * - H10 微信渠道死常量移除（渠道列表无 wechat_mp；前端无渠道配置页，降级为 API + 源码断言）
 * - H14 gen-modeling 页「AI 建模」更名「规则建模」并展示能力说明
 * - H6 feedback 页状态列改字典 tag 渲染（feedback_status 字典驱动）
 * - R7 crypto 演示路由生产构建隐藏（静态断言 isHide: import.meta.env.PROD，不做真构建）
 */

function psql(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 从页面 localStorage 取当前 token 调 API（同 w3-menu） */
async function api(page: Page, method: 'GET' | 'POST', url: string, body?: any) {
  const token = await readAccessToken(page)
  return page.request.fetch(`/api${url}`, {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    data: body
  })
}

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('W5-H10 渠道列表无微信公众号（死常量已移除）', async () => {
  const resp = await api(page, 'GET', '/system/notify/channel/page')
  expect(resp.status()).toBe(200)
  const records = ((await resp.json()).data?.records ?? []) as any[]
  expect(records.length).toBeGreaterThan(0)
  expect(
    records.some((c) => c.channel === 'wechat_mp'),
    '渠道配置不得再出现微信公众号（wechat_mp）'
  ).toBe(false)

  // 源码静态断言：死常量已从 NotifyConstants 移除（渠道注册机制的唯一定义点）
  const constantsSrc = readFileSync(
    path.resolve(
      process.cwd(),
      '../mugsun-boot/mugsun-boot-core/src/main/java/com/mugsun/boot/common/constant/NotifyConstants.java'
    ),
    'utf-8'
  )
  expect(constantsSrc).not.toContain('CHANNEL_WECHAT_MP')
  expect(constantsSrc).not.toContain('wechat_mp')
})

test('W5-H14 gen-modeling 页显示「规则建模」与能力说明', async () => {
  await page.goto('/#/system/gen-modeling')
  // Tab 已更名（不再有「AI 辅助建模」）
  await expect(page.getByRole('tab', { name: '规则建模' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('tab', { name: /AI/ })).toHaveCount(0)
  // 能力说明：基于规则解析，不支持自由中文描述
  await expect(page.getByText(/基于规则解析.*不支持自由中文描述/)).toBeVisible()
})

test('W5-H6 feedback 页状态列渲染字典 tag', async () => {
  const id = Date.now()
  psql(
    `INSERT INTO sys_feedback (id, content, contact, status, create_time, is_deleted) VALUES (${id}, 'W5E2E字典tag验证', '', 0, now(), 0);`
  )
  try {
    await page.goto('/#/system/feedback')
    const row = page.getByRole('row', { name: /W5E2E字典tag验证/ })
    await expect(row).toBeVisible({ timeout: 10_000 })
    // 状态列：ArtDictTag 按 feedback_status 字典渲染 el-tag「未处理」（非手写文案）
    await expect(row.locator('.el-tag').first()).toHaveText('未处理')
  } finally {
    psql(`DELETE FROM sys_feedback WHERE id=${id};`)
  }
})

test('W5-R7 crypto 演示路由生产构建隐藏（静态断言）', async () => {
  const routerSrc = readFileSync(
    path.resolve(process.cwd(), 'src/router/modules/system.ts'),
    'utf-8'
  )
  // crypto 路由段须含 isHide: import.meta.env.PROD（生产构建隐藏菜单，页保留作接口加密自检工具）
  const cryptoBlock = routerSrc.match(/path:\s*'crypto'[\s\S]*?roles:/)
  expect(cryptoBlock, 'router/modules/system.ts 应含 crypto 路由').toBeTruthy()
  expect(cryptoBlock![0]).toContain('isHide: import.meta.env.PROD')
})
