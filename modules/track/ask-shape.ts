/**
 * 埋点「问数据」契约形状（对齐 boot POST /api/system/track/ask）。
 * resultType：metrics | series | table | raw | unsupported
 * series：趋势行 [{date|time, pv, uv, ...}]（非 {name,points}）
 */

import type { LineDataItem } from '@/types/component/chart'

/** 日内趋势横轴：epochMs → HH:mm:ss（避免拉 useTrackApp 进单测） */
function fmtAskClock(ts?: number | string): string {
  if (ts === undefined || ts === null || ts === '') return '-'
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** DEV + 显式 true 才启用本地假数据（默认关，走 POST /api/system/track/ask） */
export function isTrackAskMockEnabled(
  env: { DEV?: boolean; VITE_TRACK_ASK_MOCK?: string } = import.meta.env as {
    DEV?: boolean
    VITE_TRACK_ASK_MOCK?: string
  }
): boolean {
  return (
    Boolean(env.DEV) &&
    String(env.VITE_TRACK_ASK_MOCK ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}

export type TrackAskIntent =
  | 'overview'
  | 'trend'
  | 'pages'
  | 'events'
  | 'errors'
  | 'online'
  | 'vitals'
  | 'funnel'
  | 'retention'
  | 'geo'
  | 'unsupported'

/** boot 真枚举；metric/text 仅兼容旧 mock */
export type TrackAskResultType =
  | 'metrics'
  | 'series'
  | 'table'
  | 'raw'
  | 'unsupported'
  | 'metric'
  | 'text'

export interface TrackAskReplayItem {
  sessionId: string
  appKey: string
  startTime?: number
  entryPath?: string
  hasError?: number
  durationMs?: number
}

/** boot 趋势行（days>2 有 date；days≤2 有 time=epochMs） */
export type TrackAskSeriesRow = {
  date?: string
  time?: number | string
  pv?: number
  uv?: number
  sessionCount?: number
  eventCount?: number
  [k: string]: unknown
}

/** 旧 mock 折线形态（兼容，新 mock 不再产出） */
export type TrackAskSeriesLegacy = {
  name: string
  points: Array<{ x: string | number; y: number }>
}

export interface TrackAskResult {
  question: string
  intent: TrackAskIntent | string
  params: {
    days?: number
    eventName?: string
    dimType?: string
    dimKey?: string
    steps?: string[] | string
    windowHours?: number
    fingerprint?: string
    routePath?: string
    limit?: number
  }
  source: 'track-analysis' | string
  resultType: TrackAskResultType | string
  summary: string
  metrics: Record<string, number | string> | null
  series: Array<TrackAskSeriesRow | TrackAskSeriesLegacy> | null
  table: Array<Record<string, string | number | null>> | null
  raw: Record<string, unknown> | null
  replays: TrackAskReplayItem[]
  replayEmpty: boolean
  replayDenied: boolean
  warnings: string[]
}

/** 指标卡：boot=metrics；兼容旧 metric */
export function isAskMetricsType(resultType?: string | null): boolean {
  return resultType === 'metrics' || resultType === 'metric'
}

/** 不支持引导：boot=unsupported；兼容旧 text */
export function isAskUnsupportedType(resultType?: string | null, intent?: string | null): boolean {
  return resultType === 'unsupported' || resultType === 'text' || intent === 'unsupported'
}

/**
 * 把 boot 趋势行或旧 {name,points} 折成 ArtLineChart 入参。
 * 优先 boot 行形态（与 overview 页同口径）。
 */
export function adaptAskChart(series: unknown): { labels: string[]; items: LineDataItem[] } {
  if (!Array.isArray(series) || series.length === 0) {
    return { labels: [], items: [] }
  }
  const first = series[0] as Record<string, unknown> | null
  if (!first || typeof first !== 'object') {
    return { labels: [], items: [] }
  }

  // 旧 mock：{ name, points:[{x,y}] }
  if (Array.isArray((first as TrackAskSeriesLegacy).points)) {
    const legacy = series as TrackAskSeriesLegacy[]
    const labels = (legacy[0]?.points || []).map((p) => String(p.x))
    const items: LineDataItem[] = legacy.map((s) => ({
      name: String(s.name || 'series'),
      data: (s.points || []).map((p) => Number(p.y) || 0)
    }))
    return { labels, items }
  }

  // boot：[{date|time, pv, uv, sessionCount, eventCount}]
  const rows = series as TrackAskSeriesRow[]
  const byDay = rows.some((r) => r.date !== undefined && r.date !== null)
  const labels = rows.map((r) =>
    byDay ? String(r.date).slice(5) : fmtAskClock(r.time as number | string | undefined)
  )
  const items: LineDataItem[] = [
    { name: 'PV', data: rows.map((r) => Number(r.pv ?? 0)), showAreaColor: true }
  ]
  if (byDay && rows.some((r) => r.uv != null)) {
    items.push({ name: 'UV', data: rows.map((r) => Number(r.uv ?? 0)) })
  }
  if (rows.some((r) => r.sessionCount != null)) {
    items.push({
      name: 'sessionCount',
      data: rows.map((r) => Number(r.sessionCount ?? 0))
    })
  }
  if (rows.some((r) => r.eventCount != null)) {
    items.push({
      name: 'eventCount',
      data: rows.map((r) => Number(r.eventCount ?? 0))
    })
  }
  return { labels, items }
}

export type AskRawPreview =
  | { kind: 'table'; titleKey: string; rows: Record<string, unknown>[]; cols: string[] }
  | { kind: 'json'; text: string }

/** raw 结构化兜底：regions / steps 优先成表，否则 JSON */
export function previewAskRaw(
  raw: Record<string, unknown> | null | undefined
): AskRawPreview | null {
  if (!raw || typeof raw !== 'object') return null
  const regions = raw.regions
  if (Array.isArray(regions) && regions.length) {
    const rows = regions as Record<string, unknown>[]
    const cols = Object.keys(rows[0] || {})
    return { kind: 'table', titleKey: 'regions', rows, cols }
  }
  const steps = raw.steps
  if (Array.isArray(steps) && steps.length) {
    const rows = steps as Record<string, unknown>[]
    const cols = Object.keys(rows[0] || {})
    return { kind: 'table', titleKey: 'steps', rows, cols }
  }
  try {
    return { kind: 'json', text: JSON.stringify(raw, null, 2) }
  } catch {
    return { kind: 'json', text: String(raw) }
  }
}
