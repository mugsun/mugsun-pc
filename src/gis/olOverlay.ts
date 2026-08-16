import type OlMap from 'ol/Map'
import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import type Geometry from 'ol/geom/Geometry'
import Heatmap from 'ol/layer/Heatmap'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import Cluster from 'ol/source/Cluster'
import TileWMS from 'ol/source/TileWMS'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style'
import type { FeatureLike } from 'ol/Feature'
import { fromDisplayLonLat, mapLonLatCoords, toDisplayLonLat } from './coord'
import { OL_ROLE_OVERLAY } from './olMap'
import { parseRasterSpec, type OverlayKind, type RasterSpec } from './raster'
import {
  newSketchId,
  type GisFeatureKind,
  type GisProviderCode,
  type GisSketchFeature
} from './types'

const FORMAT = new GeoJSON()
const SKIP_ATTR = new Set(['name', 'kind', 'visible', 'color', 'remark', 'text', 'label'])

export interface OverlayEntry {
  id: string
  layerId?: string | number
  name: string
  kind: OverlayKind
  visible: boolean
  color: string
  count: number
  opacity: number
}

export interface OlOverlayHandle {
  set: (
    id: string,
    features: GisSketchFeature[],
    provider: GisProviderCode,
    meta: {
      layerId?: string | number
      name: string
      kind: OverlayKind
      visible?: boolean
      color?: string
      opacity?: number
    }
  ) => void
  setRaster: (
    id: string,
    spec: RasterSpec,
    meta: {
      layerId?: string | number
      name: string
      kind: OverlayKind
      visible?: boolean
      opacity?: number
    }
  ) => void
  remove: (id: string) => void
  clear: () => void
  setVisible: (id: string, visible: boolean) => void
  setOpacity: (id: string, opacity: number) => void
  setCluster: (on: boolean) => void
  list: () => OverlayEntry[]
  fit: (id: string) => void
  fitAll: () => void
  exportAll: (provider: GisProviderCode) => GisSketchFeature[]
  destroy: () => void
}

interface Slot {
  meta: OverlayEntry
  source?: VectorSource
  layer?: VectorLayer
  heat?: Heatmap
  cluster?: VectorLayer
  raster?: TileLayer
}

