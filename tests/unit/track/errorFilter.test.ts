import { describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import type { PluginContext, TrackPlugin } from '@mugsun/track-web'
import { HttpError } from '@/utils/http/error'
import {
  bypassHandledErrorsInVueHandler,
  filterHandledErrors
} from '../../../modules/track/error-filter'

// HttpError 所在模块依赖语言包与 store，单测只需 $t 占位
vi.mock('@/locales', () => ({ $t: (k: string) => k }))

function rejection(reason: unknown): Event {
  const e = new Event('unhandledrejection')
  Object.defineProperty(e, 'reason', { value: reason })
  return e
}

/** 模拟 SDK errorPlugin：unhandledrejection 时发 $error */
const fakeErrorPlugin = (): TrackPlugin => ({
  name: 'error',
  setup(ctx: PluginContext) {
    const on = () => ctx.client.track('$error', { error_type: 'promise' })
    window.addEventListener('unhandledrejection', on)
    return () => window.removeEventListener('unhandledrejection', on)
  }
})

describe('filterHandledErrors', () => {
  it('HttpError 的 unhandledrejection 不上报，其它错误照常上报', async () => {
    const track = vi.fn()
    const ctx = { client: { track }, options: {} } as unknown as PluginContext
    const teardown = filterHandledErrors(fakeErrorPlugin()).setup(ctx) as () => void

    window.dispatchEvent(rejection(new HttpError('请填写应用名称', 400)))
    await Promise.resolve()
    expect(track).not.toHaveBeenCalled()

    window.dispatchEvent(rejection(new Error('boom')))
    expect(track).toHaveBeenCalledTimes(1)
    teardown()
  })
})

describe('bypassHandledErrorsInVueHandler', () => {
  it('HttpError 绕过 SDK handler，交给原 handler', () => {
    const app = createApp({})
    const previous = vi.fn()
    const sdk = vi.fn()
    app.config.errorHandler = sdk
    bypassHandledErrorsInVueHandler(app, previous)

    app.config.errorHandler!(new HttpError('x', 400), null, 'setup')
    expect(sdk).not.toHaveBeenCalled()
    expect(previous).toHaveBeenCalledTimes(1)

    app.config.errorHandler!(new Error('real'), null, 'setup')
    expect(sdk).toHaveBeenCalledTimes(1)
  })
})
