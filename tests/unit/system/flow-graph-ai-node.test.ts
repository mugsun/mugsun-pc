import { describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({
  $t: (key: string, params?: Record<string, string>) => {
    if (!params) return key
    return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), key)
  }
}))

import { newNode, toTree, validateTree, type GNode } from '@/views/system/flow-graph/graph-model'
import { buildFlowAiAppMock, isFlowAiMockOn } from '@/views/system/flow-graph/flow-ai-mock'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'

const withRequired = (n: GNode, patch: Partial<GNode> = {}): GNode => {
  n.aiFlowId = patch.aiFlowId ?? 90001
  n.inputMap = patch.inputMap ?? [{ key: 'title', value: 'form.title' }]
  if (patch.outputMap !== undefined) n.outputMap = patch.outputMap
  if (patch.timeoutMs !== undefined) n.timeoutMs = patch.timeoutMs
  if (patch.onFailure !== undefined) n.onFailure = patch.onFailure
  return n
}

describe('流程设计器 AI 节点', () => {
  it('newNode(ai) 带默认超时与失败策略', () => {
    const n = newNode('ai')
    expect(n.type).toBe('ai')
    expect(n.timeoutMs).toBe(120000)
    expect(n.onFailure).toBe('rejectLast')
    expect(n.aiFlowId).toBe('')
    expect(n.inputMap).toEqual([])
    expect(n.candidates).toEqual([])
  })

  it('缺 aiFlowId 校验失败', () => {
    const nodes: GNode[] = [newNode('ai')]
    expect(validateTree(nodes)).toContain('errAiFlowId')
  })

  it('缺 inputMap 失败；空 []/仅空行（→{}）通过', () => {
    const missing = withRequired(newNode('ai'))
    missing.inputMap = undefined
    expect(validateTree([missing])).toContain('errAiInputMap')
    const nil = withRequired(newNode('ai'))
    ;(nil as { inputMap?: GNode['inputMap'] | null }).inputMap = null
    expect(validateTree([nil])).toContain('errAiInputMap')
    const empty = withRequired(newNode('ai'), { inputMap: [] })
    expect(validateTree([empty])).toBe('')
    expect(toTree([empty]).inputMap).toEqual({})
    const blankRows = withRequired(newNode('ai'), {
      inputMap: [{ key: '', value: '' }]
    })
    expect(validateTree([blankRows])).toBe('')
    expect(toTree([blankRows]).inputMap).toEqual({})
  })

  it('合法 ai 节点通过校验并 toTree 带映射', () => {
    const n = withRequired(newNode('ai'), {
      inputMap: [
        { key: 'title', value: 'form.title' },
        { key: '', value: '' }
      ],
      outputMap: [{ key: 'summary', value: 'ai_summary' }],
      onFailure: 'transfer:role:admin'
    })
    expect(validateTree([n])).toBe('')
    const tree = toTree([n])
    expect(tree.type).toBe('ai')
    expect(tree.aiFlowId).toBe(90001)
    expect(tree.timeoutMs).toBe(120000)
    expect(tree.onFailure).toBe('transfer:role:admin')
    expect(tree.inputMap).toEqual({ title: 'form.title' })
    expect(tree.outputMap).toEqual({ summary: 'ai_summary' })
    expect(tree.candidates).toBeUndefined()
  })

  it('toTree 始终带 inputMap 字段', () => {
    const n = newNode('ai')
    n.aiFlowId = 1
    const tree = toTree([n])
    expect(tree.inputMap).toEqual({})
  })

  it('非法 onFailure / 入参键名被拒', () => {
    const n = withRequired(newNode('ai'), { onFailure: 'boom' })
    expect(validateTree([n])).toContain('errAiOnFailure')
    n.onFailure = 'rejectLast'
    n.inputMap = [{ key: '1bad', value: 'x' }]
    expect(validateTree([n])).toContain('errAiMapKey')
  })

  it('outputMap 目标键白名单在 value（to）', () => {
    const badVal = withRequired(newNode('ai'), {
      outputMap: [{ key: 'summary', value: 'x' }]
    })
    expect(validateTree([badVal])).toContain('errAiOutputMapKey')
    const badKeyAsTarget = withRequired(newNode('ai'), {
      // 旧误把白名单打在 key：此种 from=ai_summary、to=普通名应失败
      outputMap: [{ key: 'ai_summary', value: 'summary' }]
    })
    expect(validateTree([badKeyAsTarget])).toContain('errAiOutputMapKey')
    const okFixed = withRequired(newNode('ai'), {
      outputMap: [
        { key: 'pass', value: 'ai_pass' },
        { key: 'reason', value: 'ai_reason' },
        { key: 'rid', value: 'ai_run_id' },
        { key: 'summary', value: 'ai_summary' }
      ]
    })
    expect(validateTree([okFixed])).toBe('')
    const okExt = withRequired(newNode('ai'), {
      outputMap: [{ key: 'score', value: 'ai_ext_score' }]
    })
    expect(validateTree([okExt])).toBe('')
  })

  it('timeoutMs 超 300000 被拒', () => {
    const n = withRequired(newNode('ai'), { timeoutMs: 300001 })
    expect(validateTree([n])).toContain('errAiTimeout')
    n.timeoutMs = 300000
    expect(validateTree([n])).toBe('')
    n.timeoutMs = 999
    expect(validateTree([n])).toContain('errAiTimeout')
  })

  it('与审批混排 toTree 单链', () => {
    const ai = withRequired(newNode('ai'), { aiFlowId: '42' })
    const ap = newNode('approval')
    const tree = toTree([ai, ap])
    expect(tree.type).toBe('ai')
    expect(tree.inputMap).toEqual({ title: 'form.title' })
    expect(tree.childNode.type).toBe('approval')
    expect(tree.childNode.candidates?.length).toBeGreaterThan(0)
  })

  it('mock 开关仅 DEV+true', () => {
    expect(isFlowAiMockOn({ DEV: true, VITE_FLOW_AI_MOCK: 'true' })).toBe(true)
    expect(isFlowAiMockOn({ DEV: true, VITE_FLOW_AI_MOCK: 'false' })).toBe(false)
    expect(isFlowAiMockOn({ DEV: false, VITE_FLOW_AI_MOCK: 'true' })).toBe(false)
  })

  it('mock 列表仅启用 workflow|chatflow', () => {
    const list = buildFlowAiAppMock()
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((a) => a.status === 1 && ['workflow', 'chatflow'].includes(a.appType))).toBe(
      true
    )
  })

  it('i18n 含 AI 节点与契约收紧文案', () => {
    expect(zh.pages.system.flowGraph.typeAi).toBeTruthy()
    expect(en.pages.system.flowGraph.typeAi).toBeTruthy()
    expect(zh.pages.system.flowCenter.aiTraceTitle).toBeTruthy()
    expect(en.pages.system.flowCenter.aiVarsDivider).toBeTruthy()
    expect(zh.pages.system.flowGraph.errAiFlowId).toContain('{name}')
    expect(zh.pages.system.flowGraph.errAiInputMap).toContain('{name}')
    expect(zh.pages.system.flowGraph.errAiOutputMapKey).toContain('ai_ext_')
    expect(zh.pages.system.flowGraph.errAiOutputMapKey).toMatch(/目标键|映射值/)
    expect(zh.pages.system.flowGraph.aiOutputMapTo).toMatch(/目标键|ai_summary/)
    expect(en.pages.system.flowGraph.errAiTimeout).toContain('300000')
    expect(zh.pages.system.flowGraph.aiInputMap).toContain('必填')
    expect(zh.pages.system.flowGraph.aiInputMap).toContain('可空')
  })
})
