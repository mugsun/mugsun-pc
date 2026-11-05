/** 空间行为分析图层：cells/points 纯函数（页壳组合 GisSpatialMap 用） */

export interface TrackSpatialCell {
  lon: number
  lat: number
  count?: number
  weight?: number
}

export interface TrackSpatialPoint {
  lon: number
  lat: number
  eventName?: string
  ts?: number
  urlPath?: string
  eventId?: string
  sessionId?: string
  distinctId?: string
  userId?: number | null
  converted?: boolean
}

export interface TrackSpatialViewport {
  /** minLon,minLat,maxLon,maxLat（EPSG:4326） */
  bbox: string
  zoom: number
}

/** weight ?? count ?? 1；非正数 / NaN 回落 1 */
export function cellWeight(cell: Pick<TrackSpatialCell, 'weight' | 'count'>): number {
  const raw = cell.weight ?? cell.count ?? 1
  return Number.isFinite(raw) && raw > 0 ? Number(raw) : 1
}

/**
 * OpenLayers Heatmap 会把 weight 夹到 [0,1]，聚合格用相对最大值归一化。
 * maxRaw≤0 时返回 1（单点兜底）。
 */
export function normalizeHeatWeight(raw: number, maxRaw: number): number {
  if (!(maxRaw > 0) || !Number.isFinite(raw)) {
    return 1
  }
  const n = raw / maxRaw
  if (!Number.isFinite(n) || n <= 0) {
    return 0
  }
  return n > 1 ? 1 : n
}

export function maxCellWeight(cells: TrackSpatialCell[]): number {
  let max = 0
  for (const c of cells) {
    const w = cellWeight(c)
    if (w > max) {
      max = w
    }
  }
  return max
}

export function pointHasReplay(point: Pick<TrackSpatialPoint, 'sessionId'>): boolean {
  return Boolean(point.sessionId && String(point.sessionId).trim())
}

export function pointHasUser(point: Pick<TrackSpatialPoint, 'distinctId' | 'userId'>): boolean {
  if (point.distinctId && String(point.distinctId).trim()) {
    return true
  }
  return point.userId != null && Number.isFinite(Number(point.userId))
}

/** 既不能回放也不能跳用户时点样式偏灰（纯视觉） */
export function pointDimmed(point: TrackSpatialPoint): boolean {
  return !pointHasReplay(point) && !pointHasUser(point)
}

export function isFiniteLonLat(lon: unknown, lat: unknown): boolean {
  return Number.isFinite(lon) && Number.isFinite(lat)
}

export function formatBbox(minLon: number, minLat: number, maxLon: number, maxLat: number): string {
  return `${minLon},${minLat},${maxLon},${maxLat}`
}

/** 丢掉非法坐标；cells 空数组原样返回 */
export function filterValidCells(cells: TrackSpatialCell[] | undefined | null): TrackSpatialCell[] {
  if (!cells?.length) {
    return []
  }
  return cells.filter((c) => isFiniteLonLat(c.lon, c.lat))
}

export function filterValidPoints(
  points: TrackSpatialPoint[] | undefined | null
): TrackSpatialPoint[] {
  if (!points?.length) {
    return []
  }
  return points.filter((p) => isFiniteLonLat(p.lon, p.lat))
}
