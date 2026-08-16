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

export function fetchGisSearch(params: { q: string; lon?: number; lat?: number }) {
  return request.get<GisPoi[]>({ url: '/api/system/gis/search', params })
}

export function fetchGisReverse(lon: number, lat: number) {
  return request.get<GisReverse>({ url: '/api/system/gis/reverse', params: { lon, lat } })
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
