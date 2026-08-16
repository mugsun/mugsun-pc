export type GisProviderCode = 'tianditu' | 'amap' | 'baidu' | 'google'
export type GisStyleCode = 'vec' | 'img' | 'img_label' | 'vec_label'
export type GisViewMode = '2d' | '3d'
export type GisFeatureKind =
  | 'point'
  | 'line'
  | 'polygon'
  | 'circle'
  | 'rect'
  | 'text'
  | 'measureLength'
  | 'measureArea'
export type GisDrawTool = 'pan' | 'select' | GisFeatureKind

export const SKETCH_LAYER_TYPE = 'sketch'

export interface GisSketchProps {
  name: string
  kind: GisFeatureKind
  visible: boolean
  label?: string
  color?: string
  remark?: string
  text?: string
  attrs?: Record<string, unknown>
}

export interface GisSketchFeature {
  type: 'Feature'
  id: string
  properties: GisSketchProps
  geometry: { type: string; coordinates: unknown }
}

export interface GisSketchLayer {
  type: typeof SKETCH_LAYER_TYPE
  features: GisSketchFeature[]
}

export interface GisBaseMapSpec {
  provider: GisProviderCode
  style: GisStyleCode
}

export interface GisView2d {
  center: [number, number]
  zoom: number
  rotation?: number
}

export interface GisView3d {
  lon: number
  lat: number
  height: number
  heading: number
  pitch: number
}

export type OverlayKind = 'vector' | 'heatmap' | 'xyz' | 'wms'

export interface GisOverlayRef {
  id: string
  layerId?: string | number
  name: string
  kind: OverlayKind
  visible: boolean
  color?: string
  opacity?: number
}

export interface GisSceneSpec {
  viewMode: GisViewMode
  baseMap: GisBaseMapSpec
  view2d: GisView2d
  view3d: GisView3d
  layers: GisSketchLayer[]
  overlayLayers?: GisOverlayRef[]
  heatmap?: boolean
}

export const DEFAULT_SCENE: GisSceneSpec = {
  viewMode: '2d',
  baseMap: { provider: 'tianditu', style: 'img_label' },
  view2d: { center: [116.397428, 39.90923], zoom: 11, rotation: 0 },
  view3d: { lon: 116.397428, lat: 39.90923, height: 18000, heading: 0, pitch: -45 },
  layers: []
}

export function parseSceneJson(raw?: string | null): GisSceneSpec {
  if (!raw) {
    return {
      ...DEFAULT_SCENE,
      baseMap: { ...DEFAULT_SCENE.baseMap },
      view2d: { ...DEFAULT_SCENE.view2d },
      view3d: { ...DEFAULT_SCENE.view3d },
      layers: []
    }
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GisSceneSpec>
    return {
      viewMode: parsed.viewMode === '3d' ? '3d' : '2d',
      baseMap: {
        provider: parsed.baseMap?.provider ?? DEFAULT_SCENE.baseMap.provider,
        style: parsed.baseMap?.style ?? DEFAULT_SCENE.baseMap.style
      },
      view2d: {
        center: parsed.view2d?.center ?? DEFAULT_SCENE.view2d.center,
        zoom: parsed.view2d?.zoom ?? DEFAULT_SCENE.view2d.zoom,
        rotation: parsed.view2d?.rotation ?? 0
      },
      view3d: {
        lon: parsed.view3d?.lon ?? DEFAULT_SCENE.view3d.lon,
        lat: parsed.view3d?.lat ?? DEFAULT_SCENE.view3d.lat,
        height: parsed.view3d?.height ?? DEFAULT_SCENE.view3d.height,
        heading: parsed.view3d?.heading ?? 0,
        pitch: parsed.view3d?.pitch ?? -45
      },
      layers: sketchLayersFromUnknown(parsed.layers),
      overlayLayers: overlayRefsFromUnknown(parsed.overlayLayers),
      heatmap: parsed.heatmap === true
    }
  } catch {
    return parseSceneJson(null)
  }
}

export function overlayRefsFromUnknown(raw: unknown): GisOverlayRef[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: GisOverlayRef[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const rec = item as Partial<GisOverlayRef> & { layerId?: unknown; name?: string }
    const layerId = String(rec.layerId ?? '').trim()
    if (!/^\d+$/.test(layerId)) {
      continue
    }
    out.push({
      id: String(rec.id || `ov-${layerId}`),
      layerId,
      name: rec.name?.trim() || `图层 ${layerId}`,
      kind: overlayKind(rec.kind),
      visible: rec.visible !== false,
      color: rec.color,
      opacity:
        typeof rec.opacity === 'number' && Number.isFinite(rec.opacity) ? rec.opacity : undefined
    })
  }
  return out
}

function overlayKind(raw?: string): OverlayKind {
  if (raw === 'heatmap' || raw === 'xyz' || raw === 'wms') {
    return raw
  }
  return 'vector'
}

