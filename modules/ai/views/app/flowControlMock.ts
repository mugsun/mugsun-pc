/**
 * AI 流 foreach/parallel 开发期 mock（对齐 boot 节点 outputJson 形状）。
 * 仅由页面在 DEV && VITE_AI_FLOW_CONTROL_MOCK=true 时动态 import；生产产物不含。
 */
import {
  AGG_ARRAY,
  TYPE_FOREACH,
  TYPE_PARALLEL,
  clampMaxIterations,
  extractControlOutputs,
  type ControlNodeOutput
} from './flowControl'

export type FlowControlMockRun = {
  runId: string
  status: 'success' | 'failed'
  output: string
  vars: Record<string, unknown>
  errorCode?: string
  errorMsg?: string
  mock: true
  nodeOutputs: Array<{
    nodeId: string
    nodeType: string
    status: string
    outputJson: object
  }>
  controlOutputs: ControlNodeOutput[]
}

function parseDsl(dsl: string | undefined): { nodes: any[] } {
  if (!dsl) return { nodes: [] }
  try {
    const j = JSON.parse(dsl)
    return { nodes: Array.isArray(j.nodes) ? j.nodes : [] }
  } catch {
    return { nodes: [] }
  }
}

/** 按当前画布 DSL 拼一份契约同形假运行结果 */
export function buildAiFlowControlMock(input: {
  id?: string | number
  dsl?: string
  input?: unknown
}): FlowControlMockRun {
  const { nodes } = parseDsl(input.dsl)
  const nodeOutputs: FlowControlMockRun['nodeOutputs'] = []
  const vars: Record<string, unknown> = {
    input: input.input ?? '你好'
  }
  let lastOutput = ''

  for (const n of nodes) {
    const type = String(n?.data?.type || n?.type || '').toLowerCase()
    const id = String(n?.id || type)
    const data = n?.data || {}
    if (type === TYPE_FOREACH) {
      const maxIter = clampMaxIterations(Number(data.maxIterations) || 0)
      const sampleLen = 25
      const truncated = sampleLen > maxIter
      const ran = Math.min(sampleLen, maxIter)
      const iterations = Array.from({ length: ran }, (_, i) => ({
        index: i,
        status: i === 3 ? 'failed' : 'success',
        output: i === 3 ? '' : `item-${i}-ok`,
        errorCode: i === 3 ? 'AI_FOREACH_ITEM_ERROR' : undefined,
        errorMsg: i === 3 ? 'mock item fail' : undefined,
        durationMs: 12 + i,
        steps: [{ nodeId: 'text_mock', nodeType: 'text', status: i === 3 ? 'failed' : 'success' }]
      }))
      const collected = iterations.filter((x) => x.status === 'success').map((x) => x.output)
      const aggregate = String(data.aggregate || AGG_ARRAY)
      const outputVar = String(data.outputVar || 'foreachResults')
      const output = JSON.stringify(collected)
      vars[outputVar] = collected
      lastOutput = output
      nodeOutputs.push({
        nodeId: id,
        nodeType: TYPE_FOREACH,
        status: 'success',
        outputJson: {
          aggregate,
          inputCount: sampleLen,
          ranCount: ran,
          truncated,
          iterations,
          output
        }
      })
    } else if (type === TYPE_PARALLEL) {
      const branchesIn = Array.isArray(data.branches) ? data.branches : []
      const branches = (branchesIn.length >= 2 ? branchesIn : [{ id: 'b1' }, { id: 'b2' }]).map(
        (b: any, i: number) => {
          const bid = String(b.id || `b${i + 1}`)
          const failed = i === 1
          const ov = String(b.outputVar || `branch_${bid}`)
          if (!failed) vars[ov] = `branch-${bid}-ok`
          return {
            id: bid,
            status: failed ? 'failed' : 'success',
            output: failed ? '' : `branch-${bid}-ok`,
            outputVar: ov,
            errorCode: failed ? 'AI_PARALLEL_BRANCH_FAILED' : undefined,
            errorMsg: failed ? 'mock branch fail' : undefined,
            durationMs: 20 + i * 3,
            steps: []
          }
        }
      )
      const parallelResults: Record<string, unknown> = {}
      for (const b of branches) {
        parallelResults[b.id] = {
          status: b.status,
          output: b.output,
          errorCode: b.errorCode,
          errorMsg: b.errorMsg,
          durationMs: b.durationMs
        }
      }
      vars.parallelResults = parallelResults
      const output = JSON.stringify(parallelResults)
      lastOutput = output
      nodeOutputs.push({
        nodeId: id,
        nodeType: TYPE_PARALLEL,
        status: 'success',
        outputJson: {
          branches,
          parallelResults,
          partial: true,
          output
        }
      })
    }
  }

  if (!nodeOutputs.length) {
    lastOutput = String(vars.input ?? '')
    nodeOutputs.push({
      nodeId: 'mock_text',
      nodeType: 'text',
      status: 'success',
      outputJson: { output: lastOutput }
    })
  }

  return {
    runId: 'mock-ai-flow-control',
    status: 'success',
    output: lastOutput,
    vars,
    mock: true,
    nodeOutputs,
    controlOutputs: extractControlOutputs(nodeOutputs)
  }
}
