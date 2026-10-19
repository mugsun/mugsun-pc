/**
 * 埋点错误上报的接入层辅助。
 *
 * 已处理错误（HttpError、handled===true / expected===true）是否进错误监控，
 * 统一交给 SDK 的 skipHandledErrors 开关决定（setupTrack 可透传），管理台不再自行拦截：
 * 跳过能力保留，只是改由 SDK 开关控制。HttpError 上的 name / handled 标记仍保留，供 SDK 判定。
 */

/** 新版 SDK 提供 trackApiError；旧版没有，调用前用类型守卫判断 */
export interface ApiErrorCapable {
  trackApiError(payload: {
    url?: string
    method?: string
    status: number
    bizCode?: number
    message: string
  }): void
}

export function hasTrackApiError(client: unknown): client is ApiErrorCapable {
  return !!client && typeof (client as { trackApiError?: unknown }).trackApiError === 'function'
}
