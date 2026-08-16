import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, logout, readAccessToken } from './fixtures/auth'
import { XLSX_MIME, buildXlsx, parseXlsxAoa } from './fixtures/xlsx'

/**
 * W5 用户导入导出完整化：
 * - 导入模板下载（表头 + 示例行）
 * - 含错误行导入：成败计数 + 失败明细（空用户名跳过 / 手机号不合规 / 已存在）
 * - updateSupport 覆盖导入：更新昵称/状态/邮箱，不动密码与手机号
 * - 按查询条件导出：列补全（部门/角色/邮箱/手机/创建时间）+ 条件过滤
 * - 字段级权限裁决：无明文权角色（fronttest/datatest）导出手机号为脱敏值
 */

const STATUS_HEADER = '状态(1启用/0禁用)'
const suffix = `${Date.now() % 100000}`
const baseUser = `e2e_w5_${suffix}`
// 手机号按时间戳唯一化（uk_user_tenant_phone 唯一约束，防跨轮冲突）
const uniquePhone = `138${String(Date.now()).slice(-8)}`
const uniquePhone2 = `139${String(Date.now() + 1).slice(-8)}`
const badPhoneUser = `e2e_w5_bad_${suffix}`
const maskUser = `e2e_w5_mask_${suffix}`

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 从页面 localStorage 取当前 token */
async function token(page: Page): Promise<string> {
  return readAccessToken(page)
}

/** multipart 上传导入文件 */
async function importFile(page: Page, buffer: Buffer, updateSupport: boolean) {
  const auth = await token(page)
  const resp = await page.request.fetch('/api/system/user/import', {
    method: 'POST',
    headers: { Authorization: auth },
    multipart: {
      file: { name: 'users.xlsx', mimeType: XLSX_MIME, buffer },
      updateSupport: String(updateSupport)
    }
  })
  return resp
}

/** 带条件导出（返回 xlsx 字节） */
async function exportFile(page: Page, params: Record<string, string> = {}) {
  const auth = await token(page)
  return page.request.fetch('/api/system/user/export', {
    method: 'GET',
    headers: { Authorization: auth },
    params
  })
}

/** 构造导入 xlsx（表头与模板一致：用户名/昵称/部门/岗位/邮箱/手机/状态(1启用/0禁用)） */
function buildUserXlsx(rows: Array<Record<string, unknown>>): Promise<Buffer> {
  return buildXlsx('用户导入', rows)
}

