import request from '@/utils/http'

export function fetchDataScopePage(params: Record<string, unknown>) {
  return request.get<any>({ url: '/api/system/data-scope/page', params })
}

export function fetchDataScopeEffective() {
  return request.get<
    Array<{ table: string; deptColumn: string; userColumn: string; scopeType: number }>
  >({ url: '/api/system/data-scope/effective' })
}

export function fetchSaveDataScope(data: Record<string, unknown>) {
  return request.post<void>({
    url: '/api/system/data-scope/submit',
    data,
    showSuccessMessage: true
  })
}

export function fetchRemoveDataScope(ids: Array<string | number>) {
  return request.post<void>({
    url: '/api/system/data-scope/remove',
    data: ids,
    showSuccessMessage: true
  })
}
