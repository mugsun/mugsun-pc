import request from '@/utils/http'

// ===== 租户独立数据源配置 =====
export function fetchTenantDatasourcePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/tenant-datasource/page', params })
}
export function fetchSubmitTenantDatasource(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/tenant-datasource/submit', data })
}
export function fetchRemoveTenantDatasource(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/tenant-datasource/remove',
    data: Array.isArray(ids) ? ids : [ids]
  })
}

// ===== 演示业务：客户（按租户数据源路由） =====
export function fetchCustomerPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/customer/page', params })
}
export function fetchSubmitCustomer(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/customer/submit', data, showSuccessMessage: true })
}
export function fetchRemoveCustomer(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/customer/remove',
    data: Array.isArray(ids) ? ids : [ids],
    showSuccessMessage: true
  })
}
