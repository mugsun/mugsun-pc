import type { GisProviderCode, GisSketchFeature, GisStyleCode, GisView3d } from './types'
import { layersForStyle, tileUrl } from './types'
import { fromDisplayLonLat, mapLonLatCoords, toDisplayLonLat } from './coord'
import { useUserStore } from '@/store/modules/user'

type CesiumMod = typeof import('cesium')
type CesiumViewer = InstanceType<CesiumMod['Viewer']>

export async function loadCesium(): Promise<CesiumMod> {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  ;(globalThis as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = `${base}cesiumStatic/`
  const Cesium = await import('cesium')
  await import('cesium/Build/Cesium/Widgets/widgets.css')
  Cesium.Ion.defaultAccessToken = ''
  return Cesium
}

export function createCesiumViewer(container: HTMLElement, Cesium: CesiumMod): CesiumViewer {
  return new Cesium.Viewer(container, {
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    creditContainer: document.createElement('div'),
    baseLayer: false,
    terrain: undefined
  })
}

export function applyCesiumBasemap(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  provider: GisProviderCode,
  style: GisStyleCode
): void {
  viewer.imageryLayers.removeAll()
  const token = useUserStore().accessToken
  for (const layer of layersForStyle(style, provider)) {
    const url = new Cesium.Resource({
      url: tileUrl(provider, layer, '{z}', '{x}', '{y}'),
      headers: token ? { Authorization: token } : {}
    })
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        maximumLevel: 18
      })
    )
  }
}

export function flyCesiumTo(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  view: GisView3d,
  provider: GisProviderCode
): void {
  const [lon, lat] = toDisplayLonLat([view.lon, view.lat], provider)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, view.height),
    orientation: {
      heading: Cesium.Math.toRadians(view.heading ?? 0),
      pitch: Cesium.Math.toRadians(view.pitch ?? -45),
      roll: 0
    }
  })
}

export function readCesiumView(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  provider: GisProviderCode
): GisView3d {
  const carto = viewer.camera.positionCartographic
  const display: [number, number] = [
    Cesium.Math.toDegrees(carto.longitude),
    Cesium.Math.toDegrees(carto.latitude)
  ]
  const [lon, lat] = fromDisplayLonLat(display, provider)
  return {
    lon: Number(lon.toFixed(6)),
    lat: Number(lat.toFixed(6)),
    height: Math.round(carto.height),
    heading: Number(Cesium.Math.toDegrees(viewer.camera.heading).toFixed(2)),
    pitch: Number(Cesium.Math.toDegrees(viewer.camera.pitch).toFixed(2))
  }
}

export async function syncCesiumSketch(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  features: GisSketchFeature[],
  provider: GisProviderCode,
  previous?: InstanceType<CesiumMod['DataSource']>
): Promise<InstanceType<CesiumMod['DataSource']> | undefined> {
  if (previous) {
    viewer.dataSources.remove(previous, true)
  }
  const visible = features.filter((f) => f.properties.visible !== false && f.geometry)
  if (!visible.length) {
    return undefined
  }
  const display = visible.map((feat) => ({
    ...feat,
    geometry: {
      type: feat.geometry.type,
      coordinates: mapLonLatCoords(feat.geometry.coordinates, (ll) => toDisplayLonLat(ll, provider))
    }
  }))
  const ds = await Cesium.GeoJsonDataSource.load(
    { type: 'FeatureCollection', features: display },
    {
      clampToGround: true,
      stroke: Cesium.Color.fromCssColorString('#2563eb'),
      strokeWidth: 3,
      fill: Cesium.Color.fromCssColorString('#2563eb').withAlpha(0.28)
    }
  )
  await viewer.dataSources.add(ds)
  for (const entity of ds.entities.values) {
    if (entity.billboard) {
      entity.billboard = undefined
      entity.point = new Cesium.PointGraphics({
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#2563eb'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      })
    }
  }
  return ds
}

export type { CesiumMod, CesiumViewer }
