import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, logout, readAccessToken } from './fixtures/auth'
import { ensureDataTestRole } from './helpers/prepare'

/**
 * W3 后端菜单驱动矩阵：菜单管理真实驱动侧边栏（修「两张皮」）。
 * - admin 全量菜单
 * - 角色授权/回收后用户侧边栏即时变化（重新登录拉取）
 * - 注册用户仅公共菜单
 * - 菜单隐藏即时反映
 */

function psql(sql: string): string {
  return execSync(`docker exec mugsun-pg psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 从页面 localStorage 取当前 token 调 API */
async function api(page: Page, method: 'GET' | 'POST', url: string, body?: any) {
  const token = await readAccessToken(page)
  return page.request.fetch(`/api${url}`, {
    method,
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    data: body
  })
}

const ROLE_MENU_ID = '1200000000000000102' // 角色管理（V60 种子固定 id）

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  // fronttest + datatest 这对夹具是授权驱动场景的前置，幂等补齐（曾被清理删掉导致整条红）
  await login(page)
  await ensureDataTestRole(page)
})

test.afterAll(async () => {
  await page?.close()
})

test('W3-1 admin 全量菜单（四大应用分组齐全）', async () => {
  await login(page)
  await page.goto('/#/dashboard/console')
  // 顶级应用分组
  for (const app of ['工作台', '系统管理', '租户运营', '开放平台']) {
    await expect(page.getByText(app, { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  }
  // 切到系统管理分组：关键菜单项齐全
  await page.getByText('系统管理', { exact: true }).first().click()
  for (const item of ['角色管理', '菜单管理', '定时任务']) {
    await expect(page.getByRole('menuitem', { name: item })).toBeVisible({ timeout: 10_000 })
  }
})

test('W3-2 授权驱动：角色授权/回收侧边栏即时变化', async () => {
  // 前置：admin 登录取 id 并重置 fronttest 密码为初始密码
  await login(page)
  const fronttestId = psql(`SELECT id FROM sys_user WHERE username='fronttest' AND is_deleted=0;`)
  const datatestRoleId = psql(
    `SELECT id FROM sys_role WHERE role_code='datatest' AND is_deleted=0;`
  )
  expect(fronttestId).not.toBe('')
  expect(datatestRoleId).not.toBe('')
  const resetResp = await api(page, 'POST', '/system/user/reset-password', [fronttestId])
  expect(resetResp.status()).toBe(200)
  // 记录 datatest 当前授权（用于回收还原）；先强制剔除角色管理作净基线（防历史失败轮残留污染）
  const currentResp = await api(page, 'GET', `/system/role/menu-ids?roleId=${datatestRoleId}`)
  const rawIds = ((await currentResp.json()).data as (number | string)[]).map(String)
  const currentIds = rawIds.filter((id) => id !== ROLE_MENU_ID)
  await api(page, 'POST', '/system/role/grant', { roleId: datatestRoleId, menuIds: currentIds })

  // ① fronttest 登录：无 角色管理（datatest 未授），有 用户管理（已授）与公共菜单
  await logout(page)
  await login(page, { username: 'fronttest', password: '123456' })
  await page.getByText('系统管理', { exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: '用户管理' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('menuitem', { name: '角色管理' })).toHaveCount(0)
  await expect(page.getByText('租户运营', { exact: true })).toHaveCount(0)
  // 公共菜单（任意登录可见）
  await expect(page.getByRole('menuitem', { name: '我的通知' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '待办工作台' })).toBeVisible()

  // ② admin 授权 角色管理 → fronttest 重新登录 → 出现 角色管理 且可打开
  await logout(page)
  await login(page)
  const grantResp = await api(page, 'POST', '/system/role/grant', {
    roleId: datatestRoleId,
    menuIds: [...currentIds, ROLE_MENU_ID]
  })
  expect(grantResp.status()).toBe(200)
  await logout(page)
  await login(page, { username: 'fronttest', password: '123456' })
  await page.getByText('系统管理', { exact: true }).first().click()
  const roleMenuItem = page.getByRole('menuitem', { name: '角色管理' })
  await expect(roleMenuItem).toBeVisible({ timeout: 10_000 })
  await roleMenuItem.click()
  // 菜单可见即可达（授权生效）；v-perm 门控下 fronttest 无 sys:role:save，新增按钮隐藏属预期
  await expect(page.getByRole('columnheader', { name: '角色名称' })).toBeVisible({
    timeout: 10_000
  })
  await expect(page.getByRole('button', { name: '新增角色' })).toHaveCount(0)

  // ③ 回收 → 重新登录 → 消失
  await logout(page)
  await login(page)
  await api(page, 'POST', '/system/role/grant', { roleId: datatestRoleId, menuIds: currentIds })
  await logout(page)
  await login(page, { username: 'fronttest', password: '123456' })
  await page.getByText('系统管理', { exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: '角色管理' })).toHaveCount(0, {
    timeout: 10_000
  })
})

test('W3-3 注册用户仅公共菜单（角色管理/系统管理域不可见）', async () => {
  // 用 W1 注册链路已验证的身份直接建号（API，走 admin token 建普通用户无角色用户太慢——直接注册）
  const username = `e2e_w3_${Date.now() % 100000}`
  await logout(page)
  await login(page)
  // 经 admin API 建号（用户名/初始密码），不挂角色——模拟零权限新账号
  const createResp = await api(page, 'POST', '/system/user/submit', {
    username,
    nickname: 'W3验证用户',
    password: 'W3test@12345',
    status: 1,
    roleIds: []
  })
  expect(createResp.status()).toBe(200)

  await logout(page)
  await login(page, { username, password: 'W3test@12345' })
  await expect(page).toHaveURL(/#\/dashboard/)
  await page.getByText('系统管理', { exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: '我的通知' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('menuitem', { name: '角色管理' })).toHaveCount(0)
  await expect(page.getByText('系统管理', { exact: true }).first()).toBeVisible() // 系统管理组因公共子项存在
  await expect(page.getByText('租户运营', { exact: true })).toHaveCount(0)

  // 清理
  const uid = psql(`SELECT id FROM sys_user WHERE username='${username}';`)
  psql(`DELETE FROM sys_user_role WHERE user_id=${uid}; DELETE FROM sys_user WHERE id=${uid};`)
})

test('W3-4 菜单隐藏/显示即时反映', async () => {
  await logout(page)
  await login(page)
  // 当前 角色管理 可见
  await page.getByText('系统管理', { exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: '角色管理' })).toBeVisible({ timeout: 10_000 })

  // 经 API 把 角色管理 设为隐藏（读节点→改 isHide→submit）
  const treeResp = await api(page, 'GET', '/system/menu/tree')
  const tree = (await treeResp.json()).data as any[]
  const flat = (nodes: any[]): any[] => nodes.flatMap((n) => [n, ...flat(n.children || [])])
  const node = flat(tree).find((n) => n.path === '/system/role')
  expect(node, '菜单树应含 /system/role').toBeTruthy()

  try {
    const hideResp = await api(page, 'POST', '/system/menu/submit', { ...node, isHide: 1 })
    expect(hideResp.status()).toBe(200)

    // 重新登录 → 侧边栏不再有 角色管理（路由仍注册、直接 URL 可达）
    await logout(page)
    await login(page)
    await page.getByText('系统管理', { exact: true }).first().click()
    await expect(page.getByRole('menuitem', { name: '角色管理' })).toHaveCount(0, {
      timeout: 10_000
    })
    await page.goto('/#/system/role')
    await expect(page.getByRole('button', { name: '新增角色' })).toBeVisible({ timeout: 10_000 })
  } finally {
    // 恢复显示（失败也必须还原，防脏数据污染后续用例）
    await api(page, 'POST', '/system/menu/submit', { ...node, isHide: 0 })
  }

  await logout(page)
  await login(page)
  await page.getByText('系统管理', { exact: true }).first().click()
  await expect(page.getByRole('menuitem', { name: '角色管理' })).toBeVisible({ timeout: 10_000 })
})
