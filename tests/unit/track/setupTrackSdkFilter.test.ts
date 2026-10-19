/**
 * 护栏：用真实 SDK（Vue 适配层 + errorPlugin）跑过滤路径，SDK 需 ≥ mugsun-track#19（5d2dbf3，
 * CI 的 TRACK_REF 即此提交）。三条必须都在：
 * - 取消的请求（isCanceledError）不上报；
 * - 不传参数时，已处理的 HttpError 上报 1 条 $error（SDK 默认 skipHandledErrors=false）；
 * - 显式 skipHandledErrors=true 时不上报。
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

function setup(skipHandledErrors?: boolean) {
  return import('../../../modules/track/plugin').then(({ setupTrack }) => {
    const app = createApp({})
    if (skipHandledErrors === undefined) setupTrack(app)
    else setupTrack(app, { skipHandledErrors })
    const client = app.config.globalProperties.$track as TrackClient
    const track = vi.spyOn(client, 'track').mockImplementation(() => {})
    return { app, client, track }
  })
}

const handled = () => Object.assign(new HttpError('请填写应用名称', 400), { handled: true })
const errorCalls = (track: { mock: { calls: unknown[][] } }) =>
  track.mock.calls.filter(([name]) => name === '$error').length

function rejection(reason: unknown): Event {
  const e = new Event('unhandledrejection')
  Object.defineProperty(e, 'reason', { value: reason })
  return e
}

describe('真实 SDK 过滤路径', () => {
  it('不传参：一个已处理的 HttpError 上报 1 条 $error', async () => {
    const { app, client, track } = await setup()
    expect(Object.prototype.hasOwnProperty.call(client.options, 'skipHandledErrors')).toBe(true)
    expect((client.options as { skipHandledErrors?: unknown }).skipHandledErrors).toBe(false)
    app.config.errorHandler!(handled(), null, 'setup')
    expect(errorCalls(track)).toBe(1)
  })

  it('显式 true：已处理 HttpError 不上报，普通错误照常上报', async () => {
    const { app, track } = await setup(true)
    app.config.errorHandler!(handled(), null, 'setup')
    expect(errorCalls(track)).toBe(0)
    app.config.errorHandler!(new Error('real'), null, 'setup')
    expect(errorCalls(track)).toBe(1)
  })

  it('显式 false：已处理 HttpError 上报 $error', async () => {
    const { app, track } = await setup(false)
    app.config.errorHandler!(handled(), null, 'setup')
    expect(errorCalls(track)).toBe(1)
  })

  it('取消的请求（isCanceledError）不上报 $error，Vue errorHandler 与 unhandledrejection 都是', async () => {
    const { app, track } = await setup()
    app.config.errorHandler!(new HttpError('请求已取消', 400, { canceled: true }), null, 'setup')
    app.config.errorHandler!(
      Object.assign(new Error('canceled'), { name: 'CanceledError' }),
      null,
      'setup'
    )
    window.dispatchEvent(rejection(new HttpError('请求已取消', 400, { canceled: true })))
    window.dispatchEvent(rejection(Object.assign(new Error('x'), { code: 'ERR_CANCELED' })))
    expect(errorCalls(track)).toBe(0)
    app.config.errorHandler!(new Error('real'), null, 'setup')
    expect(errorCalls(track)).toBe(1)
  })
})
