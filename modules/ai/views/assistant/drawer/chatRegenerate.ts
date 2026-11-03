/**
 * AI 抽屉重试：优先走 boot #71 regenerate（不重复写提问）。
 * messageId 解析与是否可 regenerate 抽成纯函数，便于单测。
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
