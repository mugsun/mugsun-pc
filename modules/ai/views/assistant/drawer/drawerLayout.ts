/**
 * AI 助手抽屉的纯函数：宽度约束、会话分组。
 * 不依赖 DOM，便于单测。
 */
export const DRAWER_WIDTH_DEFAULT = 560
export const DRAWER_WIDTH_MIN = 420
export const DRAWER_WIDTH_MAX = 800
/** 屏宽不超过这个值时抽屉全屏、不能拖 */
export const DRAWER_FULLSCREEN_BREAKPOINT = 640
export const DRAWER_WIDTH_STORAGE_KEY = 'mugsun-ai-drawer-width'

/** 把宽度夹到 [420, min(800, 视口宽)]；非法值回到默认宽 */
export function clampDrawerWidth(width: unknown, viewportWidth: number): number {
  const n = Number(width)
  const base = Number.isFinite(n) && n > 0 ? n : DRAWER_WIDTH_DEFAULT
  const max = Math.max(DRAWER_WIDTH_MIN, Math.min(DRAWER_WIDTH_MAX, viewportWidth))
  return Math.round(Math.min(max, Math.max(DRAWER_WIDTH_MIN, base)))
}

export type SessionGroup = 'today' | 'week' | 'earlier'

function parseTime(v: unknown): number {
  if (v == null || v === '') return NaN
  if (typeof v === 'number') return v
  // 后端返回 "2026-10-14 10:00:00"，Safari 不认空格
  return new Date(String(v).replace(' ', 'T')).getTime()
}

/** 按「今天 / 7 天内 / 更早」分组；没有时间的算更早 */
export function sessionGroupOf(time: unknown, now: Date = new Date()): SessionGroup {
  const ts = parseTime(time)
  if (!Number.isFinite(ts)) return 'earlier'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (ts >= startOfToday) return 'today'
  if (ts >= startOfToday - 6 * 24 * 3600 * 1000) return 'week'
  return 'earlier'
}

export const SESSION_GROUP_ORDER: SessionGroup[] = ['today', 'week', 'earlier']
