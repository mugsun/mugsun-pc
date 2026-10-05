import request from '@/utils/http'

// ------------------------- 站内信 -------------------------
/** 当前用户未读数（顶栏角标） */
export function fetchMsgUnreadCount() {
  return request.get<number>({ url: '/api/system/message/unread-count' })
}

/** 顶栏下拉最近消息 */
export function fetchMsgRecent(limit = 8) {
  return request.get<any[]>({ url: '/api/system/message/recent', params: { limit } })
}

/** 我的消息分页 */
export function fetchMyMessagePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/message/my/page', params })
}

/** 标记单条已读 */
export function fetchReadMessage(messageId: number | string) {
  return request.post<void>({
    url: `/api/system/message/read/${messageId}`,
    data: {},
    showSuccessMessage: true
  })
}

/** 全部已读 */
export function fetchReadAllMessage() {
  return request.post<void>({
    url: '/api/system/message/read-all',
    data: {},
    showSuccessMessage: true
  })
}

/** 删除我的消息 */
export function fetchRemoveMyMessage(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/message/remove',
    data: ids,
    showSuccessMessage: true
  })
}

/** 发送站内信 */
export function fetchSendMessage(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/message/send',
    data,
    showSuccessMessage: true
  })
}

/** 用户下拉（收件人选择）：keyword 远程搜索（用户名/昵称模糊，后端封顶 50 条）；ids 精确取（编辑回显） */
export function fetchUserSelect(params?: { keyword?: string; ids?: string }) {
  return request.get<Array<{ label: string; value: number }>>({
    url: '/api/system/user/select',
    params
  })
}

// ------------------------- 消息模板 -------------------------
export function fetchMsgTemplateList() {
  return request.get<any[]>({ url: '/api/system/message-template/list' })
}

export function fetchMsgTemplatePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/message-template/page', params })
}

export function fetchMsgTemplateDetail(id: number | string) {
  return request.get<any>({ url: '/api/system/message-template/detail', params: { id } })
}

export function fetchSaveMsgTemplate(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/message-template/submit',
    data,
    showSuccessMessage: true
  })
}

export function fetchRemoveMsgTemplate(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/message-template/remove',
    data: ids,
    showSuccessMessage: true
  })
}
