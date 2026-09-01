import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'
import { purgeAttaches } from './helpers/cleanup'

/**
 * W2 任务C 日志三件套 + 附件管理黄金验证：
 * C1 操作日志搜索栏真实过滤；C2 登录日志搜索/UA列/归属地列/解锁入口；C3 附件真分页 + 图片预览。
 */

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 1x1 透明 PNG（最小合法文件，供附件上传/预览验证） */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/** 附件名逐轮唯一：固定名一旦有残留行，行选择器就会撞 strict mode */
const ATTACH_NAME = `w2c3-${Date.now() % 100000}.png`
const ATTACH_RE = new RegExp(ATTACH_NAME.replace('.', '\\.'))

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  // 用例末尾走 UI 删除；这里兜底，避免中途失败时附件行残留——
  // 残留行的磁盘文件会被后续清理掉，缩略图 404 会把巡访用例一起带红
  purgeAttaches(`${ATTACH_NAME}%`)
  await page?.close()
})

test('W2-C1 操作日志搜索栏：操作人/状态过滤与重置', async () => {
  await page.goto('/#/system/log')
  // 等表格首屏数据
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 })

  // 操作人过滤：admin → 请求携带 operator 参数且有结果行
  const operatorInput = page.getByPlaceholder('请输入操作人')
  await operatorInput.fill('admin')
  const hitReq = page.waitForRequest(
    (r) => r.url().includes('/system/oper-log/page') && r.url().includes('operator=admin')
  )
  await page.getByRole('button', { name: '查询' }).click()
  await hitReq
  await expect(page.getByRole('row', { name: /超级管理员/ }).first()).toBeVisible({
    timeout: 10_000
  })

  // 操作人过滤：不存在账号 → 无数据行
  await operatorInput.fill('w2c1_nonexistent')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /超级管理员/ })).toHaveCount(0, { timeout: 10_000 })

  // 重置：条件清空、数据回来
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 10_000 })
  await expect(operatorInput).toHaveValue('')

  // 状态过滤：失败 → 请求携带 status=0（状态项默认收起，先展开）
  await page.getByText('展开').first().click()
  await page.locator('.el-form-item', { hasText: '状态' }).locator('.el-select').first().click()
  await page.getByRole('option', { name: '失败' }).click()
  const statusReq = page.waitForRequest(
    (r) => r.url().includes('/system/oper-log/page') && r.url().includes('status=0')
  )
  await page.getByRole('button', { name: '查询' }).click()
  await statusReq
  await page.getByRole('button', { name: '重置' }).click()
})

test('W2-C2 登录日志：搜索过滤 + UA/归属地列 + 解锁入口', async () => {
  await page.goto('/#/system/login-log')
  // 等表格首屏数据（beforeAll 真实登录必留 admin 成功行）
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })

  // 新列表头：归属地 / 浏览器 / 操作系统
  await expect(page.getByRole('columnheader', { name: '归属地' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '浏览器' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '操作系统' })).toBeVisible()

  // 账号过滤：admin → 请求携带 username 参数
  const usernameInput = page.getByPlaceholder('请输入账号')
  await usernameInput.fill('admin')
  const hitReq = page.waitForRequest(
    (r) => r.url().includes('/system/login-log/page') && r.url().includes('username=admin')
  )
  await page.getByRole('button', { name: '查询' }).click()
  await hitReq
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })

  // IP 过滤：不可能存在的 IP → 无数据行
  await page.getByPlaceholder('请输入IP').fill('203.0.113.255')
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: /admin/ })).toHaveCount(0, { timeout: 10_000 })
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })

  // UA 解析落库：本次 e2e 登录的最近一条日志 browser/os 非空（V58 新列）
  const parsed = psql(
    `SELECT (browser IS NOT NULL AND os IS NOT NULL) FROM sys_login_log WHERE username='admin' ORDER BY id DESC LIMIT 1;`
  )
  expect(parsed, '最近登录日志 browser/os 应由 UA 解析落列').toBe('t')

  // 解锁入口按锁定状态显隐（行级 locked 由后端按 Redis 锁键富化）：admin 未锁定 → 其行不显示「解锁」按钮。
  // 断言收窄到 admin 行：其他账号是否锁定（如并行/先前用例锁的测试账号）与本用例无关。
  // 「连续错密锁定 → 本页一键解锁 → 恢复登录」完整链路见 session-lock.spec.ts
  await expect(
    page.getByRole('row', { name: /admin/ }).first().getByRole('button', { name: '解锁' })
  ).toHaveCount(0)
})

test('W2-C3 附件管理：真分页 + 文件名搜索 + 图片预览', async () => {
  await page.goto('/#/system/attach')

  // 上传 1x1 PNG（隐藏 input 直接 setInputFiles；本地存储回退 multipart 上传）
  // 先上传再断言分页器：空表不渲染分页器，附件全清后断言"分页器可见"会失败
  const uploadResp = page.waitForResponse(
    (r) => r.url().includes('/system/file/upload') || r.url().includes('/system/file/create')
  )
  await page.locator('input[type="file"]').setInputFiles({
    name: ATTACH_NAME,
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64')
  })
  expect((await uploadResp).status(), '附件上传须 200').toBe(200)

  // 新行出现（按 id 倒序在第一行）
  const row = page.getByRole('row', { name: ATTACH_RE }).first()
  await expect(row).toBeVisible({ timeout: 10_000 })

  // 真分页：有数据后分页器可见（首屏请求走 /system/file/page）
  await expect(page.locator('.el-pagination')).toBeVisible({ timeout: 10_000 })

  // 图片缩略图懒加载（download-stream 鉴权链取字节 → blob objectURL）
  const thumb = row.locator('img[src^="blob:"]')
  await expect(thumb).toBeVisible({ timeout: 15_000 })

  // 点击缩略图 → el-image 大图预览弹层
  await thumb.click()
  await expect(page.locator('.el-image-viewer__wrapper')).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('Escape')
  await expect(page.locator('.el-image-viewer__wrapper')).toBeHidden({ timeout: 10_000 })

  // 文件名搜索：w2c3 → 只剩该行；叠加不可能条件 → 空
  const stem = ATTACH_NAME.replace('.png', '')
  const filenameInput = page.getByPlaceholder('请输入文件名')
  await filenameInput.fill(stem)
  const hitReq = page.waitForRequest(
    (r) => r.url().includes('/system/file/page') && r.url().includes(`filename=${stem}`)
  )
  await page.getByRole('button', { name: '查询' }).click()
  await hitReq
  await expect(row).toBeVisible({ timeout: 10_000 })
  await filenameInput.fill(`${stem}_nonexistent`)
  await page.getByRole('button', { name: '查询' }).click()
  await expect(page.getByRole('row', { name: ATTACH_RE })).toHaveCount(0, { timeout: 10_000 })
  await page.getByRole('button', { name: '重置' }).click()
  await expect(page.getByRole('row', { name: ATTACH_RE }).first()).toBeVisible({ timeout: 10_000 })

  // 清理：UI 删除（物理 + 登记级联；操作列为「下载 / 删除」文字链接按钮）
  await page
    .getByRole('row', { name: ATTACH_RE })
    .first()
    .getByRole('button', { name: '删除' })
    .click()
  await page.locator('.el-message-box').getByRole('button', { name: '确定' }).click()
  await expect(page.getByRole('row', { name: ATTACH_RE })).toHaveCount(0, { timeout: 10_000 })
})
