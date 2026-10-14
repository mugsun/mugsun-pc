/**
 * 接口错误上报调用点（核心不依赖埋点模块）。
 *
 * HTTP 200 但业务码失败时，axios 层面是成功，SDK 的 apiMonitorPlugin 记不到失败；
 * 埋点模块启用时，由 modules/track 注册上报函数（SDK 有 trackApiError 才注册），
 * 未注册时为 no-op。
 */
export interface ApiErrorPayload {
  url?: string
  method?: string
  /** HTTP 状态（业务失败时为 200；网络异常为 0） */
  status: number
  /** 业务码 R.code */
  bizCode?: number
  message: string
}

export type ApiErrorReporter = (payload: ApiErrorPayload) => void

let reporter: ApiErrorReporter | null = null

export function setApiErrorReporter(next: ApiErrorReporter | null): void {
  reporter = next
}

export function reportApiError(payload: ApiErrorPayload): void {
  if (!reporter) return
  try {
    reporter(payload)
  } catch {
    // 上报失败不影响业务请求
  }
}
