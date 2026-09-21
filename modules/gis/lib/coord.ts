import gcoord from 'gcoord'
import type { GisProviderCode } from './types'

/** 存储一律 WGS84；高德/百度仅在显示投影里转 GCJ-02 / BD-09 */
export function toDisplayLonLat(
  lonlat: [number, number],
  provider: GisProviderCode
): [number, number] {
  if (provider === 'amap') {
    return gcoord.transform(lonlat, gcoord.WGS84, gcoord.GCJ02) as [number, number]
  }
  if (provider === 'baidu') {
    return gcoord.transform(lonlat, gcoord.WGS84, gcoord.BD09) as [number, number]
  }
  return lonlat
}

export function fromDisplayLonLat(
  lonlat: [number, number],
  provider: GisProviderCode
): [number, number] {
  if (provider === 'amap') {
    return gcoord.transform(lonlat, gcoord.GCJ02, gcoord.WGS84) as [number, number]
  }
  if (provider === 'baidu') {
    return gcoord.transform(lonlat, gcoord.BD09, gcoord.WGS84) as [number, number]
  }
  return lonlat
}

/** 递归变换 GeoJSON coordinates（Point 为 [lon,lat]，其余为嵌套数组） */
export function mapLonLatCoords(
  coords: unknown,
  fn: (lonlat: [number, number]) => [number, number]
): unknown {
  if (!Array.isArray(coords) || coords.length === 0) {
    return coords
  }
  if (typeof coords[0] === 'number') {
    const lon = Number(coords[0])
    const lat = Number(coords[1])
    const [x, y] = fn([lon, lat])
    return coords.length > 2 ? [x, y, ...coords.slice(2)] : [x, y]
  }
  return coords.map((item) => mapLonLatCoords(item, fn))
}
