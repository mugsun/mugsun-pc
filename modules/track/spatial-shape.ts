/**
 * 埋点「空间行为」契约形状（对齐 boot GET /api/system/track/spatial）。
 * mode：agg（cells+weight 热力）| points（点图层）
 * cells/points 类型与 @/gis/trackSpatial 对齐，供页壳与 GisSpatialMap 共用。
 */

import type { TrackSpatialCell, TrackSpatialPoint } from '@/gis/trackSpatial'

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

export interface TrackSpatialQuery {
  appKey: string
  days?: number
  mode?: TrackSpatialMode
  bbox?: string
  zoom?: number
  gridPrecision?: number
  eventNames?: string[]
  funnelId?: string | number
  funnelSteps?: string[]
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

/** 空态：无 cell/point（按 mode） */
export function isSpatialEmpty(result: TrackSpatialResult | null | undefined): boolean {
  if (!result) return true
  const mode = normalizeSpatialMode(result.mode)
  if (mode === 'points') return !Array.isArray(result.points) || result.points.length === 0
  return !Array.isArray(result.cells) || result.cells.length === 0
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
