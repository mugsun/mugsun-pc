import { execSync } from 'node:child_process'

/**
 * e2e 数据自清契约。
 *
 * 套件 workers=1 且共享同一套后端/库，用例造的数据若不清，会在库里逐轮堆积
 * （曾积压 6 个 admin、5 条重复默认岗位、6 个 oauth 客户端、4 条同名附件），
 * 把分页、strict mode、列表首行一类断言挤偏——表现为"单跑也失败"。
 *
 * 约定：谁造谁清，一律在 afterAll 里调用本模块，且清理自身不得抛错打断收尾。
 */

const PG_CONTAINER = process.env.E2E_PG_CONTAINER || 'mugsun-pg'
const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER || 'blade-redis'
const REDIS_DB = process.env.E2E_REDIS_DB || '3'

/** 主库执行（返回 stdout；-t 无表头，便于取单值） */
export function psqlMain(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 埋点库执行 */
export function psqlTrack(sql: string): string {
  return execSync(`docker exec ${PG_CONTAINER} psql -U mugsun -d mugsun_track -t -c "${sql}"`, {
    encoding: 'utf-8'
  }).trim()
}

/** 清理动作包裹：afterAll 里的清理失败只告警，不能掩盖用例本身的结论 */
function quiet(label: string, fn: () => string): string {
  try {
    return fn()
  } catch (err) {
    console.warn(`[cleanup] ${label} 失败（不阻断收尾）：${(err as Error).message}`)
    return ''
  }
}

/**
 * 物理清理一个租户及其初始化附属数据。
 *
 * 租户删除在产品语义上是逻辑删（保留数据可追溯），但"一键初始化"会为租户建
 * admin 用户、默认岗位、默认部门与角色。测试造的租户必须连这些一起物理删掉，
 * 否则 sys_user 里的 admin 会越攒越多。
 */
export function purgeTenant(tenantCode: string): void {
  if (!tenantCode) return
  quiet(`purgeTenant(${tenantCode})`, () =>
    psqlMain(
      [
        `DELETE FROM sys_user_role WHERE user_id IN (SELECT id FROM sys_user WHERE tenant_id='${tenantCode}');`,
        `DELETE FROM sys_user WHERE tenant_id='${tenantCode}';`,
        `DELETE FROM sys_role_menu WHERE role_id IN (SELECT id FROM sys_role WHERE tenant_id='${tenantCode}');`,
        `DELETE FROM sys_role_dept WHERE role_id IN (SELECT id FROM sys_role WHERE tenant_id='${tenantCode}');`,
        `DELETE FROM sys_role WHERE tenant_id='${tenantCode}';`,
        `DELETE FROM sys_post WHERE tenant_id='${tenantCode}';`,
        `DELETE FROM sys_dept WHERE tenant_id='${tenantCode}';`,
        `DELETE FROM sys_tenant WHERE tenant_code='${tenantCode}';`
      ].join(' ')
    )
  )
}

/** 物理清理用户（按用户名精确或 LIKE 模式），连带角色/部门关联 */
export function purgeUsers(usernameLike: string): void {
  if (!usernameLike) return
  quiet(`purgeUsers(${usernameLike})`, () =>
    psqlMain(
      [
        `DELETE FROM sys_user_role WHERE user_id IN (SELECT id FROM sys_user WHERE username LIKE '${usernameLike}');`,
        `DELETE FROM sys_user WHERE username LIKE '${usernameLike}';`
      ].join(' ')
    )
  )
}

/**
 * 清掉某账号的登录失败计数与锁定标记（键含租户维度，按后缀匹配删）。
 *
 * 锁键 TTL 内不清，登录日志页会给该账号显示「解锁」按钮，
 * 把别的用例"当前无锁定账号"一类断言带红。
 */
export function clearLoginLock(username: string): void {
  if (!username) return
  quiet(`clearLoginLock(${username})`, () =>
    execSync(
      `docker exec ${REDIS_CONTAINER} sh -c "redis-cli -n ${REDIS_DB} --scan --pattern 'mugsun:login:*${username}' | xargs -r redis-cli -n ${REDIS_DB} DEL"`,
      { encoding: 'utf-8' }
    ).trim()
  )
}

/** 物理清理岗位（按名称 LIKE） */
export function purgePosts(postNameLike: string): void {
  if (!postNameLike) return
  quiet(`purgePosts(${postNameLike})`, () =>
    psqlMain(`DELETE FROM sys_post WHERE post_name LIKE '${postNameLike}';`)
  )
}

/** 物理清理角色（按编码 LIKE），连带菜单/部门授权 */
export function purgeRoles(roleCodeLike: string): void {
  if (!roleCodeLike) return
  quiet(`purgeRoles(${roleCodeLike})`, () =>
    psqlMain(
      [
        `DELETE FROM sys_role_menu WHERE role_id IN (SELECT id FROM sys_role WHERE role_code LIKE '${roleCodeLike}');`,
        `DELETE FROM sys_role_dept WHERE role_id IN (SELECT id FROM sys_role WHERE role_code LIKE '${roleCodeLike}');`,
        `DELETE FROM sys_user_role WHERE role_id IN (SELECT id FROM sys_role WHERE role_code LIKE '${roleCodeLike}');`,
        `DELETE FROM sys_role WHERE role_code LIKE '${roleCodeLike}';`
      ].join(' ')
    )
  )
}

/**
 * 物理清理附件（按文件名 LIKE）。
 *
 * 附件行留着而磁盘文件被清，会让附件页缩略图 404——巡访用例把这些 404 记成
 * console.error，于是 /system/attach 一路红。
 */
export function purgeAttaches(nameLike: string): void {
  if (!nameLike) return
  quiet(`purgeAttaches(${nameLike})`, () =>
    psqlMain(`DELETE FROM sys_attach WHERE name LIKE '${nameLike}';`)
  )
}

/** 物理清理 oauth 客户端（按名称 LIKE），连带调用日志 */
export function purgeOauthClients(nameLike: string): void {
  if (!nameLike) return
  quiet(`purgeOauthClients(${nameLike})`, () =>
    psqlMain(
      [
        `DELETE FROM sys_oauth_log WHERE client_id IN (SELECT client_id FROM sys_oauth_client WHERE name LIKE '${nameLike}');`,
        `DELETE FROM sys_oauth_client WHERE name LIKE '${nameLike}';`
      ].join(' ')
    )
  )
}
