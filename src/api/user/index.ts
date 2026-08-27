import request from '@/utils/http'
import type { UserPage, UserPageQuery, UserForm, UserVO, UserQuery, UserImportResult } from './type'

/** 用户分页（强类型：返回 openapi 生成的 PageSysUser） */
export function fetchUserPage(params: UserPageQuery) {
  return request.get<UserPage>({ url: '/api/system/user/page', params })
}

/** 用户详情 */
export function fetchUserDetail(id: number | string) {
  return request.get<UserVO>({ url: '/api/system/user/detail', params: { id } })
}

/** 保存用户（新增/编辑同端点） */
export function saveUser(data: UserForm) {
  return request.post<void>({ url: '/api/system/user/submit', data })
}

/** 删除用户（批量 id 数组） */
export function removeUser(ids: Array<number | string>) {
  return request.post<void>({ url: '/api/system/user/remove', data: ids })
}

/** 启用/停用用户 */
export function updateUserStatus(id: number | string, status: number) {
  return request.post<void>({ url: '/api/system/user/status', data: { id, status } })
}

/** 重置密码为默认（批量 id 数组） */
export function resetUserPassword(ids: Array<number | string>) {
  return request.post<void>({ url: '/api/system/user/reset-password', data: ids })
}

/** 用户已授权角色 id（回显） */
export function fetchUserRoleIds(userId: number | string) {
  return request.get<Array<number | string>>({
    url: '/api/system/user/role-ids',
    params: { userId }
  })
}

/** 用户授权角色（body 信封 {userId, roleIds}） */
export function grantUser(userId: number | string, roleIds: Array<number | string>) {
  return request.post<void>({ url: '/api/system/user/grant', data: { userId, roleIds } })
}

/** 导出用户（按查询条件，授权流式下载；手机号由后端按字段级权限裁决明文/脱敏） */
export function exportUser(params?: UserQuery) {
  return request.download({ url: '/api/system/user/export', params, filename: '用户数据.xlsx' })
}

/** 下载用户导入模板（表头 + 一行示例） */
export function downloadUserImportTemplate() {
  return request.download({
    url: '/api/system/user/import-template',
    filename: '用户导入模板.xlsx'
  })
}

/** 导入用户（multipart 上传；updateSupport=true 覆盖更新已存在账号，返回成败明细） */
export function importUser(file: File, updateSupport: boolean) {
  const form = new FormData()
  form.append('file', file)
  form.append('updateSupport', String(updateSupport))
  return request.post<UserImportResult>({ url: '/api/system/user/import', data: form })
}

/** 切换是否主管（is_leader 0↔1）；须走 query（后端 @RequestParam，不可被 http 层 params→body 转换） */
export function setUserLeader(userId: number | string) {
  return request.post<void>({ url: `/api/system/user/set-leader?userId=${userId}` })
}

/** 当前用户的直属主管信息 */
export function fetchLeaderInfo(userId: number | string) {
  return request.get<UserVO[]>({
    url: '/api/system/user/leader-info',
    params: { userId }
  })
}

/** 主管候选列表（is_leader=1，供选直属主管） */
export function fetchLeaderList(realName?: string) {
  return request.get<Array<{ value: number | string; label: string; realName?: string }>>({
    url: '/api/system/user/leader-list',
    params: realName ? { realName } : undefined
  })
}
