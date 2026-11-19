import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const httpPost = vi.fn()
vi.mock('@/utils/http', () => ({ default: { post: (...a: unknown[]) => httpPost(...a) } }))
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ accessToken: '' }) }))

import {
  AI_APP_RUN_TIMEOUT,
  AI_DATASET_ASK_TIMEOUT,
  AI_DATASET_QUERY_TIMEOUT,
  fetchDatasetAsk,
  fetchDatasetSqlRerun,
  fetchRunAiApp
} from '../../../modules/ai/api'

const nginx = readFileSync(
  resolve(__dirname, '../../../docker/nginx/default.conf.template'),
  'utf-8'
)
/** 后端一条查询的时限上限（SqlQueryRunner.MAX_TIMEOUT_SECONDS）和等模型回答的上限（AiLlmClient.chat） */
const SERVER_QUERY_MAX = 120_000
const SERVER_MODEL_MAX = 120_000

afterEach(() => {
  httpPost.mockReset()
})

describe('问数和应用试运行的请求等待时间', () => {
  it('重跑查询：等得比后端单条查询的上限久，能看到后端给的「查询超过 N 秒」', async () => {
    httpPost.mockResolvedValue({ rows: [] })
    await fetchDatasetSqlRerun({ datasetId: '7', sql: 'select 1' })
    expect(httpPost).toHaveBeenCalledWith({
      url: '/api/system/ai/dataset/sql/rerun',
      data: { datasetId: '7', sql: 'select 1' },
      timeout: AI_DATASET_QUERY_TIMEOUT
    })
    expect(AI_DATASET_QUERY_TIMEOUT).toBeGreaterThan(SERVER_QUERY_MAX + 20_000)
  })

  it('提问：等模型写查询和执行查询两段加起来都等得到', async () => {
    httpPost.mockResolvedValue({ sql: 'select 1', rows: [] })
    await fetchDatasetAsk({ datasetId: '7', question: '各地区销售额' })
    expect(httpPost).toHaveBeenCalledWith({
      url: '/api/system/ai/dataset/ask',
      data: { datasetId: '7', question: '各地区销售额' },
      timeout: AI_DATASET_ASK_TIMEOUT
    })
    expect(AI_DATASET_ASK_TIMEOUT).toBeGreaterThan(SERVER_MODEL_MAX + SERVER_QUERY_MAX + 20_000)
  })

  it('应用试运行：等整条流程跑完', async () => {
    httpPost.mockResolvedValue({ status: 'success' })
    await fetchRunAiApp({ id: '9', input: { region: '华南' }, dsl: '{}' })
    expect(httpPost).toHaveBeenCalledWith({
      url: '/api/system/ai/app/run?id=9',
      data: { input: { region: '华南' } },
      timeout: AI_APP_RUN_TIMEOUT
    })
    expect(AI_APP_RUN_TIMEOUT).toBeGreaterThan(SERVER_QUERY_MAX + 20_000)
  })

  it('都比 nginx 转发接口的等待上限短，否则先到的是 nginx 的 504', () => {
    const proxyMs = Number(/proxy_read_timeout\s+(\d+)s/.exec(nginx)?.[1]) * 1000
    expect(proxyMs).toBeGreaterThan(0)
    for (const timeout of [AI_DATASET_QUERY_TIMEOUT, AI_DATASET_ASK_TIMEOUT, AI_APP_RUN_TIMEOUT]) {
      expect(timeout).toBeLessThan(proxyMs)
    }
  })
})
