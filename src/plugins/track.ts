/**
 * 埋点门面：核心只依赖本文件。启用埋点时由 main 注入 modules/track 实现；否则全部静默 no-op。
 */
import type { App } from 'vue'

/** setupTrack 可选项，透传给埋点 SDK；不传的键由 SDK 用自己的默认值 */
export interface TrackSetupOptions {
  /** 是否跳过已处理错误（HttpError、handled / expected 标记）的 $error 上报 */
  skipHandledErrors?: boolean
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
