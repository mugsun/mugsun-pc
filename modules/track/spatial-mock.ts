/**
 * 埋点「空间行为」本地 mock（与 boot GET /api/system/track/spatial 出参同形）。
 * 仅由页面在 DEV 且 mock 开时动态 import；生产产物不含。
 */
import {
  clampSpatialDays,
  normalizeSpatialMode,
  type TrackSpatialCell,
  type TrackSpatialPoint,
  type TrackSpatialQuery,
  type TrackSpatialResult
} from './spatial-shape'

/** 上海附近散点，便于本地看热力/点选 */
const BASE: Array<{ lon: number; lat: number; name: string }> = [
  { lon: 121.4737, lat: 31.2304, name: 'page_view' },
  { lon: 121.48, lat: 31.235, name: 'click' },
  { lon: 121.465, lat: 31.22, name: 'page_view' },
  { lon: 121.49, lat: 31.24, name: 'purchase' },
  { lon: 121.455, lat: 31.228, name: 'click' },
  { lon: 121.5, lat: 31.215, name: 'page_view' },
  { lon: 121.47, lat: 31.25, name: 'add_cart' },
  { lon: 121.44, lat: 31.21, name: 'page_view' }
]

export function buildTrackSpatialMock(input: TrackSpatialQuery): TrackSpatialResult {
  const days = clampSpatialDays(input.days)
  const mode = normalizeSpatialMode(input.mode)
  const now = Date.now()
  const names = (input.eventNames || []).map((n) => String(n).trim()).filter(Boolean)
  const convertedOnly = Boolean(input.convertedOnly)

  let seed = BASE
  if (names.length) {
    seed = BASE.filter((b) => names.includes(b.name))
  }
  if (convertedOnly) {
    seed = seed.filter((_, i) => i % 2 === 0)
  }
  // 提问式空态：eventNames 含 __empty__
  if (names.includes('__empty__') || seed.length === 0) {
    return { mode, cells: [], points: [], geoCount: 0, truncated: false }
  }

  const points: TrackSpatialPoint[] = seed.map((b, i) => ({
    lon: b.lon,
    lat: b.lat,
    eventName: b.name,
    ts: now - i * 36e5,
    urlPath: i % 2 === 0 ? '/track/overview' : '/login',
    eventId: `ev_mock_spatial_${i + 1}`,
    sessionId: i === 1 ? '' : `sess_mock_spatial_${String(i + 1).padStart(3, '0')}`,
    distinctId: i === 2 ? `guest_mock_${i}` : undefined,
    userId: i === 2 ? undefined : i === 3 ? undefined : 1000 + i,
    converted: i % 2 === 0
  }))
  // i===3：无 session / user / distinct → 点选不跳（测守卫）
  if (points[3]) {
    points[3].sessionId = ''
    points[3].userId = undefined
    points[3].distinctId = undefined
  }

  const cells: TrackSpatialCell[] = seed.map((b, i) => {
    const count = 3 + i * 2 + days
    // 后端口径 weight=count；GisSpatialMap 内再按 max 归一化到热力
    return { lon: b.lon, lat: b.lat, count, weight: count }
  })

  const truncated = Boolean(input.zoom != null && Number(input.zoom) < 8)

  if (mode === 'points') {
    return {
      mode: 'points',
      cells: [],
      points,
      geoCount: points.length,
      truncated
    }
  }
  return {
    mode: 'agg',
    cells,
    points: [],
    geoCount: cells.reduce((s, c) => s + (c.count ?? 0), 0),
    truncated
  }
}
