import request from '@/utils/http'

// ------------------------- 意见反馈 -------------------------
/** 上传附件，返回 SysAttach（id/name/url） */
export function uploadFeedbackFile(file: File) {
  const data = new FormData()
  data.append('file', file)
  data.append('access', 'public')
  return request.post<any>({ url: '/api/system/file/upload', data })
}

/** 用户提交反馈 */
export function submitFeedback(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/feedback/submit', data })
}

/** 后台反馈分页 */
export function fetchFeedbackPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/feedback/page', params })
}

/** 切换处理状态 */
export function fetchFeedbackStatus(id: number | string) {
  return request.post<void>({ url: `/api/system/feedback/status/${id}` })
}

/** 删除反馈 */
export function fetchRemoveFeedback(ids: (number | string)[]) {
  return request.post<void>({ url: '/api/system/feedback/remove', data: ids })
}

// ------------------------- 版本更新记录 -------------------------
/** 首页最近更新 */
export function fetchChangelogRecent(limit = 5) {
  return request.get<any[]>({ url: '/api/system/changelog/recent', params: { limit } })
}

export function fetchChangelogPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/changelog/page', params })
}

export function fetchChangelogDetail(id: number | string) {
  return request.get<any>({ url: '/api/system/changelog/detail', params: { id } })
}

export function fetchSaveChangelog(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/changelog/submit',
    data,
    showSuccessMessage: true
  })
}

export function fetchRemoveChangelog(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/changelog/remove',
    data: ids,
    showSuccessMessage: true
  })
}
