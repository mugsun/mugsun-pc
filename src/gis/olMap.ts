import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import { fromLonLat, toLonLat } from 'ol/proj'
import { ScaleLine, defaults as defaultControls } from 'ol/control'
import type ImageTile from 'ol/ImageTile'
import type { GisProviderCode, GisStyleCode, GisView2d } from './types'
import { layersForStyle, tileUrl } from './types'
import { loadAuthedTileBlob } from './authTile'

import { fromDisplayLonLat, toDisplayLonLat } from './coord'

export const OL_ROLE_BASEMAP = 'basemap'
export const OL_ROLE_SKETCH = 'sketch'
export const OL_ROLE_OVERLAY = 'overlay'

export function createOlMap(target: HTMLElement, view: GisView2d, provider: GisProviderCode): Map {
  const map = new Map({
    target,
    view: new View({
      center: fromLonLat(toDisplayLonLat(view.center, provider)),
      zoom: view.zoom,
      rotation: view.rotation ?? 0
    }),
    controls: defaultControls({ rotate: false, attribution: false, zoom: true }).extend([
      new ScaleLine({ units: 'metric' })
    ])
  })
  map.getViewport().setAttribute('tabindex', '0')
  return map
}

export function applyOlBasemap(map: Map, provider: GisProviderCode, style: GisStyleCode): void {
  map
    .getLayers()
    .getArray()
    .filter((layer) => layer.get('mugsunRole') === OL_ROLE_BASEMAP)
    .forEach((layer) => map.removeLayer(layer))
  let z = 0
  for (const layer of layersForStyle(style, provider)) {
    const tile = new TileLayer({
      zIndex: z++,
      source: new XYZ({
        url: tileUrl(provider, layer, '{z}', '{x}', '{y}'),
        tileLoadFunction: (tileItem, src) => {
          const imageTile = tileItem as ImageTile
          loadAuthedTileBlob(src)
            .then((objectUrl) => {
              const img = imageTile.getImage() as HTMLImageElement
              img.onload = () => URL.revokeObjectURL(objectUrl)
              img.src = objectUrl
            })
            .catch(() => {
              ;(imageTile.getImage() as HTMLImageElement).src = ''
            })
        },
        wrapX: true,
        maxZoom: 18
      })
    })
    tile.set('mugsunRole', OL_ROLE_BASEMAP)
    map.addLayer(tile)
  }
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
