import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { readAccessToken } from '../fixtures/auth'
import { psqlMain } from './cleanup'

/**
 * 用例前置数据自建。
 *
 * 断言依赖的行必须由用例自己造：曾有用例断言"种子含开发工程师岗位""租户列表首行"，
 * 实际那些行是历次 e2e 残留——残留一清，用例就红。谁断言谁负责造，跑完再清。
 */

/** 带当前会话令牌调后端（走 vite /api 代理，与页面同源） */
export async function apiPost(page: Page, path: string, body: unknown) {
  const token = await readAccessToken(page)
  return page.request.fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    data: body
  })
}

/** 带当前会话令牌读后端 */
export async function apiGet(page: Page, path: string) {
  const token = await readAccessToken(page)
  return page.request.fetch(`/api${path}`, { headers: { Authorization: token } })
}

/** 建岗位并返回 id（同名已存在则复用，便于多个 spec 共用同一岗位名） */
export async function ensurePost(page: Page, postName: string, postCode: string): Promise<string> {
  const existing = psqlMain(
    `SELECT id FROM sys_post WHERE post_name='${postName}' AND is_deleted=0 LIMIT 1;`
  )
  if (existing) return existing
  const resp = await apiPost(page, '/system/post/submit', { postName, postCode, sort: 1 })
  expect(resp.status(), `建岗位 ${postName} 须 200`).toBe(200)
  const id = psqlMain(
    `SELECT id FROM sys_post WHERE post_name='${postName}' AND is_deleted=0 LIMIT 1;`
  )
  expect(id, `岗位 ${postName} 须落库`).not.toBe('')
  return id
}

/** 菜单授权须连父节点一起授：只授叶子，侧边栏没有可挂载的分组，页面进不去 */
const SYSTEM_MENU_ID = '1200000000000000001' // 系统管理（M 型分组）
const USER_MENU_ID = '1200000000000000101' // 用户管理（C 型，sys:user:list）

/**
 * 保证「fronttest 用户 + 数据测试(datatest) 角色」这对夹具在位。
 *
 * 授权驱动侧边栏的场景需要一个"只授了部分菜单"的普通账号；这对夹具早先是手工建的，
 * 角色被某轮清理删掉后 w3-menu / w2-user 就一起红了。这里幂等补齐，不做清理——
 * 它按名字限定、被多个 spec 共用，等价于种子数据。
 */
export async function ensureDataTestRole(page: Page): Promise<string> {
  let roleId = psqlMain(`SELECT id FROM sys_role WHERE role_code='datatest' AND is_deleted=0;`)
  if (!roleId) {
    const resp = await apiPost(page, '/system/role/submit', {
      roleName: '数据测试',
      roleCode: 'datatest',
      sort: 90,
      dataScope: 1
    })
    expect(resp.status(), '建 datatest 角色须 200').toBe(200)
    roleId = psqlMain(`SELECT id FROM sys_role WHERE role_code='datatest' AND is_deleted=0;`)
    expect(roleId, 'datatest 角色须落库').not.toBe('')
  }
  // 基线授权每次校准：角色可能是上一轮留下的、授的是已失效菜单 id。
  // 取并集而非覆盖——场景本身会增减「角色管理」，不能把它抹掉
  const currentResp = await apiGet(page, `/system/role/menu-ids?roleId=${roleId}`)
  const current = (((await currentResp.json()).data as (number | string)[]) || []).map(String)
  const baseline = [SYSTEM_MENU_ID, USER_MENU_ID].filter((id) => !current.includes(id))
  if (baseline.length) {
    const grant = await apiPost(page, '/system/role/grant', {
      roleId,
      menuIds: [...current, ...baseline]
    })
    expect(grant.status(), 'datatest 基线授权须 200').toBe(200)
  }
  // fronttest 挂该角色（幂等）
  const bound = psqlMain(
    `SELECT count(*) FROM sys_user_role WHERE role_id=${roleId} AND user_id IN (SELECT id FROM sys_user WHERE username='fronttest');`
  )
  if (Number(bound) === 0) {
    psqlMain(
      `INSERT INTO sys_user_role (id, user_id, role_id) SELECT ${roleId} + id, id, ${roleId} FROM sys_user WHERE username='fronttest';`
    )
  }
  return roleId
}

/** 建租户（走一键初始化）并返回租户编号；清理须用 purgeTenant 连带附属数据一起删 */
export async function createTenant(page: Page, tenantName: string): Promise<string> {
  const resp = await apiPost(page, '/system/tenant/create', {
    tenantName,
    linkman: 'E2E联系人'
  })
  expect(resp.status(), `建租户 ${tenantName} 须 200`).toBe(200)
  const body = await resp.json()
  expect(body.code, `建租户 ${tenantName} 业务码须 200`).toBe(200)
  return String(body.data || '')
}
