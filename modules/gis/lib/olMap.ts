import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, toLonLat } from 'ol/proj'
import { ScaleLine, defaults as defaultControls } from 'ol/control'
import type ImageTile from 'ol/ImageTile'
import type { GisProviderCode, GisStyleCode, GisView2d } from './types'
import { layersForStyle, tileUrl } from './types'
import { loadAuthedTileBlob, TileEmptyError, TileHttpError } from './authTile'
import { isNeutralTileReason, tileHealthFor } from './tileHealth'
import { attributionOf, escapeAttribution } from './attribution'

import { fromDisplayLonLat, toDisplayLonLat } from './coord'

export const OL_ROLE_BASEMAP = 'basemap'
export const OL_ROLE_SKETCH = 'sketch'
export const OL_ROLE_OVERLAY = 'overlay'

export interface OlMapOptions {
  /** 缩放控件（+/−），默认开；小尺寸嵌入卡片可关掉 */
  zoomControl?: boolean
}

export function createOlMap(
  target: HTMLElement,
  view: GisView2d,
  provider: GisProviderCode,
  options: OlMapOptions = {}
): Map {
  const map = new Map({
    target,
    view: new View({
      center: fromLonLat(toDisplayLonLat(view.center, provider)),
      zoom: view.zoom,
      rotation: view.rotation ?? 0
    }),
    // 打开版权归属控件：OSM / CARTO 等条款要求在地图上署名
    controls: defaultControls({
      rotate: false,
      attribution: true,
      attributionOptions: { collapsible: false },
      zoom: options.zoomControl ?? true
    }).extend([new ScaleLine({ units: 'metric' })])
  })
  map.getViewport().setAttribute('tabindex', '0')
  if (import.meta.env.DEV) {
    // 二维图层的加载问题只能靠 source 状态定位，开发态挂个句柄给调试用
    ;(globalThis as unknown as { __olMap?: Map }).__olMap = map
  }
  return map
}

/** 失败原因码：后端原因头 > 旧版空白瓦片 > 网络错误 */
export function tileFailReason(e: unknown): string {
  if (e instanceof TileHttpError) return e.reason
  if (e instanceof TileEmptyError) return 'empty-tile'
  return 'network'
}

export function applyOlBasemap(map: Map, provider: GisProviderCode, style: GisStyleCode): void {
  map
    .getLayers()
    .getArray()
    .filter((layer) => layer.get('mugsunRole') === OL_ROLE_BASEMAP)
    .forEach((layer) => map.removeLayer(layer))
  let z = 0
  const credit = attributionOf(provider)
  const target = map.getTargetElement()
  const health = target ? tileHealthFor(target) : undefined
  health?.reset()
  const sources: XYZ[] = []
  for (const layer of layersForStyle(style, provider)) {
    const tile = new TileLayer({
      zIndex: z++,
      source: new XYZ({
        // 叠层只署名一次（注记层与底图同一家）
        attributions: credit && z === 1 ? escapeAttribution(credit) : undefined,
        url: tileUrl(provider, layer, '{z}', '{x}', '{y}'),
        tileLoadFunction: (tileItem, src) => {
          const imageTile = tileItem as ImageTile
          health?.start()
          loadAuthedTileBlob(src)
            .then((objectUrl) => {
              health?.success()
              const img = imageTile.getImage() as HTMLImageElement
              img.onload = () => URL.revokeObjectURL(objectUrl)
              img.src = objectUrl
            })
            .catch((e: unknown) => {
              const img = imageTile.getImage() as HTMLImageElement
              if (e instanceof TileHttpError && isNeutralTileReason(e.reason)) {
                health?.neutral()
              } else {
                health?.fail(tileFailReason(e))
              }
              if (e instanceof TileEmptyError) {
                img.onload = () => URL.revokeObjectURL(e.objectUrl)
                img.src = e.objectUrl
              } else {
                img.src = ''
              }
            })
        },
        wrapX: true,
        maxZoom: 18
      })
    })
    tile.set('mugsunRole', OL_ROLE_BASEMAP)
    sources.push(tile.getSource() as XYZ)
    map.addLayer(tile)
  }
  // 重试：刷新底图图层源，重新请求全部瓦片
  health?.setRetry(() => sources.forEach((src) => src.refresh()))
}

export function setOlView(map: Map, view: GisView2d, provider: GisProviderCode): void {
  const olView = map.getView()
  olView.setCenter(fromLonLat(toDisplayLonLat(view.center, provider)))
  olView.setZoom(view.zoom)
  olView.setRotation(view.rotation ?? 0)
}

export function readOlView(map: Map, provider: GisProviderCode): GisView2d {
  const view = map.getView()
  const center = view.getCenter()
  const projected = center
    ? (toLonLat(center) as [number, number])
    : ([116.397428, 39.90923] as [number, number])
  const lonlat = fromDisplayLonLat(projected, provider)
  return {
    center: [Number(lonlat[0].toFixed(6)), Number(lonlat[1].toFixed(6))],
    zoom: view.getZoom() ?? 11,
    rotation: view.getRotation()
  }
}

export function pointerWgs84(
  map: Map,
  pixel: number[],
  provider: GisProviderCode
): [number, number] | null {
  const coord = map.getCoordinateFromPixel(pixel)
  if (!coord) {
    return null
  }
  const display = toLonLat(coord) as [number, number]
  const wgs = fromDisplayLonLat(display, provider)
  return [Number(wgs[0].toFixed(6)), Number(wgs[1].toFixed(6))]
}

/**
 * 按 WGS84 经纬度范围定位视野。矢量瓦片图层前端没有要素，
 * 算不出 OpenLayers 的 extent，只能拿图层入库时算好的 bbox 来构图。
 */
export function fitOlLonLatExtent(
  map: Map,
  provider: GisProviderCode,
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number
): void {
  const sw = fromLonLat(toDisplayLonLat([minLon, minLat], provider))
  const ne = fromLonLat(toDisplayLonLat([maxLon, maxLat], provider))
  map.getView().fit([sw[0], sw[1], ne[0], ne[1]], {
    padding: [48, 48, 48, 48],
    maxZoom: 16,
    duration: 280
  })
}

/** 当前视野的经纬度范围（WGS84），用于「查当前视野内的要素」 */
export function readOlExtentLonLat(
  map: Map,
  provider: GisProviderCode
): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const [minX, minY, maxX, maxY] = map.getView().calculateExtent(map.getSize() ?? [800, 600])
  const sw = fromDisplayLonLat(toLonLat([minX, minY]) as [number, number], provider)
  const ne = fromDisplayLonLat(toLonLat([maxX, maxY]) as [number, number], provider)
  return {
    minLon: Number(sw[0].toFixed(6)),
    minLat: Number(sw[1].toFixed(6)),
    maxLon: Number(ne[0].toFixed(6)),
    maxLat: Number(ne[1].toFixed(6))
  }
}
