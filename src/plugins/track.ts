/**
 * 埋点门面：核心只依赖本文件。启用埋点时由 main 注入 modules/track 实现；否则全部静默 no-op。
 */
import type { App } from 'vue'

/** setupTrack 可选项，透传给埋点 SDK；不传的键由 SDK 用自己的默认值 */
export interface TrackSetupOptions {
  /**
   * 是否跳过已处理错误（HttpError、handled===true / expected===true）的 $error 上报。
   * 不传时不带这个键，由 SDK 按自己的默认值处理；传 true 跳过，传 false 全部上报。
   */
  skipHandledErrors?: boolean
}

/**
 * 从构建变量读出 setupTrack 选项。
 * VITE_TRACK_SKIP_HANDLED_ERRORS：未设置（或空）不传；trim 后不区分大小写只认 true / false；
 * 其他值 console.warn 后不传，交给 SDK 默认值。
 */
export function trackSetupOptionsFromEnv(env: {
  VITE_TRACK_SKIP_HANDLED_ERRORS?: string
}): TrackSetupOptions {
  const raw = env.VITE_TRACK_SKIP_HANDLED_ERRORS
  if (raw === undefined) return {}
  const v = String(raw).trim().toLowerCase()
  if (v === '') return {}
  if (v === 'true') return { skipHandledErrors: true }
  if (v === 'false') return { skipHandledErrors: false }
  console.warn(
    `[track] VITE_TRACK_SKIP_HANDLED_ERRORS 只接受 true / false，收到 "${raw}"，已忽略（使用 SDK 默认值）`
  )
  return {}
}

type TrackApi = {
  setupTrack: (app: App, options?: TrackSetupOptions) => void
  trackIdentify: (userId: string | number) => void
  trackReset: () => void
}

const noop: TrackApi = {
  setupTrack() {},
  trackIdentify() {},
  trackReset() {}
}

let api: TrackApi = noop

/** 注入真实埋点实现（仅 VITE_ENABLE_TRACK !== 'false' 且 modules/track 存在时调用） */
export function installTrackApi(next: TrackApi): void {
  api = next
}

export function setupTrack(app: App, options?: TrackSetupOptions): void {
  api.setupTrack(app, options)
}

export function trackIdentify(userId: string | number): void {
  api.trackIdentify(userId)
}

export function trackReset(): void {
  api.trackReset()
}
