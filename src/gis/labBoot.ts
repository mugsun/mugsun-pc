import type Map from 'ol/Map'
import { attachOlOverlays, type OlOverlayHandle } from './olOverlay'
import { DEFAULT_SCENE, type GisProviderCode } from './types'

export interface LabMapBag {
  map: Map
  overlays: OlOverlayHandle
  provider: GisProviderCode
  destroy: () => void
}

export async function bootLabMap(host: HTMLElement, provider: GisProviderCode): Promise<LabMapBag> {
  const olApi = await import('@/gis/olMap')
  await import('ol/ol.css')
  const map = olApi.createOlMap(host, { ...DEFAULT_SCENE.view2d, zoom: 13 }, provider)
  const overlays = attachOlOverlays(map)
  try {
    olApi.applyOlBasemap(map, provider, 'img_label')
  } catch {
    // 无密钥仍可叠加矢量
  }
  const resize = new ResizeObserver(() => map.updateSize())
  resize.observe(host)
  return {
    map,
    overlays,
    provider,
    destroy: () => {
      resize.disconnect()
      overlays.destroy()
      map.setTarget(undefined)
    }
  }
}

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const R = 6371000
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function labSnippet(code: string): string {
  const catalog: Record<string, string> = {
    poi: `GET /api/system/gis/demo/poi

WGS84 GeoJSON FeatureCollection。
同样结构即可入库、按 layerId 叠加。`,
    heat: `GET /api/system/gis/demo/heat

点 + 权重。前端用热力图层渲染。`,
    cluster: `GET /api/system/gis/demo/cluster

大量点：缩放到散开，缩小时聚合。`,
    playback: `GET /api/system/gis/demo/playback

折线 + properties.times（秒偏移）。
前端按时间沿折线插值移动。`,
    fence: `GET /api/system/gis/demo/fence

Polygon 围栏。可再调 contains / 面积。`,
    buffer: `GET /api/system/gis/demo/buffer
POST /api/system/gis/geo/analyze
{ "op": "buffer", "distance": 500, "payload": <上一步> }

distance 单位：米。`,
    radius: `GET /api/system/gis/demo/radius

单击地图改圆心，前端按 800 米过滤。`,
    geocode: `GET /api/system/gis/reverse?lon=116.397428&lat=39.90923

单击地图会带上当前点的经纬度。`,
    measure: `POST /api/system/gis/geo/analyze
{ "op": "length", "payload": { "type": "LineString", "coordinates": [[116.35,39.907],[116.44,39.908]] } }

面积：op 改 area，payload 改 Polygon。`
  }
  return catalog[code] || `GET /api/system/gis/demo/${code}`
}

function featuresOf(data: unknown): unknown[] | undefined {
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const row = data as Record<string, unknown>
  if (Array.isArray(row.features)) {
    return row.features
  }
  const inner = row.collection
  if (
    inner &&
    typeof inner === 'object' &&
    Array.isArray((inner as Record<string, unknown>).features)
  ) {
    return (inner as Record<string, unknown>).features as unknown[]
  }
  return undefined
}

/** 侧栏默认只展示条数 + 一条样例，避免整份 GeoJSON 糊满。 */
export function compactLabJson(data: unknown, expanded: boolean): string {
  if (data == null) {
    return ''
  }
  if (expanded) {
    return JSON.stringify(data, null, 2)
  }
  const features = featuresOf(data)
  if (!features || features.length <= 1) {
    return JSON.stringify(data, null, 2)
  }
  const row = data as Record<string, unknown>
  const sampleRoot = Array.isArray(row.features)
    ? {
        type: row.type,
        crs: row.crs,
        count: row.count ?? features.length,
        bbox: row.bbox,
        sample: features[0],
        omitted: features.length - 1
      }
    : {
        op: row.op,
        metrics: row.metrics,
        count: features.length,
        sample: features[0],
        omitted: features.length - 1
      }
  return JSON.stringify(sampleRoot, null, 2)
}
