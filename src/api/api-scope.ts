import request from '@/utils/http'

export function fetchApiScopePage(params: Record<string, unknown>) {
  return request.get<any>({ url: '/api/system/api-scope/page', params })
}

export function fetchSaveApiScope(data: Record<string, unknown>) {
  return request.post<void>({ url: '/api/system/api-scope/submit', data, showSuccessMessage: true })
}

export function fetchRemoveApiScope(ids: Array<string | number>) {
  return request.post<void>({
    url: '/api/system/api-scope/remove',
    data: ids,
    showSuccessMessage: true
  })
}

export function fetchApiScopeRoles(id: string | number) {
  return request.get<{
    roles: Array<{ id: string; roleName: string; roleCode: string }>
    checked: string[]
  }>({
    url: '/api/system/api-scope/roles',
    params: { id }
  })
}

export function fetchGrantApiScope(id: string | number, roleIds: string[]) {
  return request.post<void>({
    url: '/api/system/api-scope/grant',
    data: { id, roleIds },
    showSuccessMessage: true
  })
}