export function sketchLayersFromUnknown(raw: unknown): GisSketchLayer[] {
  const features = sketchFeaturesFromLayers(raw)
  return features.length ? [{ type: SKETCH_LAYER_TYPE, features }] : []
}

export function sketchFeaturesFromLayers(raw: unknown): GisSketchFeature[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: GisSketchFeature[] = []
  for (const layer of raw) {
    if (!layer || typeof layer !== 'object') {
      continue
    }
    const rec = layer as { type?: string; features?: unknown[] }
    if (rec.type !== SKETCH_LAYER_TYPE || !Array.isArray(rec.features)) {
      continue
    }
    for (const item of rec.features) {
      if (!item || typeof item !== 'object') {
        continue
      }
      const feat = item as Partial<GisSketchFeature>
      if (!feat.geometry || typeof feat.geometry !== 'object') {
        continue
      }
      const props = feat.properties
      const kind = props?.kind
      if (!kind) {
        continue
      }
      out.push({
        type: 'Feature',
        id: String(feat.id ?? newSketchId()),
        properties: {
          name: props.name?.trim() || kind,
          kind,
          visible: props.visible !== false,
          label: props.label,
          color: props.color,
          remark: props.remark,
          text: props.text
        },
        geometry: {
          type: String(feat.geometry.type || 'Point'),
          coordinates: feat.geometry.coordinates
        }
      })
    }
  }
  return out
}

export function layersWithSketch(features: GisSketchFeature[]): GisSketchLayer[] {
  return features.length ? [{ type: SKETCH_LAYER_TYPE, features }] : []
}

const FEATURE_KINDS: GisFeatureKind[] = [
  'point',
  'line',
  'polygon',
  'circle',
  'rect',
  'text',
  'measureLength',
  'measureArea'
]

function asKind(raw: unknown, geomType: string): GisFeatureKind {
  const code = String(raw || '')
  if ((FEATURE_KINDS as string[]).includes(code)) {
    return code as GisFeatureKind
  }
  if (geomType === 'Point' || geomType === 'MultiPoint') {
    return 'point'
  }
  if (geomType === 'LineString' || geomType === 'MultiLineString') {
    return 'line'
  }
  return 'polygon'
}

function asFeature(raw: unknown): GisSketchFeature | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }
  const feat = raw as Partial<GisSketchFeature> & {
    geometry?: { type?: string; coordinates?: unknown }
  }
  const geom = feat.geometry
  if (!geom || typeof geom !== 'object' || geom.coordinates == null) {
    return undefined
  }
  const geomType = String(geom.type || 'Point')
  const props = feat.properties
  const kind = asKind(props?.kind, geomType)
  const extra = feat.properties as Record<string, unknown> | undefined
  const attrs: Record<string, unknown> = {}
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (
        ['name', 'kind', 'visible', 'color', 'remark', 'text', 'label', 'attrs'].includes(key) ||
        value == null
      ) {
        continue
      }
      attrs[key] = value
    }
  }
  return {
    type: 'Feature',
    id: String(feat.id ?? newSketchId()),
    properties: {
      name: props?.name?.trim() || kind,
      kind,
      visible: props?.visible !== false,
      label: props?.label,
      color: props?.color,
      remark: props?.remark,
      text: props?.text,
      attrs: Object.keys(attrs).length
        ? attrs
        : extra?.attrs && typeof extra.attrs === 'object'
          ? (extra.attrs as Record<string, unknown>)
          : undefined
    },
    geometry: { type: geomType, coordinates: geom.coordinates }
  }
}

/** 导入场景 JSON / GeoJSON FeatureCollection / 单个 Feature。坐标按 WGS84。 */
export function featuresFromImportJson(raw: unknown): GisSketchFeature[] {
  if (!raw) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw.map(asFeature).filter((f): f is GisSketchFeature => !!f)
  }
  if (typeof raw !== 'object') {
    return []
  }
  const rec = raw as { type?: string; layers?: unknown; features?: unknown[] }
  if (rec.layers != null) {
    const fromScene = sketchFeaturesFromLayers(rec.layers)
    if (fromScene.length) {
      return fromScene
    }
  }
  if (rec.type === 'FeatureCollection' && Array.isArray(rec.features)) {
    return rec.features.map(asFeature).filter((f): f is GisSketchFeature => !!f)
  }
  const one = asFeature(rec)
  return one ? [one] : []
}

export function newSketchId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 样式对应的瓦片图层（影像注记 = 底图 + 注记叠层；Google/百度仅单层） */
export function layersForStyle(style: GisStyleCode, provider?: GisProviderCode): string[] {
  if (provider === 'google' || provider === 'baidu') {
    return style.startsWith('img') ? ['img'] : ['vec']
  }
  if (style === 'img_label') {
    return ['img', 'cia']
  }
  if (style === 'vec_label') {
    return ['vec', 'cva']
  }
  return [style]
}

export function tileUrl(provider: string, layer: string, z: string, x: string, y: string): string {
  return `/api/system/gis/tile/${provider}/${layer}/${z}/${x}/${y}`
}
