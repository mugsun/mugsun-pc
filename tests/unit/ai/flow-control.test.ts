import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  ERR_FOREACH_BODY_INVALID,
  ERR_FOREACH_INPUT_NOT_ARRAY,
  ERR_PARALLEL_BRANCH_INVALID,
  TYPE_FOREACH,
  TYPE_PARALLEL,
  bodyCandidateNodes,
  clampMaxBranches,
  clampMaxIterations,
  clampTimeoutMs,
  defaultForeachData,
  defaultParallelData,
  extractControlOutputs,
  findLooseFlowNodes,
  isAiFlowControlMockEnabled,
  normalizeControlData,
  syncOrderedIds,
  validateControlNode
} from '../../../modules/ai/views/app/flowControl'
import {
  NODE_LABEL_KEYS,
  LEGACY_DEFAULT_LABELS,
  displayLabel
} from '../../../modules/ai/views/app/flowNodes'

const tOf = (pack: any) => (key: string) => key.split('.').reduce((o, k) => o?.[k], pack)

describe('AI 流 foreach/parallel 契约', () => {
  it('钳位与默认对齐 boot', () => {
    expect(clampMaxIterations(0)).toBe(20)
    expect(clampMaxIterations(200)).toBe(100)
    expect(clampMaxBranches(0)).toBe(8)
    expect(clampMaxBranches(32)).toBe(16)
    expect(clampTimeoutMs(0)).toBe(120_000)
    expect(clampTimeoutMs(999_999)).toBe(300_000)
  })

  it('有序合并 bodyNodeIds', () => {
    expect(syncOrderedIds(['a', 'b'], ['b', 'c', 'a'])).toEqual(['a', 'b', 'c'])
    expect(syncOrderedIds([], ['x', 'y'])).toEqual(['x', 'y'])
  })

  it('body 候选排除自身与控制节点', () => {
    const nodes = [
      { id: 'foreach_1', data: { type: 'foreach' } },
      { id: 'llm_1', data: { type: 'llm' } },
      { id: 'parallel_1', data: { type: 'parallel' } },
      { id: 'text_1', data: { type: 'text' } }
    ]
    expect(bodyCandidateNodes(nodes, 'foreach_1').map((n) => n.id)).toEqual(['llm_1', 'text_1'])
  })

  it('foreach 缺 inputPath / body 报错码', () => {
    const byId = new Map([
      ['llm_1', { id: 'llm_1', data: { type: 'llm' } }],
      ['foreach_1', { id: 'foreach_1', data: { type: 'foreach', bodyNodeIds: [] } }]
    ])
    const e1 = validateControlNode(
      { id: 'foreach_1', data: { type: 'foreach', inputPath: '', bodyNodeIds: ['llm_1'] } },
      byId
    )
    expect(e1?.code).toBe(ERR_FOREACH_INPUT_NOT_ARRAY)
    const e2 = validateControlNode(
      { id: 'foreach_1', data: { type: 'foreach', inputPath: 'items', bodyNodeIds: [] } },
      byId
    )
    expect(e2?.code).toBe(ERR_FOREACH_BODY_INVALID)
  })

  it('禁嵌套 foreach/parallel', () => {
    const byId = new Map([
      ['foreach_1', { id: 'foreach_1', data: { type: 'foreach' } }],
      ['foreach_2', { id: 'foreach_2', data: { type: 'foreach' } }]
    ])
    const e = validateControlNode(
      {
        id: 'foreach_1',
        data: { type: 'foreach', inputPath: 'items', bodyNodeIds: ['foreach_2'] }
      },
      byId
    )
    expect(e?.code).toBe(ERR_FOREACH_BODY_INVALID)
    expect(e?.messageKey).toBe('aiAppDesign.errCtrlBodyNest')
  })

  it('parallel 至少两支且 body 非空', () => {
    const byId = new Map([['llm_1', { id: 'llm_1', data: { type: 'llm' } }]])
    const e = validateControlNode(
      {
        id: 'p1',
        data: {
          type: 'parallel',
          branches: [{ id: 'b1', bodyNodeIds: ['llm_1'] }]
        }
      },
      byId
    )
    expect(e?.code).toBe(ERR_PARALLEL_BRANCH_INVALID)
  })

  it('normalize 写入 bodyMode=nodeIds 与钳位', () => {
    const f = normalizeControlData(TYPE_FOREACH, {
      type: TYPE_FOREACH,
      inputPath: ' items ',
      maxIterations: 999,
      timeoutMs: 999999,
      bodyNodeIds: ['a', '']
    })
    expect(f.bodyMode).toBe('nodeIds')
    expect(f.maxIterations).toBe(100)
    expect(f.timeoutMs).toBe(300_000)
    expect(f.bodyNodeIds).toEqual(['a'])
    expect(f.itemVar).toBe('item')

    const p = normalizeControlData(TYPE_PARALLEL, defaultParallelData())
    expect(p.waitAll).toBe(true)
    expect(p.onBranchFailure).toBe('continue')
    expect((p.branches as any[]).length).toBe(2)
  })

  it('extractControlOutputs 解析 iterations/branches/truncated/partial', () => {
    const outs = extractControlOutputs([
      {
        nodeId: 'foreach_1',
        nodeType: 'foreach',
        outputJson: JSON.stringify({
          truncated: true,
          inputCount: 30,
          ranCount: 20,
          iterations: [{ index: 0, status: 'success' }]
        })
      },
      {
        nodeId: 'parallel_1',
        nodeType: 'parallel',
        outputJson: {
          partial: true,
          branches: [{ id: 'b1', status: 'failed' }],
          parallelResults: { b1: { status: 'failed' } }
        }
      },
      { nodeId: 'llm_1', nodeType: 'llm', outputJson: { output: 'x' } }
    ])
    expect(outs).toHaveLength(2)
    expect(outs[0].truncated).toBe(true)
    expect(outs[0].iterations).toHaveLength(1)
    expect(outs[1].partial).toBe(true)
    expect(outs[1].branches).toHaveLength(1)
  })

  it('mock 开关默认关，仅 DEV+true 开', () => {
    expect(isAiFlowControlMockEnabled({ DEV: true, VITE_AI_FLOW_CONTROL_MOCK: '' })).toBe(false)
    expect(isAiFlowControlMockEnabled({ DEV: true, VITE_AI_FLOW_CONTROL_MOCK: 'false' })).toBe(
      false
    )
    expect(isAiFlowControlMockEnabled({ DEV: false, VITE_AI_FLOW_CONTROL_MOCK: 'true' })).toBe(
      false
    )
    expect(isAiFlowControlMockEnabled({ DEV: true, VITE_AI_FLOW_CONTROL_MOCK: 'true' })).toBe(true)
    expect(isAiFlowControlMockEnabled({ DEV: true, VITE_AI_FLOW_CONTROL_MOCK: ' TRUE ' })).toBe(
      true
    )
  })

  it('默认 data 形状', () => {
    expect(defaultForeachData().bodyMode).toBe('nodeIds')
    expect((defaultParallelData().branches as any[]).length).toBe(2)
  })

  it('foreach/parallel 标签 i18n 齐全且 en 无中文', () => {
    const tZh = tOf(zh)
    const tEn = tOf(en)
    for (const type of [TYPE_FOREACH, TYPE_PARALLEL]) {
      const key = NODE_LABEL_KEYS[type]
      expect(typeof tZh(key)).toBe('string')
      const e = tEn(key)
      expect(typeof e).toBe('string')
      expect(/[\u4e00-\u9fff]/.test(e)).toBe(false)
      expect(tZh(key)).toBe(LEGACY_DEFAULT_LABELS[type])
      expect(displayLabel(type, '', tZh)).toBe(LEGACY_DEFAULT_LABELS[type])
    }
  })

  it('lab foreach DSL：body 无边不算孤立，validateControl 通过', () => {
    // boot lab：start→fe→end + body t1 仅 bodyNodeIds
    const nodes = [
      { id: 'start', data: { type: 'start' } },
      {
        id: 'fe',
        data: {
          type: 'foreach',
          inputPath: 'items',
          bodyNodeIds: ['t1'],
          maxIterations: 20,
          timeoutMs: 120000
        }
      },
      { id: 'end', data: { type: 'end' } },
      { id: 't1', data: { type: 'text', label: 'body' } }
    ]
    const edges = [
      { source: 'start', target: 'fe' },
      { source: 'fe', target: 'end' }
    ]
    expect(findLooseFlowNodes(nodes, edges).map((n) => n.id)).toEqual([])
    const byId = new Map(nodes.map((n) => [n.id, n]))
    expect(validateControlNode(nodes[1], byId)).toBeNull()
  })

  it('lab parallel DSL：分支 body 无边不算孤立，validateControl 通过', () => {
    // boot lab：start→p→join→end + bodies t1/t2
    const nodes = [
      { id: 'start', data: { type: 'start' } },
      {
        id: 'p',
        data: {
          type: 'parallel',
          waitAll: true,
          branches: [
            { id: 'b1', bodyNodeIds: ['t1'], outputVar: 'branch_b1' },
            { id: 'b2', bodyNodeIds: ['t2'], outputVar: 'branch_b2' }
          ],
          maxBranches: 8,
          timeoutMs: 120000
        }
      },
      { id: 'join', data: { type: 'text', label: 'join' } },
      { id: 'end', data: { type: 'end' } },
      { id: 't1', data: { type: 'text', label: 'b1' } },
      { id: 't2', data: { type: 'text', label: 'b2' } }
    ]
    const edges = [
      { source: 'start', target: 'p' },
      { source: 'p', target: 'join' },
      { source: 'join', target: 'end' }
    ]
    expect(
      findLooseFlowNodes(nodes, edges)
        .map((n) => n.id)
        .sort()
    ).toEqual([])
    const byId = new Map(nodes.map((n) => [n.id, n]))
    expect(validateControlNode(nodes[1], byId)).toBeNull()
  })

  it('真正孤立节点仍被 findLooseFlowNodes 检出', () => {
    const nodes = [
      { id: 'start', data: { type: 'start' } },
      { id: 'end', data: { type: 'end' } },
      { id: 'orphan', data: { type: 'llm' } }
    ]
    const edges = [{ source: 'start', target: 'end' }]
    const loose = findLooseFlowNodes(nodes, edges)
    expect(loose.map((n) => n.id)).toEqual(['orphan'])
  })

  it('normalize parallel 强制 waitAll=true', () => {
    const p = normalizeControlData(TYPE_PARALLEL, {
      type: TYPE_PARALLEL,
      waitAll: false,
      branches: [
        { id: 'b1', bodyNodeIds: ['a'] },
        { id: 'b2', bodyNodeIds: ['b'] }
      ]
    })
    expect(p.waitAll).toBe(true)
  })

  it('校验 messageKey 在 zh/en 均有且 en 无中文', () => {
    const keys = [
      'errCtrlMissingInputPath',
      'errCtrlEmptyBody',
      'errCtrlBodyMissing',
      'errCtrlBodyNest',
      'errCtrlMaxIterations',
      'errCtrlTimeout',
      'errCtrlParallelMinBranches',
      'errCtrlParallelMaxBranches',
      'errCtrlParallelHardBranches',
      'errCtrlBranchIdEmpty',
      'errCtrlBranchIdDup',
      'errCtrlBranchBodyEmpty'
    ]
    for (const k of keys) {
      const zk = (zh as any).aiAppDesign[k]
      const ek = (en as any).aiAppDesign[k]
      expect(typeof zk).toBe('string')
      expect(typeof ek).toBe('string')
      expect(/[\u4e00-\u9fff]/.test(ek)).toBe(false)
    }
  })
})
