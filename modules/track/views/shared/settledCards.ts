/**
 * 概览「已结算会话」口径指标卡（平均会话时长 / 跳出率）的展示规则。
 *
 * 会话静默 30 分钟后才结算，结算前时长与跳出未定稿，后端此时两项都回 0。
 * 「还没有已结算会话」和「真实值为 0」要区分开：前者显示占位符「—」，不显示 0ms / 0.0%。
 * 判定优先用后端下发的 settledSessionCount；老后端没有该字段时，按「会话数为 0」或
 * 「时长与跳出率同时为 0」认定为未结算（已结算会话里不会同时出现 0 时长与 0% 跳出：
 * 时长为 0 的会话只有一个页面，必然计入跳出）。
 *
 * @module views/track/shared/settledCards
 */

/** 无已结算会话时的占位符 */
export const UNSETTLED_PLACEHOLDER = '—'

export interface SettledCardsInput {
  sessionCount?: number | null
  settledSessionCount?: number | null
  avgSessionDurationMs?: number | null
  bounceRate?: number | null
}

/** 是否有已结算会话 */
export function hasSettledSessions(c: SettledCardsInput): boolean {
  if (c.settledSessionCount !== undefined && c.settledSessionCount !== null) {
    return Number(c.settledSessionCount) > 0
  }
  if (!Number(c.sessionCount)) return false
  return !(Number(c.avgSessionDurationMs || 0) === 0 && Number(c.bounceRate || 0) === 0)
}

/** 跳出率文本：比例（0–1）→ 一位小数百分比；无已结算会话 → 占位符 */
export function fmtBounceRate(c: SettledCardsInput): string {
  if (!hasSettledSessions(c)) return UNSETTLED_PLACEHOLDER
  return `${(Number(c.bounceRate || 0) * 100).toFixed(1)}%`
}

/** 平均会话时长文本：无已结算会话 → 占位符，否则交给 fmt 格式化 */
export function fmtAvgSessionDuration(c: SettledCardsInput, fmt: (ms: number) => string): string {
  if (!hasSettledSessions(c)) return UNSETTLED_PLACEHOLDER
  return fmt(Number(c.avgSessionDurationMs || 0))
}
