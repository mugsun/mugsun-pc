import { describe, expect, it } from 'vitest'
import { buildAiFlowControlMock } from '../../../modules/ai/views/app/flowControlMock'

describe('AI 流控制节点 DEV mock', () => {
  it('DSL 含 foreach 时产出 truncated + iterations', () => {
    const dsl = JSON.stringify({
      nodes: [
        {
          id: 'foreach_1',
          type: 'foreach',
          data: {
            type: 'foreach',
            inputPath: 'items',
            maxIterations: 20,
            bodyNodeIds: ['text_1'],
            aggregate: 'array',
            outputVar: 'foreachResults'
          }
        }
      ]
    })
    const r = buildAiFlowControlMock({ id: 1, dsl, input: 'hi' })
    expect(r.mock).toBe(true)
    expect(r.status).toBe('success')
    expect(r.controlOutputs[0].nodeType).toBe('foreach')
    expect(r.controlOutputs[0].truncated).toBe(true)
    expect(r.controlOutputs[0].iterations?.length).toBe(20)
    expect(Array.isArray(r.vars.foreachResults)).toBe(true)
  })

  it('DSL 含 parallel 时产出 partial + branches', () => {
    const dsl = JSON.stringify({
      nodes: [
        {
          id: 'parallel_1',
          type: 'parallel',
          data: {
            type: 'parallel',
            branches: [
              { id: 'b1', bodyNodeIds: ['t1'], outputVar: 'branch_b1' },
              { id: 'b2', bodyNodeIds: ['t2'], outputVar: 'branch_b2' }
            ]
          }
        }
      ]
    })
    const r = buildAiFlowControlMock({ dsl })
    expect(r.controlOutputs[0].partial).toBe(true)
    expect(r.controlOutputs[0].branches?.length).toBe(2)
    expect(r.vars.parallelResults).toBeTruthy()
  })
})
