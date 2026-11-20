import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const httpPost = vi.fn()
vi.mock('@/utils/http', () => ({ default: { post: (...a: unknown[]) => httpPost(...a) } }))

import {
  FLOW_ACTION_TIMEOUT,
  fetchFlowHandle,
  fetchFlowStartBy,
  fetchLeaveStart
} from '@/api/system-manage'

const nginx = readFileSync(
  resolve(__dirname, '../../../docker/nginx/default.conf.template'),
  'utf-8'
)
/** 后端一个 AI 预审节点等模型的默认时限（AiApprovalConstants.DEFAULT_TIMEOUT_MS） */
const SERVER_AI_NODE_DEFAULT = 120_000
/** 前端请求的默认等待时间（utils/http 的 REQUEST_TIMEOUT） */
const DEFAULT_TIMEOUT = 15_000

afterEach(() => {
  httpPost.mockReset()
})

describe('流程发起、办理的请求等待时间（BOOT-092）', () => {
  it('按流程码发起：等得比默认久，并带着「还没答复」时要用的说明', async () => {
    httpPost.mockResolvedValue('1001')
    await fetchFlowStartBy('purchase apply', 'PO/1', { variable: { amount: 100 } })
    expect(httpPost).toHaveBeenCalledWith({
      url: '/api/system/flow/start-by/purchase%20apply/PO%2F1',
      data: { variable: { amount: 100 } },
      timeout: FLOW_ACTION_TIMEOUT,
      noAnswerYetMessage: 'pages.system.flowDef.msgStartNoAnswer'
    })
  })

  it('请假发起：同样', async () => {
    httpPost.mockResolvedValue('1002')
    const leave = {
      businessId: 'LEAVE-1',
      startTime: '2026-01-05',
      endTime: '2026-01-06',
      reason: '事假'
    }
    await fetchLeaveStart(leave)
    expect(httpPost).toHaveBeenCalledWith({
      url: '/api/system/flow/leave/start',
      data: leave,
      timeout: FLOW_ACTION_TIMEOUT,
      noAnswerYetMessage: 'pages.system.flowDef.msgStartNoAnswer'
    })
  })

  it('办理（通过）：同样，说明换成办理用的那一句', async () => {
    httpPost.mockResolvedValue('ok')
    await fetchFlowHandle('77', '同意', { amount: 100 })
    expect(httpPost).toHaveBeenCalledWith({
      url: '/api/system/flow/task/handle/77',
      data: { message: '同意', variable: { amount: 100 } },
      timeout: FLOW_ACTION_TIMEOUT,
      noAnswerYetMessage: 'pages.system.flowCenter.msgHandleNoAnswer'
    })
  })

  it('等得比一个 AI 预审节点的默认时限久，又比 nginx 转发接口的等待上限短', () => {
    const proxyMs = Number(/proxy_read_timeout\s+(\d+)s/.exec(nginx)?.[1]) * 1000
    expect(proxyMs).toBeGreaterThan(0)
    expect(FLOW_ACTION_TIMEOUT).toBeGreaterThan(DEFAULT_TIMEOUT)
    expect(FLOW_ACTION_TIMEOUT).toBeGreaterThan(SERVER_AI_NODE_DEFAULT + 20_000)
    expect(FLOW_ACTION_TIMEOUT).toBeLessThan(proxyMs)
  })
})
