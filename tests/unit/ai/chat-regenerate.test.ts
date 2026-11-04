import { describe, expect, it, vi } from 'vitest'
import {
  applyChatRetry,
  decideChatRetry,
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

describe('decideChatRetry / applyChatRetry', () => {
  it('已入库但解析不到 messageId → needRefresh', () => {
    const msg = { persisted: true, requestId: 'r-gone' }
    const messageId = pickAssistantMessageId(msg, [])
    expect(messageId).toBeNull()
    expect(decideChatRetry(msg, messageId, true)).toEqual({ action: 'needRefresh' })
  })

  it('有 session + messageId → regenerate', () => {
    expect(decideChatRetry({ persisted: true }, 4, true)).toEqual({
      action: 'regenerate',
      messageId: 4
    })
  })

  it('未入库且无 messageId → stream', () => {
    expect(decideChatRetry({ requestId: 'r1' }, null, true)).toEqual({ action: 'stream' })
  })

  it('applyChatRetry：persisted 无 id 时调 onNeedRefresh，不 regenerate/stream', async () => {
    const target: {
      persisted: boolean
      requestId: string
      pending: boolean
      error?: string
      id?: number
    } = { persisted: true, requestId: 'missing', pending: true }
    const list: { id: number; role: string; requestId: string }[] = []
    const regenerate = vi.fn()
    const stream = vi.fn()
    const onNeedRefresh = vi.fn(() => {
      target.pending = false
      target.error = '生成失败'
    })
    const messageId = pickAssistantMessageId(target, list)
    const action = await applyChatRetry(target, messageId, true, {
      regenerate,
      stream,
      onNeedRefresh
    })
    expect(action).toBe('needRefresh')
    expect(onNeedRefresh).toHaveBeenCalledTimes(1)
    expect(target.pending).toBe(false)
    expect(target.error).toBe('生成失败')
    expect(regenerate).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
  })

  it('applyChatRetry：能解析 messageId 时 regenerate 并回写 id', async () => {
    const target: { persisted: boolean; requestId: string; id?: number } = {
      persisted: true,
      requestId: 'r1'
    }
    const regenerate = vi.fn(async (id: string | number) => {
      expect(id).toBe(2)
    })
    const stream = vi.fn()
    const onNeedRefresh = vi.fn()
    const messageId = pickAssistantMessageId(target, list)
    const action = await applyChatRetry(target, messageId, true, {
      regenerate,
      stream,
      onNeedRefresh
    })
    expect(action).toBe('regenerate')
    expect(target.id).toBe(2)
    expect(regenerate).toHaveBeenCalledWith(2)
    expect(stream).not.toHaveBeenCalled()
    expect(onNeedRefresh).not.toHaveBeenCalled()
  })
})
