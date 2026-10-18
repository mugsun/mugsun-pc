/**
 * setupTrack 接线：管理台不再拦截已处理错误，skipHandledErrors 只在显式传入时透传给 SDK。
 * SDK 的 Vue 适配层换成桩，只记录收到的选项；不依赖 SDK 自己的默认值。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, type App } from 'vue'
import type { PluginContext, TrackPlugin } from '@mugsun/track-web'
import { HttpError } from '@/utils/http/error'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
vi.mock('@/router', () => ({ router: {} }))
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ accessToken: '' }) }))

const sdk = vi.hoisted(() => ({
  options: null as Record<string, unknown> | null,
  vueHandler: null as null | ((...a: unknown[]) => void)
}))
vi.mock('@mugsun/track-web/vue', () => ({
  default: {
    install(app: App, options: Record<string, unknown>) {
      sdk.options = options
      sdk.vueHandler = vi.fn()
      app.config.errorHandler = sdk.vueHandler
      app.config.globalProperties.$track = { track: vi.fn() }
    }
  }
}))

import { setupTrack } from '../../../modules/track/plugin'

function rejection(reason: unknown): Event {
  const e = new Event('unhandledrejection')
  Object.defineProperty(e, 'reason', { value: reason })
  return e
}

afterEach(() => {
  sdk.options = null
  sdk.vueHandler = null
})

describe('setupTrack 的 skipHandledErrors 透传', () => {
  it('没传时传给 SDK 的选项里没有 skipHandledErrors', () => {
    setupTrack(createApp({}))
    expect(sdk.options).not.toBeNull()
    expect(Object.prototype.hasOwnProperty.call(sdk.options, 'skipHandledErrors')).toBe(false)
  })

  it('传 true 时透传 true', () => {
    setupTrack(createApp({}), { skipHandledErrors: true })
    expect(sdk.options?.skipHandledErrors).toBe(true)
  })

  it('传 false 时透传 false', () => {
    setupTrack(createApp({}), { skipHandledErrors: false })
    expect(sdk.options?.skipHandledErrors).toBe(false)
  })
})

describe('管理台不再拦截已处理错误', () => {
  it('Vue errorHandler 保持为 SDK 的处理器，HttpError 照样交给它', () => {
    const app = createApp({})
    setupTrack(app)
    expect(app.config.errorHandler).toBe(sdk.vueHandler)
    const err = Object.assign(new HttpError('请填写应用名称', 400), { handled: true })
    app.config.errorHandler!(err, null, 'setup')
    expect(sdk.vueHandler).toHaveBeenCalledWith(err, null, 'setup')
  })

  it('unhandledrejection 里的 HttpError / handled / expected 都交到 SDK 的采集入口', () => {
    setupTrack(createApp({}))
    const plugins = sdk.options?.plugins as TrackPlugin[]
    const error = plugins.find((p) => p.name === 'error')!
    const track = vi.fn()
    // 不在接入层过滤：SDK 自己的过滤一律放行，只看错误能否到达 client.track
    const ctx = {
      client: { track, isIgnoredError: () => false },
      options: {}
    } as unknown as PluginContext
    const teardown = error.setup(ctx) as () => void
    const reasons = [
      new HttpError('网络连接异常', 0),
      Object.assign(new HttpError('x', 400), { handled: true }),
      Object.assign(new Error('a'), { handled: true }),
      Object.assign(new Error('b'), { expected: true })
    ]
    for (const r of reasons) window.dispatchEvent(rejection(r))
    teardown()
    const errorEvents = track.mock.calls.filter(([name]) => name === '$error')
    expect(errorEvents).toHaveLength(reasons.length)
  })
})
