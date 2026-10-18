import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
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

type Reply = { status: number; data: unknown }
let reply: Reply = { status: 200, data: null }

/** 所有请求走这个假适配器；非 2xx 按 axios 的约定抛 AxiosError */
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const response = {
    data: reply.data,
    status: reply.status,
    statusText: String(reply.status),
    headers: { 'content-type': 'application/json' },
    config
  }
  if (reply.status >= 200 && reply.status < 300) return response
  throw new AxiosError(
    `Request failed with status code ${reply.status}`,
    AxiosError.ERR_BAD_RESPONSE,
    config,
    null,
    response
  )
}

let fetchGisStatus: typeof import('../../../modules/gis/api').fetchGisStatus
let setApiErrorReporter: typeof import('@/utils/http/api-error-report').setApiErrorReporter

beforeAll(async () => {
  // utils/http 的 axios 实例在模块加载时 create，先设默认适配器再加载
  axios.defaults.adapter = adapter
  ;({ fetchGisStatus } = await import('../../../modules/gis/api'))
  ;({ setApiErrorReporter } = await import('@/utils/http/api-error-report'))
})

beforeEach(() => {
  elError.mockReset()
  setApiErrorReporter(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

const OFF = { enabled: false, providers: [], terrainUrl: '', tilesets: [] }

describe('fetchGisStatus：404 防御性容错，按 GIS 未启用兜底', () => {
  it('HTTP 404 → enabled:false 空状态，不弹错（非 silent 也不弹）', async () => {
    reply = { status: 404, data: { code: 404, msg: 'Not Found' } }
    await expect(fetchGisStatus()).resolves.toEqual(OFF)
    await expect(fetchGisStatus({ silent: true })).resolves.toEqual(OFF)
    expect(elError).not.toHaveBeenCalled()
  })

  it('HTTP 404 不触发 reportApiError（错误拦截器路径不上报）', async () => {
    const reporter = vi.fn()
    setApiErrorReporter(reporter)
    reply = { status: 404, data: { code: 404, msg: 'Not Found' } }
    await expect(fetchGisStatus()).resolves.toEqual(OFF)
    await expect(fetchGisStatus({ silent: true })).resolves.toEqual(OFF)
    expect(reporter).not.toHaveBeenCalled()
    expect(elError).not.toHaveBeenCalled()
  })

  it('HTTP 404 且响应体不是信封 → 同样 enabled:false', async () => {
    reply = { status: 404, data: '' }
    await expect(fetchGisStatus()).resolves.toEqual(OFF)
    expect(elError).not.toHaveBeenCalled()
  })

  it('HTTP 200 + 信封 code 404 → enabled:false，不弹错', async () => {
    reply = { status: 200, data: { code: 404, msg: 'GIS 未启用' } }
    await expect(fetchGisStatus()).resolves.toEqual(OFF)
    await expect(fetchGisStatus({ silent: true })).resolves.toEqual(OFF)
    expect(elError).not.toHaveBeenCalled()
  })

  it('信封 404（容错分支）仍会经成功拦截器上报一次：showErrorMessage 不影响上报，保持现状', async () => {
    const reporter = vi.fn()
    setApiErrorReporter(reporter)
    reply = { status: 200, data: { code: 404, msg: 'GIS 未启用' } }
    await fetchGisStatus({ silent: true })
    expect(reporter).toHaveBeenCalledTimes(1)
    expect(reporter).toHaveBeenCalledWith(expect.objectContaining({ status: 200, bizCode: 404 }))
  })

  it('正常响应原样返回', async () => {
    const ok = {
      enabled: true,
      providers: [{ provider: 'xyz', configured: true, enabled: true }],
      terrainUrl: '',
      tilesets: []
    }
    reply = { status: 200, data: { code: 200, msg: 'ok', data: ok } }
    await expect(fetchGisStatus()).resolves.toEqual(ok)
  })
})

describe('fetchGisStatus：其他错误保持原行为', () => {
  it('HTTP 500 照旧抛出并弹 toast', async () => {
    reply = { status: 500, data: { code: 500, msg: '服务器开小差了' } }
    await expect(fetchGisStatus()).rejects.toMatchObject({ code: 500, handled: true })
    expect(elError).toHaveBeenCalledTimes(1)
    expect(elError).toHaveBeenCalledWith('服务器开小差了')
  })

  it('HTTP 500 + silent → 抛出但不弹 toast', async () => {
    reply = { status: 500, data: { code: 500, msg: '服务器开小差了' } }
    await expect(fetchGisStatus({ silent: true })).rejects.toMatchObject({
      code: 500,
      handled: false
    })
    expect(elError).not.toHaveBeenCalled()
  })

  it('信封业务失败（非 404）照旧抛出并弹 toast', async () => {
    reply = { status: 200, data: { code: 50001, msg: '状态查询失败' } }
    await expect(fetchGisStatus()).rejects.toMatchObject({ bizCode: 50001 })
    expect(elError).toHaveBeenCalledWith('状态查询失败')
  })
})
