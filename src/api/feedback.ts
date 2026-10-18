import request from '@/utils/http'
import { TRACE_HEADER } from '@/utils/http/traceId'

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
  return request.post<void>({
    url: '/api/system/feedback/submit',
    data,
    showSuccessMessage: true
  })
}

/** 后台反馈分页 */
export function fetchFeedbackPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/feedback/page', params })
}

/** 切换处理状态 */
export function fetchFeedbackStatus(id: number | string) {
  return request.post<void>({
    url: `/api/system/feedback/status/${id}`,
    showSuccessMessage: true
  })
}

/** 删除反馈 */
export function fetchRemoveFeedback(ids: (number | string)[]) {
  return request.post<void>({
    url: '/api/system/feedback/remove',
    data: ids,
    showSuccessMessage: true
  })
}

// ------------------------- 版本更新记录 -------------------------
/**
 * 首页最近更新（后端 GET /system/changelog/recent：登录即可，limit 夹到 1–20，默认 5；
 * 只返 id/version/type/title/publishTime，按发布时间倒序）。
 * 工作台卡片自己展示错误态（含错误编号），所以不弹全局 toast；
 * traceId 放进 X-Trace-Id 头，后端沿用它作为本次请求的链路编号。
 */
export function fetchChangelogRecent(limit = 5, opts: { traceId?: string } = {}) {
  return request.get<any[]>({
    url: '/api/system/changelog/recent',
    params: { limit },
    showErrorMessage: false,
    headers: opts.traceId ? { [TRACE_HEADER]: opts.traceId } : undefined
  })
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