/** 清理 W5 产生的用户（中间表 + 主表） */
function cleanupUsers(...usernames: string[]): void {
  const inList = usernames.map((u) => `'${u}'`).join(',')
  psql(
    `DELETE FROM sys_user_role WHERE user_id IN (SELECT id FROM sys_user WHERE username IN (${inList})); ` +
      `DELETE FROM sys_user WHERE username IN (${inList});`
  )
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

test('W5-1 导入模板下载：表头齐全 + 一行示例', async () => {
  const auth = await token(page)
  const resp = await page.request.fetch('/api/system/user/import-template', {
    method: 'GET',
    headers: { Authorization: auth }
  })
  expect(resp.status(), '模板下载须 200').toBe(200)
  expect(resp.headers()['content-type']).toContain('spreadsheetml')
  const aoa = await parseXlsxAoa(await resp.body())
  expect(aoa[0], '模板表头').toEqual([
    '用户名',
    '昵称',
    '部门',
    '岗位',
    '邮箱',
    '手机',
    STATUS_HEADER
  ])
  expect(aoa.length, '模板含一行示例').toBe(2)
  expect(aoa[1][0], '示例用户名').toBe('zhangsan')
})

test('W5-2 含错误行导入：成功/失败计数与明细（空用户名跳过不计）', async () => {
  const buffer = await buildUserXlsx([
    {
      用户名: baseUser,
      昵称: 'W5导入用户',
      部门: '研发中心',
      岗位: '开发工程师',
      邮箱: 'w5@test.com',
      手机: uniquePhone,
      [STATUS_HEADER]: 1
    },
    { 用户名: badPhoneUser, 昵称: '坏手机', 手机: '123', [STATUS_HEADER]: 1 },
    { 昵称: '无用户名行' },
    { 用户名: 'admin', 昵称: '尝试覆盖', [STATUS_HEADER]: 0 }
  ])
  const resp = await importFile(page, buffer, false)
  expect(resp.status(), '导入须 200').toBe(200)
  const result = (await resp.json()).data
  expect(result.successCount, '仅 1 行合法').toBe(1)
  expect(result.failCount, '坏手机 + 已存在 共 2 行失败').toBe(2)
  const fails = result.failList as Array<{ rowIndex: number; username: string; reason: string }>
  const badRow = fails.find((f) => f.username === badPhoneUser)
  expect(badRow?.rowIndex, '坏手机行为第 3 行').toBe(3)
  expect(badRow?.reason).toContain('手机号格式不正确')
  const adminRow = fails.find((f) => f.username === 'admin')
  expect(adminRow?.rowIndex, 'admin 行为第 5 行').toBe(5)
  expect(adminRow?.reason).toContain('已存在')

  // 落库核对：部门/岗位已按名解析、手机/邮箱写入
  const db = psql(
    `SELECT nickname || '|' || status || '|' || email || '|' || phone || '|' || (CASE WHEN dept_id IS NOT NULL THEN 't' ELSE 'f' END) || '|' || (CASE WHEN post_id IS NOT NULL THEN 't' ELSE 'f' END) FROM sys_user WHERE username='${baseUser}';`
  )
  expect(db).toBe(`W5导入用户|1|w5@test.com|${uniquePhone}|t|t`)
})

test('W5-3 按条件导出：列补全 + 条件过滤 + 富化值', async () => {
  // 按用户名过滤导出：仅目标行
  const filtered = await exportFile(page, { username: baseUser })
  expect(filtered.status(), '导出须 200').toBe(200)
  const aoa = await parseXlsxAoa(await filtered.body())
  expect(aoa[0], '导出表头补全').toEqual([
    '用户名',
    '昵称',
    '部门',
    '角色',
    '邮箱',
    '手机',
    STATUS_HEADER,
    '创建时间'
  ])
  expect(aoa.length, '条件过滤后仅 1 行数据').toBe(2)
  const row = aoa[1]
  expect(row[0]).toBe(baseUser)
  expect(row[1]).toBe('W5导入用户')
  expect(row[2], '部门富化为名称').toBe('研发中心')
  expect(row[4]).toBe('w5@test.com')
  expect(row[5], 'admin 持明文权导出明文手机号').toBe(uniquePhone)
  expect(row[7], '创建时间非空').toBeTruthy()

  // 无条件导出：含 admin 行（全量）
  const all = await exportFile(page)
  const allAoa = await parseXlsxAoa(await all.body())
  const usernames = allAoa.slice(1).map((r) => r[0])
  expect(usernames).toContain('admin')
})

test('W5-4 updateSupport 覆盖导入：更新昵称/状态/邮箱，不动密码与手机号', async () => {
  const buffer = await buildUserXlsx([
    { 用户名: baseUser, 昵称: 'W5覆盖昵称', 邮箱: 'w5new@test.com', [STATUS_HEADER]: 0 }
  ])

  // 不勾选覆盖：已存在记失败
  const pwdBefore = psql(`SELECT password FROM sys_user WHERE username='${baseUser}';`)
  const rejectResp = await importFile(page, buffer, false)
  const rejectResult = (await rejectResp.json()).data
  expect(rejectResult.successCount).toBe(0)
  expect(rejectResult.failCount).toBe(1)
  expect(rejectResult.failList[0].reason).toContain('已存在')

  // 勾选覆盖：更新昵称/状态/邮箱
  const okResp = await importFile(page, buffer, true)
  const okResult = (await okResp.json()).data
  expect(okResult.successCount).toBe(1)
  expect(okResult.failCount).toBe(0)

  const db = psql(
    `SELECT nickname || '|' || status || '|' || email || '|' || phone FROM sys_user WHERE username='${baseUser}';`
  )
  expect(db, '覆盖更新昵称/状态/邮箱，手机号不动').toBe(
    `W5覆盖昵称|0|w5new@test.com|${uniquePhone}`
  )
  const pwdAfter = psql(`SELECT password FROM sys_user WHERE username='${baseUser}';`)
  expect(pwdAfter, '覆盖导入不得改密码').toBe(pwdBefore)

  cleanupUsers(baseUser, badPhoneUser)
})

test('W5-5 字段级权限裁决：无明文权角色导出手机号为脱敏值', async () => {
  // 造一个带手机号用户（admin 导入）
  const buffer = await buildUserXlsx([
    { 用户名: maskUser, 昵称: 'W5脱敏验证', 手机: uniquePhone2, [STATUS_HEADER]: 1 }
  ])
  const importResp = await importFile(page, buffer, false)
  expect((await importResp.json()).data.successCount).toBe(1)

  // 数据范围临时置全部（否则该角色导不出目标用户；用例结束还原，防环境漂移）
  const dataScopeBefore = psql(
    `SELECT data_scope FROM sys_role WHERE role_code='datatest' AND is_deleted=0;`
  )
  psql(`UPDATE sys_role SET data_scope=1 WHERE role_code='datatest' AND is_deleted=0;`)

  // 切到 fronttest（datatest：有 sys:user:phone 查看权、无明文权）
  const fronttestId = psql(`SELECT id FROM sys_user WHERE username='fronttest' AND is_deleted=0;`)
  const auth = await token(page)
  await page.request.fetch('/api/system/user/reset-password', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    data: [Number(fronttestId)]
  })
  await logout(page)
  await login(page, { username: 'fronttest', password: '123456' })

  const resp = await exportFile(page, { username: maskUser })
  expect(resp.status(), 'fronttest 导出须 200').toBe(200)
  const aoa = await parseXlsxAoa(await resp.body())
  expect(aoa.length, 'fronttest 按条件导出可见目标行').toBe(2)
  const phoneCell = `${aoa[1][5] ?? ''}`
  expect(phoneCell, '无明文权导出脱敏手机号').toContain('*')
  expect(phoneCell).not.toBe(uniquePhone2)

  // 还原数据范围 + 清理
  psql(
    `UPDATE sys_role SET data_scope=${dataScopeBefore} WHERE role_code='datatest' AND is_deleted=0;`
  )
  cleanupUsers(maskUser)
})
