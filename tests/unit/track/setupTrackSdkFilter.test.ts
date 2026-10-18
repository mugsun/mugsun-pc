/**
 * 用真实 SDK（Vue 适配层 + errorPlugin）跑一遍过滤路径：显式 false 上报、显式 true 跳过。
 * 不依赖 SDK 默认值。CI 固定的旧版 SDK 没有 skipHandledErrors（没有 isIgnoredError），
 * 显式 true 一项在那种 SDK 上跳过。
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { TrackClient } from '@mugsun/track-web'
import { HttpError } from '@/utils/http/error'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
vi.mock('@/router', () => ({
  router: { afterEach: () => () => {}, currentRoute: { value: { path: '/', matched: [] } } }
}))
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ accessToken: '' }) }))
vi.mock('@mugsun/track-web/replay', () => ({
  replayPlugin: () => ({ name: 'replay', setup() {} })
}))
// 只保留 errorPlugin 的真实实现，其它采集插件换成空插件，避免 jsdom 下的无关副作用
vi.mock('@mugsun/track-web', async (importOriginal) => {
  const real = await importOriginal<typeof import('@mugsun/track-web')>()
  const noop = (name: string) => () => ({ name, setup() {} })
  return {
    ...real,
    pageviewPlugin: noop('pageview'),
    pageleavePlugin: noop('pageleave'),
    autocapturePlugin: noop('autocapture'),
    exposurePlugin: noop('exposure'),
    webVitalsPlugin: noop('web-vitals'),
    apiMonitorPlugin: noop('api-monitor'),
    visualTrack: noop('visual-track'),
    geoPlugin: noop('geo')
  }
})

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
  )
})

function setup(skipHandledErrors: boolean) {
  return import('../../../modules/track/plugin').then(({ setupTrack }) => {
    const app = createApp({})
    setupTrack(app, { skipHandledErrors })
    const client = app.config.globalProperties.$track as TrackClient
    const track = vi.spyOn(client, 'track').mockImplementation(() => {})
    return { app, client, track }
  })
}

const handled = () => Object.assign(new HttpError('请填写应用名称', 400), { handled: true })
const errorCalls = (track: { mock: { calls: unknown[][] } }) =>
  track.mock.calls.filter(([name]) => name === '$error').length

describe('真实 SDK 过滤路径', () => {
  it('显式 false：Vue errorHandler 里的已处理 HttpError 上报 $error', async () => {
    const { app, track } = await setup(false)
    app.config.errorHandler!(handled(), null, 'setup')
    expect(errorCalls(track)).toBe(1)
  })

  it('显式 true：已处理 HttpError 不上报，普通错误照常上报', async (ctx) => {
    const { app, client, track } = await setup(true)
    if (typeof (client as { isIgnoredError?: unknown }).isIgnoredError !== 'function') {
      ctx.skip()
    }
    app.config.errorHandler!(handled(), null, 'setup')
    expect(errorCalls(track)).toBe(0)
    app.config.errorHandler!(new Error('real'), null, 'setup')
    expect(errorCalls(track)).toBe(1)
  })
})
