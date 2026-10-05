import request from '@/utils/http'

export function fetchTopMenuPage(params: Record<string, unknown>) {
  return request.get<any>({ url: '/api/system/top-menu/page', params })
}

export function fetchSaveTopMenu(data: Record<string, unknown>) {
  return request.post<void>({ url: '/api/system/top-menu/submit', data, showSuccessMessage: true })
}

export function fetchRemoveTopMenu(ids: Array<string | number>) {
  return request.post<void>({
    url: '/api/system/top-menu/remove',
    data: ids,
    showSuccessMessage: true
  })
}

export function fetchTopMenuGrant(id: string | number) {
  return request.get<{ tree: any[]; checked: string[] }>({
    url: '/api/system/top-menu/menus',
    params: { id }
  })
}

export function fetchGrantTopMenu(id: string | number, menuIds: Array<string | number>) {
  return request.post<void>({
    url: '/api/system/top-menu/grant',
    data: { id, menuIds },
    showSuccessMessage: true
  })
}

export function fetchTopMenuHome(id: string | number) {
  return request.post<void>({
    url: '/api/system/top-menu/home',
    data: { id },
    showSuccessMessage: true
  })
}

export interface TopMenuScheme {
  id: string
  name: string
  code: string
  icon?: string
  path?: string
  home: boolean
  menuIds: string[]
}

export function fetchMyTopMenus() {
  return request.get<TopMenuScheme[]>({ url: '/api/system/top-menu/mine' })
}
