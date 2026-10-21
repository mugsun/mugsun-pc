import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { AxiosError } from 'axios'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({ accessToken: '', logOut: vi.fn() })
}))
const elError = vi.fn()
// ElMessage 由 unplugin-auto-import 注入为全局
vi.stubGlobal('ElMessage', { error: (...a: unknown[]) => elError(...a), success: vi.fn() })
vi.mock('element-plus', () => ({
  ElLoading: { service: () => ({ close: vi.fn() }) }
}))

import api from '@/utils/http'
import {
  HttpError,
  handleError,
  isDuplicateSubmitError,
  isNetworkError,
  showError
} from '@/utils/http/error'
import { ApiStatus } from '@/utils/http/status'
import { setApiErrorReporter } from '@/utils/http/api-error-report'

const ok =
  (data: unknown, status = 200): AxiosAdapter =>
  async (config: InternalAxiosRequestConfig) => ({
    data,
    status,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config
  })

beforeEach(() => {
  elError.mockReset()
  setApiErrorReporter(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('网络异常（UX-009）', () => {
  it('无响应时 code 为 0、errorKind 为 network，不再是 400', () => {
    const axiosErr = new AxiosError('Network Error', 'ERR_NETWORK', {
      url: '/api/system/x',
      method: 'get'
    } as InternalAxiosRequestConfig)
    let caught: unknown
    try {
      handleError(axiosErr)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(HttpError)
    const err = caught as HttpError
    expect(err.code).toBe(ApiStatus.network)
    expect(err.code).toBe(0)
    expect(err.errorKind).toBe('network')
    expect(isNetworkError(err)).toBe(true)
    expect(err.toLogData().error_kind).toBe('network')
  })
})

describe('handled 标记（UX-007）', () => {
  it('toast 之后打上 handled=true；静默请求不打', () => {
    const shown = new HttpError('x', 400)
    showError(shown, true)
    expect(elError).toHaveBeenCalledWith('x')
    expect(shown.handled).toBe(true)

    const silent = new HttpError('y', 400)
    showError(silent, false)
    expect(silent.handled).toBe(false)
  })

  it('request 失败后抛出的 HttpError 已带 handled', async () => {
    await expect(
      api.get({ url: '/biz-fail-1', adapter: ok({ code: 40001, msg: '请填写应用名称' }) })
    ).rejects.toMatchObject({ handled: true, bizCode: 40001, errorKind: 'business' })
  })
})

describe('业务失败带 biz_code 并上报（HTTP 200 + R.code 失败）', () => {
  it('注册了上报函数时调用一次，带 status=200 与 bizCode', async () => {
    const report = vi.fn()
    setApiErrorReporter(report)
    await expect(
      api.post({ url: '/biz-fail-2', data: { a: 1 }, adapter: ok({ code: 40012, msg: '太频繁' }) })
    ).rejects.toBeInstanceOf(HttpError)
    expect(report).toHaveBeenCalledWith({
      url: '/biz-fail-2',
      method: 'POST',
      status: 200,
      bizCode: 40012,
      message: '太频繁'
    })
  })

  it('没注册（旧版 SDK 无 trackApiError）时不报错', async () => {
    await expect(
      api.get({ url: '/biz-fail-3', adapter: ok({ code: 500, msg: 'x' }) })
    ).rejects.toMatchObject({ bizCode: 500 })
  })

  it('成功响应不上报', async () => {
    const report = vi.fn()
    setApiErrorReporter(report)
    await expect(
      api.get({ url: '/ok', adapter: ok({ code: 200, msg: 'ok', data: 1 }) })
    ).resolves.toBe(1)
    expect(report).not.toHaveBeenCalled()
  })
})

describe('防重复提交拦截带显式标记', () => {
  it('相同变更请求在途时第二次被拦下：isDuplicateSubmit=true，请求不发出；正常错误不带该标记', async () => {
    let release!: () => void
    const calls: string[] = []
    const slow: AxiosAdapter = (config) => {
      calls.push(String(config.url))
      return new Promise((resolve) => {
        release = () =>
          resolve({
            data: { code: 200, msg: 'ok', data: null },
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            config
          })
      })
    }
    const req = { url: '/api/system/dup', data: { a: 1 }, adapter: slow, showErrorMessage: false }
    const first = api.post(req)
    const second = api.post(req)
    const err = (await second.catch((e: unknown) => e)) as HttpError
    expect(err).toBeInstanceOf(HttpError)
    expect(err.isDuplicateSubmit).toBe(true)
    expect(isDuplicateSubmitError(err)).toBe(true)
    expect(isNetworkError(err)).toBe(false)
    expect(calls).toHaveLength(1)
    release()
    await first

    expect(new HttpError('x', ApiStatus.error).isDuplicateSubmit).toBe(false)
    expect(isDuplicateSubmitError(new Error('x'))).toBe(false)
  })
})
