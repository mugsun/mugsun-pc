import request from '@/utils/http'

// ------------------------- 目录（树形） -------------------------
export function fetchHelpCatalogTree() {
  return request.get<any[]>({ url: '/api/system/help/catalog/tree' })
}
export function fetchSaveHelpCatalog(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/help/catalog/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveHelpCatalog(id: number | string) {
  return request.post<void>({
    url: `/api/system/help/catalog/remove/${id}`,
    showSuccessMessage: true
  })
}

// ------------------------- 文档 -------------------------
export function fetchHelpDocPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/help/doc/page', params })
}
export function fetchHelpDocDetail(id: number | string) {
  return request.get<any>({ url: '/api/system/help/doc/detail', params: { id } })
}
export function fetchSaveHelpDoc(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/help/doc/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveHelpDoc(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/help/doc/remove',
    data: ids,
    showSuccessMessage: true
  })
}

// ------------------------- 页面绑定 -------------------------
export function fetchHelpBindingList(docId: number | string) {
  return request.get<any[]>({ url: '/api/system/help/binding/list', params: { docId } })
}
export function fetchSaveHelpBinding(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/help/binding/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveHelpBinding(id: number | string) {
  return request.post<void>({
    url: `/api/system/help/binding/remove/${id}`,
    showSuccessMessage: true
  })
}

// ------------------------- 前台：按路由查阅 + 浏览量 -------------------------
export function fetchHelpPageDocs(routePath: string) {
  return request.get<any[]>({ url: '/api/system/help/page-docs', params: { routePath } })
}
export function fetchViewHelpDoc(id: number | string) {
  return request.post<any>({ url: `/api/system/help/view/${id}` })
}
