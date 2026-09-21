import { fetchGisLayerDetail, type GisLayerRow, type GisScene } from '@/api/gis'
import { collectionToSketch, parseRasterSpec, type OlOverlayHandle } from './olOverlay'
import { applyOlBasemap, setOlView } from './olMap'
import { parseSceneJson, type GisProviderCode, type OverlayKind } from './types'
import type Map from 'ol/Map'

export function overlayKindOf(kind?: string, fallback?: string): OverlayKind {
  const raw = kind || fallback
  if (raw === 'heatmap' || raw === 'xyz' || raw === 'wms') {
    return raw
  }
  return 'vector'
}

export async function paintLayerOnMap(
  overlays: OlOverlayHandle,
  provider: GisProviderCode,
  row: GisLayerRow,
  slotId = 'preview',
  opts?: { clear?: boolean; fit?: boolean }
): Promise<void> {
  if (opts?.clear !== false) {
    overlays.clear()
  }
  if (row.id == null || row.id === '') {
    return
  }
  const detail = row.dataJson ? row : await fetchGisLayerDetail(row.id)
  let parsed: unknown = {}
  try {
    parsed = detail.dataJson ? JSON.parse(detail.dataJson) : {}
  } catch {
    parsed = {}
  }
  const raster =
    detail.kind === 'xyz' || detail.kind === 'wms' ? parseRasterSpec(parsed) : undefined
  if (raster) {
    overlays.setRaster(slotId, raster, {
      layerId: detail.id,
      name: detail.name,
      kind: detail.kind === 'wms' ? 'wms' : 'xyz'
    })
    return
  }
  overlays.set(slotId, collectionToSketch(parsed), provider, {
    layerId: detail.id,
    name: detail.name,
    kind: overlayKindOf(detail.kind),
    color: '#2563eb'
  })
  if (opts?.fit !== false) {
    overlays.fit(slotId)
  }
}

export async function paintSceneOnMap(
  map: Map,
  overlays: OlOverlayHandle,
  scene: GisScene,
  fallbackProvider: GisProviderCode
): Promise<void> {
  const spec = parseSceneJson(scene.sceneJson)
  const provider = spec.baseMap.provider || fallbackProvider
  try {
    applyOlBasemap(map, provider, spec.baseMap.style)
  } catch {
    // 无密钥仍展示矢量
  }
  setOlView(map, spec.view2d, provider)
  overlays.clear()
  const sketch = spec.layers.flatMap((layer) => layer.features)
  if (sketch.length) {
    overlays.set('scene-sketch', sketch, provider, {
      name: scene.name,
      kind: 'vector',
      color: '#2563eb'
    })
  }
  for (const ref of spec.overlayLayers || []) {
    if (!ref.layerId) {
      continue
    }
    try {
      const row = await fetchGisLayerDetail(ref.layerId)
      await paintLayerOnMap(overlays, provider, row, `ov-${ref.layerId}`, {
        clear: false,
        fit: false
      })
    } catch {
      // 图层已删时跳过
    }
  }
  overlays.fitAll()
}
