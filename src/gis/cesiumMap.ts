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
  const viewer = new Cesium.Viewer(container, {
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
  if (import.meta.env.DEV) {
    // 三维问题只能靠相机与切片状态定位，开发态挂个句柄给调试和 e2e 用
    ;(globalThis as unknown as { __cesiumViewer?: CesiumViewer }).__cesiumViewer = viewer
  }
  return viewer
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

type CesiumTileset = InstanceType<CesiumMod['Cesium3DTileset']>

/** 面要素挤出白模时的兜底楼高（米），属性里没有高度信息时用它 */
const EXTRUDE_FALLBACK_M = 30

/**
 * 把面要素挤成白模。高度依次取属性 height / 楼层数 ×3.4 / 兜底值，
 * 关掉时清空 extrudedHeight 回落成贴地面片。
 */
export function setCesiumExtrude(
  Cesium: CesiumMod,
  dataSource: InstanceType<CesiumMod['DataSource']> | undefined,
  enabled: boolean
): number {
  if (!dataSource) {
    return 0
  }
  const now = Cesium.JulianDate.now()
  let count = 0
  for (const entity of dataSource.entities.values) {
    if (!entity.polygon) {
      continue
    }
    if (!enabled) {
      entity.polygon.extrudedHeight = undefined
      continue
    }
    const props = (entity.properties?.getValue(now) ?? {}) as Record<string, unknown>
    const height = Number(props.height ?? NaN)
    const floors = Number(props.floors ?? NaN)
    const meters =
      Number.isFinite(height) && height > 0
        ? height
        : Number.isFinite(floors) && floors > 0
          ? floors * 3.4
          : EXTRUDE_FALLBACK_M
    entity.polygon.extrudedHeight = new Cesium.ConstantProperty(meters)
    count += 1
  }
  return count
}

/** 点选三维模型得到的属性行，用于 HUD 展示 */
export interface TilesetPick {
  properties: Array<{ key: string; value: string }>
}

/**
 * 加载 3D Tiles 切片。tileset.json 与切片体都过后端鉴权接口，必须自带 token，
 * 否则 Cesium 的请求不经 axios 拦截器会全部 401。
 */
export async function loadCesiumTileset(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  spec: { url: string; maximumScreenSpaceError: number; heightOffset: number }
): Promise<CesiumTileset> {
  const token = useUserStore().accessToken
  const resource = new Cesium.Resource({
    url: spec.url,
    headers: token ? { Authorization: token } : {}
  })
  const tileset = await Cesium.Cesium3DTileset.fromUrl(resource, {
    maximumScreenSpaceError: spec.maximumScreenSpaceError
  })
  applyTilesetHeightOffset(Cesium, tileset, spec.heightOffset)
  viewer.scene.primitives.add(tileset)
  return tileset
}

/** 切片贴地高度不准时整体抬降 */
export function applyTilesetHeightOffset(
  Cesium: CesiumMod,
  tileset: CesiumTileset,
  offset: number
): void {
  if (!offset) {
    tileset.modelMatrix = Cesium.Matrix4.IDENTITY.clone()
    return
  }
  const center = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center)
  const surface = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, 0)
  const target = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, offset)
  const translation = Cesium.Cartesian3.subtract(target, surface, new Cesium.Cartesian3())
  tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation)
}

export function removeCesiumTileset(viewer: CesiumViewer, tileset: CesiumTileset): void {
  viewer.scene.primitives.remove(tileset)
}

/**
 * 相机飞到切片包围球，避免用户切到三维后对着空地找模型。
 * 默认 flyTo 会贴到包围球边上（近到只看得见一面墙），这里按半径退开并压一个俯角。
 */
export function flyToCesiumTileset(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  tileset: CesiumTileset
): void {
  const radius = tileset.boundingSphere?.radius || 0
  const offset = radius
    ? new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(20),
        Cesium.Math.toRadians(-35),
        radius * 3
      )
    : undefined
  void viewer.flyTo(tileset, offset ? { duration: 1.2, offset } : { duration: 1.2 })
}

/**
 * 地形开关。Cesium 默认是平椭球，真高程要接 quantized-mesh 服务，
 * 地址由后端 `/gis/status` 的 `terrainUrl` 下发（sys_param `gis.terrain.url`）；
 * 没配地址时前端应把开关置灰，这里也直接回落平地形。
 */
export async function setCesiumTerrain(
  Cesium: CesiumMod,
  viewer: CesiumViewer,
  enabled: boolean,
  terrainUrl?: string
): Promise<boolean> {
  if (!enabled || !terrainUrl) {
    viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider()
    viewer.scene.globe.depthTestAgainstTerrain = false
    return false
  }
  const token = useUserStore().accessToken
  const resource = new Cesium.Resource({
    url: terrainUrl,
    headers: terrainUrl.startsWith('/') && token ? { Authorization: token } : {}
  })
  viewer.scene.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(resource, {
    requestVertexNormals: true
  })
  // 深度测试跟着地形开，否则贴地要素会从山体里透出来
  viewer.scene.globe.depthTestAgainstTerrain = true
  return true
}

/**
 * 读取点选到的三维要素属性。b3dm 的 Batch Table 属性通过 Cesium3DTileFeature 暴露。
 */
export function readTilesetPick(Cesium: CesiumMod, picked: unknown): TilesetPick | undefined {
  if (!(picked instanceof Cesium.Cesium3DTileFeature)) {
    return undefined
  }
  const properties = picked
    .getPropertyIds()
    .map((key) => ({ key, value: String(picked.getProperty(key) ?? '') }))
    .filter((row) => row.value !== '')
  return properties.length ? { properties } : undefined
}

export type { CesiumMod, CesiumTileset, CesiumViewer }
