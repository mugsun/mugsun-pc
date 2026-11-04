/**
 * AI 抽屉/全页助手重试：优先走 boot #71 regenerate（不重复写提问）。
 * messageId 解析与重试分支抽成纯函数，便于单测。
 */

export type RegenTarget = {
  id?: string | number
  requestId?: string
  /** 出错前是否已收到过 SSE（提问/助手行多半已入库） */
  persisted?: boolean
}

export type SessionMessageRow = {
  id?: string | number
  role?: string
  requestId?: string
}

function hasId(id: string | number | null | undefined): id is string | number {
  return id != null && id !== ''
}

/**
 * 从本条或会话消息列表解析助手 messageId。
 * 优先本条 id → 同 requestId 的助手行 →（仅已入库时）会话最后一条助手。
 */
export function pickAssistantMessageId(
  msg: RegenTarget,
  list: SessionMessageRow[] | null | undefined
): string | number | null {
  if (hasId(msg.id)) return msg.id
  const rows = list || []
  if (msg.requestId) {
    const byReq = rows.find((m) => m.role === 'assistant' && m.requestId === msg.requestId)
    if (hasId(byReq?.id)) return byReq.id
  }
  // 未入库时不要猜「最后一条」，避免误 regenerate 别人的回复
  if (!msg.persisted) return null
  const last = [...rows].reverse().find((m) => m.role === 'assistant')
  return hasId(last?.id) ? last.id : null
}

/** 有 messageId 且（已入库 / 本就有 id / 有 requestId）时走 regenerate */
export function shouldRegenerate(msg: RegenTarget, messageId: string | number | null): boolean {
  if (!hasId(messageId)) return false
  return hasId(msg.id) || !!msg.persisted || !!msg.requestId
}

export type ChatRetryDecision =
  | { action: 'regenerate'; messageId: string | number }
  | { action: 'needRefresh' }
  | { action: 'stream' }

/** 已解析 messageId 后决定 regenerate / 提示刷新 / 再走 stream */
export function decideChatRetry(
  msg: RegenTarget,
  messageId: string | number | null,
  hasSession: boolean
): ChatRetryDecision {
  if (shouldRegenerate(msg, messageId) && hasSession && messageId != null) {
    return { action: 'regenerate', messageId }
  }
  if (msg.persisted) return { action: 'needRefresh' }
  return { action: 'stream' }
}

export type ChatRetryHandlers = {
  regenerate: (messageId: string | number) => void | Promise<void>
  stream: () => void | Promise<void>
  /** 已入库但解析不到 messageId：调用方清 pending、写 error、toast retryNeedRefresh */
  onNeedRefresh: () => void
}

/**
 * 按 decideChatRetry 结果调度；regenerate 前把 messageId 写回本条。
 * 返回实际走的分支，便于单测断言。
 */
export async function applyChatRetry(
  msg: RegenTarget,
  messageId: string | number | null,
  hasSession: boolean,
  handlers: ChatRetryHandlers
): Promise<ChatRetryDecision['action']> {
  const decision = decideChatRetry(msg, messageId, hasSession)
  if (decision.action === 'regenerate') {
    msg.id = decision.messageId
    await handlers.regenerate(decision.messageId)
    return 'regenerate'
  }
  if (decision.action === 'needRefresh') {
    handlers.onNeedRefresh()
    return 'needRefresh'
  }
  await handlers.stream()
  return 'stream'
}
