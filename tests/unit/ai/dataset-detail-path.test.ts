import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const httpGet = vi.fn()
vi.mock('@/utils/http', () => ({ default: { get: (...a: unknown[]) => httpGet(...a) } }))
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ accessToken: '' }) }))

import {
  aiDatasetExists,
  fetchAiAppDetail,
  fetchAiAppRunDetail,
  fetchAiConversationDetail,
  fetchAiDashboardDetail,
  fetchAiDatasetDetail,
  fetchAiKnowledgeDetail
} from '../../../modules/ai/api'

const openapi = readFileSync(resolve(__dirname, '../../../src/types/api/openapi.d.ts'), 'utf-8')
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** 服务端接口清单（openapi.d.ts）里有没有这个地址 */
const serverHas = (path: string) => new RegExp(`['"]${escapeRe(path)}['"]\\s*:`).test(openapi)

afterEach(() => {
  httpGet.mockReset()
})

describe('问数详情接口', () => {
  it('编号放在路径里：服务端只有 /detail/{id}，没有 /detail?id=', async () => {
    httpGet.mockResolvedValue({ id: '114675569943000122' })
    await fetchAiDatasetDetail('114675569943000122', { showErrorMessage: false })
    expect(httpGet).toHaveBeenCalledWith({
      url: '/api/system/ai/dataset/detail/114675569943000122',
      showErrorMessage: false
    })
    expect(serverHas('/system/ai/dataset/detail/{id}')).toBe(true)
    expect(serverHas('/system/ai/dataset/detail')).toBe(false)
  })

  it('aiDatasetExists：查到算存在；接口报错、返回空、编号不是数字都算不存在', async () => {
    httpGet.mockResolvedValueOnce({ id: '12', name: '销售问数' })
    await expect(aiDatasetExists('12')).resolves.toBe(true)
    expect(httpGet).toHaveBeenLastCalledWith({
      url: '/api/system/ai/dataset/detail/12',
      showErrorMessage: false
    })

    httpGet.mockRejectedValueOnce(new Error('404'))
    await expect(aiDatasetExists('13')).resolves.toBe(false)

    httpGet.mockResolvedValueOnce(null)
    await expect(aiDatasetExists('14')).resolves.toBe(false)

    httpGet.mockClear()
    await expect(aiDatasetExists('abc')).resolves.toBe(false)
    await expect(aiDatasetExists('')).resolves.toBe(false)
    await expect(aiDatasetExists('../12')).resolves.toBe(false)
    expect(httpGet).not.toHaveBeenCalled()
  })
})

describe('AI 模块详情接口的地址都在服务端接口清单里', () => {
  const cases: Array<[string, () => unknown]> = [
    ['应用', () => fetchAiAppDetail('7')],
    ['应用运行记录', () => fetchAiAppRunDetail('7')],
    ['知识库', () => fetchAiKnowledgeDetail('7')],
    ['问数', () => fetchAiDatasetDetail('7')],
    ['仪表盘', () => fetchAiDashboardDetail('7')],
    ['会话', () => fetchAiConversationDetail('7')]
  ]

  it.each(cases)('%s', async (_name, callIt) => {
    httpGet.mockResolvedValue({})
    await callIt()
    const { url } = httpGet.mock.calls[0][0] as { url: string }
    const path = url.replace(/^\/api/, '').replace(/\/7$/, '/{id}')
    expect(serverHas(path), `${url} 不在 openapi.d.ts 里`).toBe(true)
  })
})
