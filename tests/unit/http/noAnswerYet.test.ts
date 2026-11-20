import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'
import { AxiosError } from 'axios'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
vi.mock('@/store/modules/user', () => ({
  useUserStore: () => ({ accessToken: '', logOut: vi.fn() })
}))
const elError = vi.fn()
const elWarning = vi.fn()
// ElMessage 由 unplugin-auto-import 注入为全局
vi.stubGlobal('ElMessage', {
  error: (...a: unknown[]) => elError(...a),
  warning: (...a: unknown[]) => elWarning(...a),
  success: vi.fn()
})
vi.mock('element-plus', () => ({
  ElLoading: { service: () => ({ close: vi.fn() }) }
}))

import api from '@/utils/http'
import { HttpError, handleError, isNetworkError, isNoAnswerYet } from '@/utils/http/error'
import { ApiStatus } from '@/utils/http/status'

const NOTE = '服务器还没有答复，请稍后到我发起里确认'

/** 浏览器里等到超时：axios 报 ECONNABORTED + 「timeout of N ms exceeded」 */
const timesOut: AxiosAdapter = async (config) => {
  throw new AxiosError(`timeout of ${config.timeout}ms exceeded`, AxiosError.ECONNABORTED, config)
}

/** 没有收到响应的其他失败（断网、连不上、请求被中止） */
const breaks =
  (message: string, code: string): AxiosAdapter =>
  async (config) => {
    throw new AxiosError(message, code, config)
  }

/** 收到了响应：2xx 原样返回，其余按 axios 的做法带着响应报错 */
const answers =
  (status: number, data: unknown): AxiosAdapter =>
  async (config) => {
    const response = {
      data,
      status,
      statusText: '',
      headers: { 'content-type': typeof data === 'string' ? 'text/html' : 'application/json' },
      config
    }
    if (status >= 200 && status < 300) return response
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response
    )
  }

let seq = 0
/** 发一次带「还没答复」说明的请求，返回它抛出的错 */
async function failure(adapter: AxiosAdapter, noAnswerYetMessage?: string): Promise<HttpError> {
  const err = await api
    .post({ url: `/flow/start-${++seq}`, data: {}, timeout: 290_000, adapter, noAnswerYetMessage })
    .catch((e: unknown) => e)
  expect(err).toBeInstanceOf(HttpError)
  return err as HttpError
}

beforeEach(() => {
  elError.mockReset()
  elWarning.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('请求发出后还没等到答复（BOOT-092）', () => {
  it('等到超时：按警告显示调用方给的说明，不弹「网络异常」', async () => {
    const err = await failure(timesOut, NOTE)
    expect(elWarning).toHaveBeenCalledTimes(1)
    expect(elWarning).toHaveBeenCalledWith(NOTE)
    expect(elError).not.toHaveBeenCalled()
    expect(isNoAnswerYet(err)).toBe(true)
    expect(err.timedOut).toBe(true)
    expect(err.handled).toBe(true)
    // 种类和码不变：仍然是「没有收到响应」
    expect(isNetworkError(err)).toBe(true)
    expect(err.code).toBe(ApiStatus.network)
  })

  it('axios 开了 clarifyTimeoutError 时超时报 ETIMEDOUT，同样认得', async () => {
    const err = await failure(breaks('timeout of 290000ms exceeded', AxiosError.ETIMEDOUT), NOTE)
    expect(elWarning).toHaveBeenCalledWith(NOTE)
    expect(elError).not.toHaveBeenCalled()
    expect(err.timedOut).toBe(true)
  })

  it('网关先等不及返回 504：同样按警告提示', async () => {
    const err = await failure(answers(504, '<html>504 Gateway Time-out</html>'), NOTE)
    expect(elWarning).toHaveBeenCalledTimes(1)
    expect(elWarning).toHaveBeenCalledWith(NOTE)
    expect(elError).not.toHaveBeenCalled()
    expect(isNoAnswerYet(err)).toBe(true)
    expect(err.timedOut).toBe(false)
    expect(err.code).toBe(ApiStatus.gatewayTimeout)
  })

  const settled: Array<{ name: string; adapter: AxiosAdapter; shown: string }> = [
    {
      name: '断网或连不上',
      adapter: breaks('Network Error', AxiosError.ERR_NETWORK),
      shown: 'httpMsg.networkError'
    },
    {
      name: '请求被中止',
      adapter: breaks('Request aborted', AxiosError.ECONNABORTED),
      shown: 'httpMsg.networkError'
    },
    {
      name: '网关 502',
      adapter: answers(502, '<html>502 Bad Gateway</html>'),
      shown: 'httpMsg.badGateway'
    },
    {
      name: '服务端 500',
      adapter: answers(500, { code: 500, msg: '流程没有发起' }),
      shown: '流程没有发起'
    },
    {
      name: '业务上被拒绝',
      adapter: answers(200, { code: 500, msg: '这个业务单号已经发起过这个流程，还没有办完' }),
      shown: '这个业务单号已经发起过这个流程，还没有办完'
    },
    {
      name: '业务码恰好是 504',
      adapter: answers(200, { code: 504, msg: '上游超时' }),
      shown: '上游超时'
    }
  ]

  it.each(settled)('$name：已经有了结果，照常按失败提示', async ({ adapter, shown }) => {
    const err = await failure(adapter, NOTE)
    expect(elError).toHaveBeenCalledTimes(1)
    expect(elError).toHaveBeenCalledWith(shown)
    expect(elWarning).not.toHaveBeenCalled()
    expect(isNoAnswerYet(err)).toBe(false)
    expect(err.timedOut).toBe(false)
  })

  it('调用方没给说明时提示不变（仍弹「网络异常」），但错误上仍能判断出是没等到答复', async () => {
    const err = await failure(timesOut)
    expect(elError).toHaveBeenCalledWith('httpMsg.networkError')
    expect(elWarning).not.toHaveBeenCalled()
    expect(isNoAnswerYet(err)).toBe(true)
  })

  it('切换页面取消的请求、普通的错不算', () => {
    let canceled: unknown
    try {
      handleError(new AxiosError('canceled', AxiosError.ERR_CANCELED))
    } catch (e) {
      canceled = e
    }
    expect(canceled).toBeInstanceOf(HttpError)
    expect(isNoAnswerYet(canceled)).toBe(false)
    expect(isNoAnswerYet(new Error('timeout of 15000ms exceeded'))).toBe(false)
    expect(isNoAnswerYet(new HttpError('x', ApiStatus.error))).toBe(false)
  })
})
