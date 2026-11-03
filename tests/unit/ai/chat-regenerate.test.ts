import { describe, expect, it } from 'vitest'
import {
  pickAssistantMessageId,
  shouldRegenerate
} from '../../../modules/ai/views/assistant/drawer/chatRegenerate'

const list = [
  { id: 1, role: 'user', requestId: 'r1' },
  { id: 2, role: 'assistant', requestId: 'r1' },
  { id: 3, role: 'user', requestId: 'r2' },
  { id: 4, role: 'assistant', requestId: 'r2' }
]

describe('pickAssistantMessageId', () => {
  it('优先用本条已有 id', () => {
    expect(pickAssistantMessageId({ id: 9, persisted: true }, list)).toBe(9)
  })
  it('按 requestId 匹配助手行', () => {
    expect(pickAssistantMessageId({ requestId: 'r1', persisted: true }, list)).toBe(2)
  })
  it('已入库且无 id/requestId 时取最后一条助手', () => {
    expect(pickAssistantMessageId({ persisted: true }, list)).toBe(4)
  })
  it('未入库时不猜最后一条', () => {
    expect(pickAssistantMessageId({}, list)).toBeNull()
  })
})

describe('shouldRegenerate', () => {
  it('有 messageId 且已入库/有 id/有 requestId 才走 regenerate', () => {
    expect(shouldRegenerate({ persisted: true }, 4)).toBe(true)
    expect(shouldRegenerate({ id: 4 }, 4)).toBe(true)
    expect(shouldRegenerate({ requestId: 'r2' }, 4)).toBe(true)
    expect(shouldRegenerate({}, 4)).toBe(false)
    expect(shouldRegenerate({ persisted: true }, null)).toBe(false)
  })
})
