import request from '@/utils/http'

// ===== 低代码表单 =====
export function fetchFormPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/form/page', params })
}
export function fetchFormDetail(id: number | string) {
  return request.get<any>({ url: '/api/system/form/detail', params: { id } })
}
export function fetchFormByKey(formKey: string) {
  return request.get<any>({ url: `/api/system/form/by-key/${formKey}` })
}
/** 保存表单设计（schema + option） */
export function fetchSubmitForm(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/form/submit', data, showSuccessMessage: true })
}
export function fetchRemoveForm(ids: (number | string)[] | number | string) {
  return request.post<void>({
    url: '/api/system/form/remove',
    data: Array.isArray(ids) ? ids : [ids],
    showSuccessMessage: true
  })
}
/** 运行时填报：保存填报数据 */
export function fetchSubmitFormData(formKey: string, data: Record<string, any>) {
  return request.post<void>({
    url: `/api/system/form/submit-data/${formKey}`,
    data,
    showSuccessMessage: true
  })
}
/** 填报记录 */
export function fetchFormData(formKey: string, params: Record<string, any>) {
  return request.get<any>({ url: `/api/system/form/data/${formKey}`, params })
}
