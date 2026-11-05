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

describe('流程设计器 AI 节点', () => {
  it('newNode(ai) 带默认超时与失败策略', () => {
    const n = newNode('ai')
    expect(n.type).toBe('ai')
    expect(n.timeoutMs).toBe(120000)
    expect(n.onFailure).toBe('rejectLast')
    expect(n.aiFlowId).toBe('')
    expect(n.candidates).toEqual([])
  })

  it('缺 aiFlowId 校验失败', () => {
    const nodes: GNode[] = [newNode('ai')]
    expect(validateTree(nodes)).toContain('errAiFlowId')
  })

  it('合法 ai 节点通过校验并 toTree 带映射', () => {
    const n = newNode('ai')
    n.aiFlowId = 90001
    n.inputMap = [
      { key: 'title', value: 'form.title' },
      { key: '', value: '' }
    ]
    n.outputMap = [{ key: 'ai_summary', value: 'summary' }]
    n.onFailure = 'transfer:role:admin'
    expect(validateTree([n])).toBe('')
    const tree = toTree([n])
    expect(tree.type).toBe('ai')
    expect(tree.aiFlowId).toBe(90001)
    expect(tree.timeoutMs).toBe(120000)
    expect(tree.onFailure).toBe('transfer:role:admin')
    expect(tree.inputMap).toEqual({ title: 'form.title' })
    expect(tree.outputMap).toEqual({ ai_summary: 'summary' })
    expect(tree.candidates).toBeUndefined()
  })

  it('非法 onFailure / 映射键名被拒', () => {
    const n = newNode('ai')
    n.aiFlowId = 1
    n.onFailure = 'boom'
    expect(validateTree([n])).toContain('errAiOnFailure')
    n.onFailure = 'rejectLast'
    n.inputMap = [{ key: '1bad', value: 'x' }]
    expect(validateTree([n])).toContain('errAiMapKey')
  })

  it('与审批混排 toTree 单链', () => {
    const ai = newNode('ai')
    ai.aiFlowId = '42'
    const ap = newNode('approval')
    const tree = toTree([ai, ap])
    expect(tree.type).toBe('ai')
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

  it('i18n 含 AI 节点与 aiTrace 文案', () => {
    expect(zh.pages.system.flowGraph.typeAi).toBeTruthy()
    expect(en.pages.system.flowGraph.typeAi).toBeTruthy()
    expect(zh.pages.system.flowCenter.aiTraceTitle).toBeTruthy()
    expect(en.pages.system.flowCenter.aiVarsDivider).toBeTruthy()
    expect(zh.pages.system.flowGraph.errAiFlowId).toContain('{name}')
  })
})
