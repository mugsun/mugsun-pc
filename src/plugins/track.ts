/**
 * 埋点门面：核心只依赖本文件。启用埋点时由 main 注入 modules/track 实现；否则全部静默 no-op。
 */
import type { App } from 'vue'

type TrackApi = {
  setupTrack: (app: App) => void
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

export function setupTrack(app: App): void {
  api.setupTrack(app)
}

export function trackIdentify(userId: string | number): void {
  api.trackIdentify(userId)
}

export function trackReset(): void {
  api.trackReset()
}
