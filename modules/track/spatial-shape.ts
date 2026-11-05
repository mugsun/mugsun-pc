/**
 * 埋点「空间行为」契约形状（对齐 boot GET /api/system/track/spatial）。
 * mode：agg（cells+weight 热力）| points（点图层）
 * cells/points 类型与 @/gis/trackSpatial 对齐，供页壳与 GisSpatialMap 共用。
 *
 * 列表类 query（eventNames / funnelSteps）必须 join(',') 成单个 String 下发，
 * 与漏斗页 steps 一致；勿传 string[]（axios 会变成 eventNames[]=）。
 */

import type { TrackSpatialCell, TrackSpatialPoint } from '@/gis/trackSpatial'
import { filterValidCells, filterValidPoints } from '@/gis/trackSpatial'

export type { TrackSpatialCell, TrackSpatialPoint }

/** DEV + 显式 true 才启用本地假数据（仿 ask；.env.development 可开到后端 tip 就绪）。 */
export function isTrackSpatialMockEnabled(
  env: { DEV?: boolean; VITE_TRACK_SPATIAL_MOCK?: string } = import.meta.env as {
    DEV?: boolean
    VITE_TRACK_SPATIAL_MOCK?: string
  }
): boolean {
  return (
    Boolean(env.DEV) &&
    String(env.VITE_TRACK_SPATIAL_MOCK ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}

export type TrackSpatialMode = 'agg' | 'points'

export interface TrackSpatialResult {
  mode: TrackSpatialMode | string
  cells: TrackSpatialCell[]
  points: TrackSpatialPoint[]
  geoCount: number
  truncated: boolean
}

/** 发往 API 的 query：列表字段已是逗号分隔 String */
export interface TrackSpatialQuery {
  appKey: string
  days?: number
  mode?: TrackSpatialMode
  bbox?: string
  zoom?: number
  gridPrecision?: number
  /** 逗号分隔事件名，如 page_view,click */
  eventNames?: string
  funnelId?: string | number
  /** 逗号分隔正整数步骤号，如 1,2,3（对齐 boot parseFunnelSteps） */
  funnelSteps?: string
  convertedOnly?: boolean
  windowHours?: number
}

/** days 夹紧 1..30，缺省 7 */
export function clampSpatialDays(days?: number | null): number {
  if (days == null || !Number.isFinite(Number(days))) return 7
  return Math.min(30, Math.max(1, Math.trunc(Number(days))))
}

export function normalizeSpatialMode(mode?: string | null): TrackSpatialMode {
  return mode === 'points' ? 'points' : 'agg'
}

/**
 * 把多选值拼成单个逗号分隔 String（漏斗 steps 同口径）。
 * 空 / 全空白 → undefined（调用方勿挂到 params）。
 */
export function joinCsv(values: Array<string | number> | null | undefined): string | undefined {
  if (!values?.length) return undefined
  const parts = values.map((v) => String(v).trim()).filter(Boolean)
  return parts.length ? parts.join(',') : undefined
}

/** 解析逗号分隔；兼容误传 string[]（仅取 trim 非空） */
export function parseCsv(raw?: string | string[] | null): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean)
  }
  const s = String(raw).trim()
  if (!s) return []
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * boot parseFunnelSteps：只要正整数。非法片段丢弃。
 * 入参可为 "1,2,3" / ["1","2"] / [1,2]
 */
export function parsePositiveIntCsv(raw?: string | Array<string | number> | null): number[] {
  const parts = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter(Boolean)
    : parseCsv(raw == null ? null : String(raw))
  const out: number[] = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) continue
    const n = Number(p)
    if (!Number.isInteger(n) || n < 1) continue
    out.push(n)
  }
  return out
}

/** 空态：无 cell/point（按 mode） */
export function isSpatialEmpty(result: TrackSpatialResult | null | undefined): boolean {
  if (!result) return true
  const mode = normalizeSpatialMode(result.mode)
  if (mode === 'points') return !Array.isArray(result.points) || result.points.length === 0
  return !Array.isArray(result.cells) || result.cells.length === 0
}

/** 出参防御：缺键补空数组，丢掉非法坐标 */
export function normalizeSpatialResult(
  raw: Partial<TrackSpatialResult> | null | undefined
): TrackSpatialResult {
  const mode = normalizeSpatialMode(raw?.mode)
  const cells = filterValidCells(raw?.cells ?? [])
  const points = filterValidPoints(raw?.points ?? [])
  const geoCount =
    raw?.geoCount != null && Number.isFinite(Number(raw.geoCount))
      ? Number(raw.geoCount)
      : mode === 'points'
        ? points.length
        : cells.reduce((s, c) => s + (c.count ?? 0), 0)
  return {
    mode,
    cells,
    points,
    geoCount,
    truncated: Boolean(raw?.truncated)
  }
}

export type SpatialJump =
  | { kind: 'replay'; sessionId: string }
  | { kind: 'user'; userId?: string; distinctId?: string }
  | { kind: 'none'; reason: 'no-id' | 'no-replay-perm' }

/**
 * 点选跳转守卫：有 sessionId 且有回放权 → 回放；
 * 否则有 userId/distinctId → 用户；无 id 不跳。
 */
export function resolveSpatialPointJump(
  point: TrackSpatialPoint | null | undefined,
  canReplay: boolean
): SpatialJump {
  if (!point) return { kind: 'none', reason: 'no-id' }
  const sessionId = String(point.sessionId || '').trim()
  if (sessionId) {
    if (!canReplay) return { kind: 'none', reason: 'no-replay-perm' }
    return { kind: 'replay', sessionId }
  }
  const userId =
    point.userId !== undefined && point.userId !== null && String(point.userId).trim() !== ''
      ? String(point.userId)
      : undefined
  const distinctId = String(point.distinctId || '').trim() || undefined
  if (userId || distinctId) {
    return { kind: 'user', userId, distinctId }
  }
  return { kind: 'none', reason: 'no-id' }
}

/** 后端约定：zoom → gridPrecision p */
export function zoomToGridPrecision(zoom?: number | null): number {
  const z = Number(zoom)
  if (!Number.isFinite(z) || z <= 5) return 1
  if (z <= 8) return 2
  if (z <= 11) return 3
  return 4
}
