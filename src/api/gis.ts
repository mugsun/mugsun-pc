import request from '@/utils/http'

export type GisId = string | number

export interface GisProviderStatus {
  provider: string
  configured: boolean
  enabled: boolean
  id?: number
}

export interface GisStatus {
  enabled: boolean
  providers: GisProviderStatus[]
  /** quantized-mesh 地形服务地址，空串表示未配置，三维地形开关应置灰 */
  terrainUrl?: string
  /** 随包发布的内置三维切片 code */
  tilesets?: string[]
}

export interface GisProviderRow {
  id?: number
  provider: string
  enabled?: number
  extraJson?: string
  remark?: string
}

export interface GisScene {
  id?: GisId
  name: string
  sceneJson?: string
  status?: number
  remark?: string
}

export function fetchGisStatus() {
  return request.get<GisStatus>({ url: '/api/system/gis/status' })
}

export function fetchGisProviderList() {
  return request.get<GisProviderRow[]>({ url: '/api/system/gis/provider/list' })
}

export function fetchSaveGisProvider(data: Record<string, unknown>) {
  return request.post<void>({ url: '/api/system/gis/provider/submit', data })
}

export function fetchRemoveGisProvider(ids: number[]) {
  return request.post<void>({ url: '/api/system/gis/provider/remove', data: ids })
}

export function fetchGisScenePage(params: Record<string, unknown>) {
  return request.get<{ records: GisScene[]; totalRow: number; total?: number }>({
    url: '/api/system/gis/scene/page',
    params
  })
}

export function fetchGisSceneDetail(id: GisId) {
  return request.get<GisScene>({ url: `/api/system/gis/scene/detail/${id}` })
}

export function fetchSaveGisScene(data: GisScene) {
  return request.post<GisScene>({ url: '/api/system/gis/scene/submit', data })
}

export function fetchRemoveGisScene(ids: GisId[]) {
  return request.post<void>({ url: '/api/system/gis/scene/remove', data: ids })
}

export interface GisPoi {
  name: string
  address?: string
  lon: number
  lat: number
  kind?: string
}

export interface GisReverse {
  lon: number
  lat: number
  address?: string
  province?: string
  city?: string
  county?: string
  poi?: string
}

export function fetchGisSearch(params: {
  q: string
  lon?: number
  lat?: number
  provider: string
}) {
  return request.get<GisPoi[]>({ url: '/api/system/gis/search', params })
}

export function fetchGisReverse(lon: number, lat: number, provider: string) {
  return request.get<GisReverse>({ url: '/api/system/gis/reverse', params: { lon, lat, provider } })
}

export interface GisLayerRow {
  id?: GisId
  name: string
  kind?: string
  crs?: string
  dataJson?: string
  styleJson?: string
  featureCount?: number
  bbox?: string
  status?: number
  remark?: string
}

export function fetchGisLayerPage(params: Record<string, unknown>) {
  return request.get<{ records: GisLayerRow[]; totalRow: number }>({
    url: '/api/system/gis/layer/page',
    params
  })
}

export function fetchGisLayerList() {
  return request.get<GisLayerRow[]>({ url: '/api/system/gis/layer/list' })
}

export function fetchGisLayerDetail(id: GisId) {
  return request.get<GisLayerRow>({ url: `/api/system/gis/layer/detail/${id}` })
}

export function fetchGisLayerIngest(payload: unknown) {
  return request.post<{ count: number; features: unknown[]; crs: string }>({
    url: '/api/system/gis/layer/ingest',
    data: payload
  })
}

export function fetchSaveGisLayer(data: Record<string, unknown>) {
  return request.post<GisLayerRow>({ url: '/api/system/gis/layer/submit', data })
}

export function fetchRemoveGisLayer(ids: GisId[]) {
  return request.post<void>({ url: '/api/system/gis/layer/remove', data: ids })
}

export interface GisAnalyzeResult {
  op: string
  crs?: string
  metrics?: Record<string, number | boolean | string>
  collection?: { count?: number; features?: unknown[]; bbox?: number[] }
}

export function fetchGisAnalyze(data: Record<string, unknown>) {
  return request.post<GisAnalyzeResult>({ url: '/api/system/gis/geo/analyze', data })
}

export interface GisDemoMeta {
  code: string
  title: string
  summary?: string
  kind?: string
  count?: number
  group?: string
  ui?: string
}

export function fetchGisDemoList() {
  return request.get<GisDemoMeta[]>({ url: '/api/system/gis/demo/list' })
}

export function fetchGisDemo(code: string) {
  return request.get<{ count?: number; features?: unknown[] }>({
    url: `/api/system/gis/demo/${code}`
  })
}

/** 空间查询结果：GeoJSON FeatureCollection + 执行引擎与是否被截断 */
export interface GisSpatialResult {
  type: string
  features: unknown[]
  count: number
  /** postgis 表示下沉数据库执行，java 表示回落内存执行 */
  engine: 'postgis' | 'java'
  truncated: boolean
}

export interface GisSpatialStatus {
  postgis: boolean
  mvt: boolean
  limitMax: number
}

export function fetchGisSpatialStatus() {
  return request.get<GisSpatialStatus>({ url: '/api/system/gis/spatial/status' })
}

export function fetchGisSpatialBbox(params: {
  layerId: GisId
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
  limit?: number
  engine?: 'java'
}) {
  return request.get<GisSpatialResult>({ url: '/api/system/gis/spatial/bbox', params })
}

export function fetchGisSpatialRadius(params: {
  layerId: GisId
  lon: number
  lat: number
  meters: number
  limit?: number
  engine?: 'java'
}) {
  return request.get<GisSpatialResult>({ url: '/api/system/gis/spatial/radius', params })
}

export function fetchGisSpatialNearest(params: {
  layerId: GisId
  lon: number
  lat: number
  limit?: number
  engine?: 'java'
}) {
  return request.get<GisSpatialResult>({ url: '/api/system/gis/spatial/nearest', params })
}

export function fetchGisSpatialIntersects(data: {
  layerId: GisId
  geometry: unknown
  limit?: number
  engine?: 'java'
}) {
  return request.post<GisSpatialResult>({ url: '/api/system/gis/spatial/intersects', data })
}

/**
 * 矢量瓦片模板地址（交给 OpenLayers 拼 z/x/y）。
 * layerId 保持字符串：雪花 ID 有 18 位，转成 number 会丢精度。
 */
export function gisMvtUrlTemplate(layerId: GisId): string {
  return `/api/system/gis/spatial/mvt/${layerId}/{z}/{x}/{y}`
}
