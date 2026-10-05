import request from '@/utils/http'

export function fetchNotifyChannelPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/notify/channel/page', params })
}
export function fetchSaveNotifyChannel(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/notify/channel/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveNotifyChannel(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/notify/channel/remove',
    data: ids,
    showSuccessMessage: true
  })
}

export function fetchNotifyTemplatePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/notify/template/page', params })
}
export function fetchSaveNotifyTemplate(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/notify/template/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveNotifyTemplate(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/notify/template/remove',
    data: ids,
    showSuccessMessage: true
  })
}
