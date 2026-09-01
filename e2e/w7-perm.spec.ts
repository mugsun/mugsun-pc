import { execSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login, logout, readAccessToken } from './fixtures/auth'

/**
 * W7 按钮级权限门控：v-perm/hasPerm 与后端权限码对齐。
 * - 只授「用户管理」菜单（sys:user:list）的用户：列表可见，新增/导入/授权/重置密码按钮被门控隐藏
 * - admin 追加授予按钮节点（sys:user:add/edit/remove/grant/reset）后：全部按钮恢复可见
 * - psql 兜底清理角色/用户，防脏数据
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

// 菜单授权须连父节点一起授：只授叶子，侧边栏没有可挂载的分组，页面进不去
const SYSTEM_MENU_ID = '1200000000000000001' // 系统管理（M 型分组）
const USER_MENU_ID = '1200000000000000101' // 用户管理（C 型，sys:user:list）
// V39 种子的用户管理 F 型按钮节点
const USER_BUTTON_IDS = [
  '1061000000000000001', // 新增用户 sys:user:add
  '1061000000000000002', // 编辑用户 sys:user:edit
  '1061000000000000003', // 删除用户 sys:user:remove
  '1061000000000000004', // 用户授权 sys:user:grant
  '1061000000000000005' // 重置密码 sys:user:reset
]
const ROLE_CODE = 'w7perm'
const USERNAME = `e2e_w7_${Date.now() % 100000}`
const PASSWORD = 'W7test@12345'

test.describe.configure({ mode: 'serial' })

let page: Page
let roleId = ''
let userId = ''

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})

test.afterAll(async () => {
  // psql 清理（先子表后主表）；角色/用户即使断言失败也不残留
  if (userId) {
    psql(
      `DELETE FROM sys_user_role WHERE user_id=${userId}; DELETE FROM sys_user WHERE id=${userId};`
    )
  }
  if (roleId) {
    psql(
      `DELETE FROM sys_role_menu WHERE role_id=${roleId}; DELETE FROM sys_role_dept WHERE role_id=${roleId}; DELETE FROM sys_role WHERE id=${roleId};`
    )
  }
  await page?.close()
})

test('W7-1 仅授用户管理菜单：写按钮全部隐藏、列表与未门控按钮保留', async () => {
  // admin 建角色（仅本人数据范围无关按钮门控，给全部避免空表干扰断言）
  await login(page)
  const roleResp = await api(page, 'POST', '/system/role/submit', {
    roleName: 'W7权限验证',
    roleCode: ROLE_CODE,
    sort: 99,
    dataScope: 1
  })
  expect(roleResp.status(), '建角色须 200').toBe(200)
  roleId = psql(`SELECT id FROM sys_role WHERE role_code='${ROLE_CODE}' AND is_deleted=0;`)
  expect(roleId).not.toBe('')

  // 只授 用户管理 菜单节点（不含任何按钮节点）→ 用户 buttons 仅 sys:user:list
  const grantResp = await api(page, 'POST', '/system/role/grant', {
    roleId,
    menuIds: [SYSTEM_MENU_ID, USER_MENU_ID]
  })
  expect(grantResp.status(), '角色授权须 200').toBe(200)

  // 建用户并挂该角色
  const userResp = await api(page, 'POST', '/system/user/submit', {
    username: USERNAME,
    nickname: 'W7门控验证',
    password: PASSWORD,
    status: 1,
    roleIds: [roleId]
  })
  expect(userResp.status(), '建用户须 200').toBe(200)
  userId = psql(`SELECT id FROM sys_user WHERE username='${USERNAME}' AND is_deleted=0;`)
  expect(userId).not.toBe('')

  // 该用户登录 → 用户页：列表可见，写按钮全部隐藏
  await logout(page)
  await login(page, { username: USERNAME, password: PASSWORD })
  await page.goto('/#/system/user')
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })
  // v-perm 门控（模板场景）：元素 display:none / 不可见
  await expect(page.getByRole('button', { name: '新增用户' })).toBeHidden()
  await expect(page.getByRole('button', { name: '导入' })).toBeHidden()
  // hasPerm 门控（操作列 h() 渲染）：不渲染即不存在
  await expect(page.getByRole('button', { name: '授权' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '重置密码' })).toHaveCount(0)
  // 未门控按钮仍在（证明页面正常渲染，不是整页失败）
  await expect(page.getByRole('button', { name: '导出' })).toBeVisible()
})

test('W7-2 追加授予按钮节点：写按钮全部恢复可见', async () => {
  // admin 追加 5 个按钮节点（grant 全量替换 menuIds）
  await logout(page)
  await login(page)
  const grantResp = await api(page, 'POST', '/system/role/grant', {
    roleId,
    menuIds: [SYSTEM_MENU_ID, USER_MENU_ID, ...USER_BUTTON_IDS]
  })
  expect(grantResp.status(), '追加授权须 200').toBe(200)

  // 重新登录拉取最新 buttons → 全部写按钮可见
  await logout(page)
  await login(page, { username: USERNAME, password: PASSWORD })
  await page.goto('/#/system/user')
  await expect(page.getByRole('row', { name: /admin/ }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: '新增用户' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  await expect(page.getByRole('button', { name: '授权' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '重置密码' }).first()).toBeVisible()
})