export function attachOlOverlays(map: OlMap): OlOverlayHandle {
  const slots = new Map<string, Slot>()
  let clusterOn = false

  const destroySlot = (slot: Slot): void => {
    if (slot.layer) {
      map.removeLayer(slot.layer)
    }
    if (slot.heat) {
      map.removeLayer(slot.heat)
    }
    if (slot.cluster) {
      map.removeLayer(slot.cluster)
    }
    if (slot.raster) {
      map.removeLayer(slot.raster)
    }
  }

  const applyCluster = (slot: Slot): void => {
    if (!slot.source || slot.meta.kind !== 'vector') {
      return
    }
    if (slot.cluster) {
      map.removeLayer(slot.cluster)
      slot.cluster = undefined
    }
    if (clusterOn) {
      slot.cluster = new VectorLayer({
        className: `gis-ol-ov-${slot.meta.id}-cluster`,
        zIndex: 19,
        source: new Cluster({ distance: 40, minDistance: 8, source: slot.source }),
        style: (feature) => clusterStyle(feature, slot.meta.color),
        visible: slot.meta.visible,
        opacity: slot.meta.opacity
      })
      slot.cluster.set('mugsunRole', OL_ROLE_OVERLAY)
      map.addLayer(slot.cluster)
      slot.layer?.setVisible(false)
    } else if (slot.layer) {
      slot.layer.setVisible(slot.meta.visible)
    }
  }

  const handle: OlOverlayHandle = {
    set: (id, features, provider, meta) => {
      const exist = slots.get(id)
      if (exist) {
        destroySlot(exist)
      }
      const source = new VectorSource()
      features.forEach((feat) => source.addFeature(fromGeo(feat, provider)))
      const color = meta.color || '#16a34a'
      const opacity = clampOpacity(meta.opacity)
      const vector = new VectorLayer({
        className: `gis-ol-ov-${id}`,
        zIndex: 18,
        source,
        style: (feature) => overlayStyle(feature, color),
        visible: meta.visible !== false && meta.kind !== 'heatmap',
        opacity
      })
      vector.set('mugsunRole', OL_ROLE_OVERLAY)
      map.addLayer(vector)
      let heat: Heatmap | undefined
      if (meta.kind === 'heatmap') {
        heat = new Heatmap({
          className: `gis-ol-ov-${id}-heat`,
          source,
          zIndex: 17,
          blur: 28,
          radius: 16,
          visible: meta.visible !== false,
          opacity
        })
        heat.set('mugsunRole', OL_ROLE_OVERLAY)
        map.addLayer(heat)
        vector.setVisible(false)
      }
      const slot: Slot = {
        source,
        layer: vector,
        heat,
        meta: {
          id,
          layerId: meta.layerId,
          name: meta.name,
          kind: meta.kind === 'heatmap' ? 'heatmap' : 'vector',
          visible: meta.visible !== false,
          color,
          count: features.length,
          opacity
        }
      }
      slots.set(id, slot)
      applyCluster(slot)
    },
    setRaster: (id, spec, meta) => {
      const exist = slots.get(id)
      if (exist) {
        destroySlot(exist)
      }
      const opacity = clampOpacity(meta.opacity)
      const raster =
        spec.type === 'WMS'
          ? new TileLayer({
              className: `gis-ol-ov-${id}`,
              zIndex: 12,
              opacity,
              visible: meta.visible !== false,
              source: new TileWMS({
                url: spec.url,
                params: {
                  LAYERS: spec.layers,
                  TILED: true,
                  FORMAT: spec.format || 'image/png'
                },
                projection: 'EPSG:3857',
                transition: 0
              })
            })
          : new TileLayer({
              className: `gis-ol-ov-${id}`,
              zIndex: 12,
              opacity,
              visible: meta.visible !== false,
              source: new XYZ({ url: spec.url, wrapX: true, maxZoom: 18 })
            })
      raster.set('mugsunRole', OL_ROLE_OVERLAY)
      map.addLayer(raster)
      slots.set(id, {
        raster,
        meta: {
          id,
          layerId: meta.layerId,
          name: meta.name,
          kind: meta.kind === 'wms' ? 'wms' : 'xyz',
          visible: meta.visible !== false,
          color: '#0ea5e9',
          count: 0,
          opacity
        }
      })
    },
    remove: (id) => {
      const slot = slots.get(id)
      if (!slot) {
        return
      }
      destroySlot(slot)
      slots.delete(id)
    },
    clear: () => {
      slots.forEach((slot) => destroySlot(slot))
      slots.clear()
    },
    setVisible: (id, visible) => {
      const slot = slots.get(id)
      if (!slot) {
        return
      }
      slot.meta.visible = visible
      if (slot.raster) {
        slot.raster.setVisible(visible)
        return
      }
      if (slot.heat) {
        slot.heat.setVisible(visible)
        slot.layer?.setVisible(false)
        return
      }
      if (slot.cluster) {
        slot.cluster.setVisible(visible)
        slot.layer?.setVisible(false)
        return
      }
      slot.layer?.setVisible(visible)
    },
    setOpacity: (id, opacity) => {
      const slot = slots.get(id)
      if (!slot) {
        return
      }
      const next = clampOpacity(opacity)
      slot.meta.opacity = next
      slot.layer?.setOpacity(next)
      slot.heat?.setOpacity(next)
      slot.cluster?.setOpacity(next)
      slot.raster?.setOpacity(next)
    },
    setCluster: (on) => {
      clusterOn = on
      slots.forEach((slot) => applyCluster(slot))
    },
    list: () => [...slots.values()].map((s) => ({ ...s.meta })),
    fit: (id) => {
      const slot = slots.get(id)
      if (!slot?.source || slot.source.isEmpty()) {
        return
      }
      const extent = slot.source.getExtent()
      if (!extent) {
        return
      }
      map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 16, duration: 280 })
    },
    fitAll: () => {
      const slotsArr = [...slots.values()].filter((s) => s.source && !s.source.isEmpty())
      const first = slotsArr[0]?.source?.getExtent()
      if (!first) {
        return
      }
      let extent = first.slice()
      slotsArr.slice(1).forEach((s) => {
        const extra = s.source?.getExtent()
        if (!extra) {
          return
        }
        extent = [
          Math.min(extent[0], extra[0]),
          Math.min(extent[1], extra[1]),
          Math.max(extent[2], extra[2]),
          Math.max(extent[3], extra[3])
        ]
      })
      map.getView().fit(extent, { padding: [56, 56, 56, 56], maxZoom: 14, duration: 280 })
    },
    exportAll: (provider) => {
      const out: GisSketchFeature[] = []
      slots.forEach((slot) => {
        slot.source?.getFeatures().forEach((feature) => out.push(toGeo(feature, provider)))
      })
      return out
    },
    destroy: () => handle.clear()
  }
  return handle
}

export function collectionToSketch(raw: unknown): GisSketchFeature[] {
  if (!raw || typeof raw !== 'object') {
    return []
  }
  const rec = raw as { features?: unknown[] }
  const list = Array.isArray(rec.features) ? rec.features : Array.isArray(raw) ? raw : []
  const out: GisSketchFeature[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const feat = item as {
      id?: string
      properties?: Record<string, unknown>
      geometry?: { type?: string; coordinates?: unknown }
    }
    if (!feat.geometry?.coordinates) {
      continue
    }
    const kind = String(feat.properties?.kind || 'point') as GisFeatureKind
    out.push({
      type: 'Feature',
      id: String(feat.id ?? newSketchId()),
      properties: {
        name: String(feat.properties?.name || feat.properties?.title || kind),
        kind,
        visible: feat.properties?.visible !== false,
        color: feat.properties?.color ? String(feat.properties.color) : undefined,
        remark: feat.properties?.remark ? String(feat.properties.remark) : undefined,
        text: feat.properties?.text ? String(feat.properties.text) : undefined,
        label: feat.properties?.label ? String(feat.properties.label) : undefined,
        attrs: pickAttrs(feat.properties)
      },
      geometry: {
        type: String(feat.geometry.type || 'Point'),
        coordinates: feat.geometry.coordinates
      }
    })
  }
  return out
}

export { parseRasterSpec }

function fromGeo(feat: GisSketchFeature, provider: GisProviderCode): Feature<Geometry> {
  const displayCoords = mapLonLatCoords(feat.geometry.coordinates, (ll) =>
    toDisplayLonLat(ll, provider)
  )
  const olFeature = FORMAT.readFeature(
    {
      type: 'Feature',
      geometry: { type: feat.geometry.type, coordinates: displayCoords },
      properties: {}
    },
    { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' }
  ) as Feature<Geometry>
  olFeature.setId(feat.id)
  olFeature.set('mugsunId', feat.id)
  olFeature.set('mugsunName', feat.properties.name)
  olFeature.set('mugsunKind', feat.properties.kind)
  olFeature.set('mugsunVisible', feat.properties.visible !== false)
  olFeature.set('mugsunColor', feat.properties.color || '')
  olFeature.set('mugsunLabel', feat.properties.label || feat.properties.name)
  olFeature.set('mugsunAttrs', feat.properties.attrs || {})
  return olFeature
}

function toGeo(feature: Feature<Geometry>, provider: GisProviderCode): GisSketchFeature {
  const obj = FORMAT.writeFeatureObject(feature, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  })
  const geometry = obj.geometry as { type: string; coordinates: unknown }
  const attrs = feature.get('mugsunAttrs') as Record<string, unknown> | undefined
  return {
    type: 'Feature',
    id: String(feature.getId() || newSketchId()),
    properties: {
      name: String(feature.get('mugsunName') || ''),
      kind: (feature.get('mugsunKind') as GisFeatureKind) || 'point',
      visible: feature.get('mugsunVisible') !== false,
      color: feature.get('mugsunColor') || undefined,
      label: feature.get('mugsunLabel') || undefined,
      attrs: attrs && Object.keys(attrs).length ? attrs : undefined
    },
    geometry: {
      type: geometry.type,
      coordinates: mapLonLatCoords(geometry.coordinates, (ll) => fromDisplayLonLat(ll, provider))
    }
  }
}

function pickAttrs(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) {
    return undefined
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (SKIP_ATTR.has(key) || value == null) {
      continue
    }
    out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

function overlayStyle(feature: FeatureLike, fallback: string): Style[] {
  if (feature.get('mugsunVisible') === false) {
    return []
  }
  const color = String(feature.get('mugsunColor') || fallback)
  const label = String(feature.get('mugsunLabel') || feature.get('mugsunName') || '')
  return [
    new Style({
      fill: new Fill({ color: hexToRgba(color, 0.18) }),
      stroke: new Stroke({ color, width: 2 }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#ffffff', width: 2 })
      }),
      text: label
        ? new Text({
            text: label,
            font: '12px ui-sans-serif, system-ui, sans-serif',
            fill: new Fill({ color: '#0f172a' }),
            stroke: new Stroke({ color: '#ffffff', width: 3 }),
            offsetY: -14
          })
        : undefined
    })
  ]
}

function clusterStyle(feature: FeatureLike, fallback: string): Style[] {
  const members = feature.get('features') as Feature[] | undefined
  if (!members || members.length < 2) {
    const inner = members?.[0]
    return overlayStyle(inner ?? feature, fallback)
  }
  const size = members.length
  const radius = Math.min(22, 10 + size)
  return [
    new Style({
      image: new CircleStyle({
        radius,
        fill: new Fill({ color: hexToRgba(fallback, 0.85) }),
        stroke: new Stroke({ color: '#ffffff', width: 2 })
      }),
      text: new Text({
        text: String(size),
        fill: new Fill({ color: '#ffffff' }),
        font: '12px ui-sans-serif, system-ui, sans-serif'
      })
    })
  ]
}

function clampOpacity(raw?: number): number {
  if (raw == null || Number.isNaN(raw)) {
    return 1
  }
  return Math.min(1, Math.max(0, raw))
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex
  if (raw.length !== 6) {
    return `rgba(22, 163, 74, ${alpha})`
  }
  const n = Number.parseInt(raw, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}
