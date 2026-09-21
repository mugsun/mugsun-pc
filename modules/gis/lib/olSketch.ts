import type Map from 'ol/Map'
import Feature from 'ol/Feature'
import Overlay from 'ol/Overlay'
import GeoJSON from 'ol/format/GeoJSON'
import Circle from 'ol/geom/Circle'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import type Geometry from 'ol/geom/Geometry'
import { fromCircle } from 'ol/geom/Polygon'
import VectorLayer from 'ol/layer/Vector'
import Heatmap from 'ol/layer/Heatmap'
import VectorSource from 'ol/source/Vector'
import Draw, { createBox } from 'ol/interaction/Draw'
import Modify from 'ol/interaction/Modify'
import Select from 'ol/interaction/Select'
import Snap from 'ol/interaction/Snap'
import { click } from 'ol/events/condition'
import { Fill, Stroke, Style, Text, Circle as CircleStyle } from 'ol/style'
import { getArea, getDistance, getLength } from 'ol/sphere'
import { fromLonLat, toLonLat } from 'ol/proj'
import type { Coordinate } from 'ol/coordinate'
import type { FeatureLike } from 'ol/Feature'
import { fromDisplayLonLat, mapLonLatCoords, toDisplayLonLat } from './coord'
import { OL_ROLE_SKETCH } from './olMap'
import {
  newSketchId,
  type GisDrawTool,
  type GisFeatureKind,
  type GisProviderCode,
  type GisSketchFeature
} from './types'

const FORMAT = new GeoJSON()
const SKETCH_STROKE = '#2563eb'
const MEASURE_STROKE = '#d97706'
const SELECT_STROKE = '#f59e0b'
const HISTORY_MAX = 40

export interface OlSketchHandle {
  setTool: (tool: GisDrawTool) => void
  exportFeatures: (provider: GisProviderCode) => GisSketchFeature[]
  importFeatures: (features: GisSketchFeature[], provider: GisProviderCode) => void
  list: () => GisSketchFeature[]
  removeById: (id: string) => void
  setVisible: (id: string, visible: boolean) => void
  setName: (id: string, name: string) => void
  setColor: (id: string, color: string) => void
  setRemark: (id: string, remark: string) => void
  setText: (id: string, text: string) => void
  selectById: (id: string | undefined) => void
  selectedId: () => string | undefined
  addWgs84Point: (
    lonlat: [number, number],
    provider: GisProviderCode,
    name: string,
    remark?: string
  ) => void
  fit: (id: string) => void
  fitAll: () => void
  clear: () => void
  abort: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  undo: () => void
  redo: () => void
  setHeatmap: (on: boolean) => void
  heatmapOn: () => boolean
  destroy: () => void
  onChange: (cb: () => void) => void
}

export function attachOlSketch(map: Map): OlSketchHandle {
  const source = new VectorSource()
  const selectedIds = new Set<string>()
  const layer = new VectorLayer({
    className: 'gis-ol-sketch',
    zIndex: 20,
    source,
    style: (feature) => sketchStyle(feature, selectedIds.has(sketchId(feature)))
  })
  layer.set('mugsunRole', OL_ROLE_SKETCH)
  map.addLayer(layer)

  const heat = new Heatmap({
    className: 'gis-ol-sketch-heat',
    source,
    zIndex: 19,
    blur: 28,
    radius: 14,
    weight: (feature) => {
      const kind = feature.get('mugsunKind') as GisFeatureKind
      return kind === 'point' || kind === 'text' ? 1 : 0
    },
    visible: false
  })
  heat.set('mugsunRole', OL_ROLE_SKETCH)
  map.addLayer(heat)

  const tipEl = document.createElement('div')
  tipEl.className = 'gis-measure-tip'
  const tip = new Overlay({ element: tipEl, offset: [14, 0], positioning: 'center-left' })
  map.addOverlay(tip)

  const select = new Select({
    layers: [layer],
    condition: click,
    style: (feature) => sketchStyle(feature, true)
  })
  const modify = new Modify({ source })
  const snap = new Snap({ source })
  map.addInteraction(select)
  map.addInteraction(modify)
  map.addInteraction(snap)
  select.setActive(false)
  modify.setActive(false)

  let draw: Draw | undefined
  let tool: GisDrawTool = 'pan'
  let drawingKind: GisFeatureKind | undefined
  let changeCb: (() => void) | undefined
  let skipNotify = false
  let skipHistory = false
  const past: Feature<Geometry>[][] = []
  const future: Feature<Geometry>[][] = []

  const notify = (): void => {
    if (!skipNotify) {
      changeCb?.()
    }
    layer.changed()
    heat.changed()
  }

  const cloneAll = (): Feature<Geometry>[] =>
    source.getFeatures().map((f) => {
      const c = f.clone() as Feature<Geometry>
      c.setId(f.getId())
      return c
    })

  const restore = (items: Feature<Geometry>[]): void => {
    skipHistory = true
    skipNotify = true
    source.clear()
    items.forEach((f) => source.addFeature(f.clone() as Feature<Geometry>))
    skipNotify = false
    skipHistory = false
    select.getFeatures().clear()
    selectedIds.clear()
    notify()
  }

  const commit = (): void => {
    if (skipHistory) {
      return
    }
    past.push(cloneAll())
    if (past.length > HISTORY_MAX) {
      past.shift()
    }
    future.length = 0
  }

  commit()

  source.on('addfeature', notify)
  source.on('removefeature', notify)
  source.on('changefeature', notify)
  select.on('select', () => {
    selectedIds.clear()
    select.getFeatures().forEach((f) => selectedIds.add(sketchId(f)))
    notify()
  })
  modify.on('modifyend', () => {
    commit()
    notify()
  })

  const removeDraw = (): void => {
    if (draw) {
      map.removeInteraction(draw)
      draw = undefined
    }
    drawingKind = undefined
    tip.setPosition(undefined)
    tipEl.textContent = ''
  }

  const setTool = (next: GisDrawTool): void => {
    tool = next
    removeDraw()
    const editing = next === 'select'
    select.setActive(editing)
    modify.setActive(editing)
    if (next === 'pan' || next === 'select') {
      return
    }
    drawingKind = next
    const type =
      next === 'point' || next === 'text'
        ? 'Point'
        : next === 'line' || next === 'measureLength'
          ? 'LineString'
          : next === 'circle' || next === 'rect'
            ? 'Circle'
            : 'Polygon'
    draw = new Draw({
      source,
      type,
      geometryFunction: next === 'rect' ? createBox() : undefined
    })
    draw.on('drawstart', (evt) => {
      const geom = evt.feature.getGeometry()
      if (!geom) {
        return
      }
      geom.on('change', () => {
        const last = lastCoord(geom)
        const text = formatGeom(geom, drawingKind)
        if (last && text) {
          tipEl.textContent = text
          tip.setPosition(last)
        }
      })
    })
    draw.on('drawend', (evt) => {
      const feature = evt.feature
      const kind = drawingKind ?? 'polygon'
      const id = newSketchId()
      feature.setId(id)
      feature.set('mugsunId', id)
      feature.set('mugsunKind', kind)
      feature.set('mugsunVisible', true)
      feature.set('mugsunName', nextName(source, kind, feature))
      feature.set(
        'mugsunLabel',
        formatGeom(feature.getGeometry(), kind) || feature.get('mugsunName')
      )
      if (kind === 'text') {
        feature.set('mugsunText', feature.get('mugsunName'))
      }
      tip.setPosition(undefined)
      commit()
    })
    draw.on('drawabort', () => {
      tip.setPosition(undefined)
    })
    map.addInteraction(draw)
  }

  const onKey = (ev: Event): void => {
    const e = ev as KeyboardEvent
    if (e.key === 'Escape') {
      draw?.abortDrawing()
      setTool('pan')
    }
    if (e.key === 'Delete' && (tool === 'select' || selectedIds.size)) {
      const chosen = select.getFeatures().getArray().slice()
      if (chosen.length) {
        commit()
        chosen.forEach((f) => source.removeFeature(f as Feature<Geometry>))
        select.getFeatures().clear()
        selectedIds.clear()
      }
    }
  }
  map.getViewport().addEventListener('keydown', onKey)

  const handle: OlSketchHandle = {
    setTool,
    exportFeatures: (provider) =>
      source.getFeatures().map((feature) => toSketchFeature(feature, provider)),
    importFeatures: (features, provider) => {
      skipNotify = true
      skipHistory = true
      source.clear()
      features.forEach((feat) => source.addFeature(fromSketchFeature(feat, provider)))
      skipNotify = false
      skipHistory = false
      past.length = 0
      future.length = 0
      commit()
      notify()
    },
    list: () => source.getFeatures().map((feature) => toSketchFeature(feature, 'tianditu')),
    removeById: (id) => {
      const feature = findFeature(source, id)
      if (feature) {
        commit()
        source.removeFeature(feature)
        selectedIds.delete(id)
      }
    },
    setVisible: (id, visible) => {
      const feature = findFeature(source, id)
      if (feature) {
        feature.set('mugsunVisible', visible)
        feature.changed()
        notify()
      }
    },
    setName: (id, name) => {
      const feature = findFeature(source, id)
      if (feature) {
        feature.set('mugsunName', name)
        if (feature.get('mugsunKind') === 'text') {
          feature.set('mugsunText', name)
          feature.set('mugsunLabel', name)
        }
        notify()
      }
    },
    setColor: (id, color) => {
      const feature = findFeature(source, id)
      if (feature) {
        commit()
        feature.set('mugsunColor', color)
        feature.changed()
        notify()
      }
    },
    setRemark: (id, remark) => {
      const feature = findFeature(source, id)
      if (feature) {
        feature.set('mugsunRemark', remark)
        notify()
      }
    },
    setText: (id, text) => {
      const feature = findFeature(source, id)
      if (feature) {
        feature.set('mugsunText', text)
        feature.set('mugsunLabel', text)
        feature.changed()
      }
    },
    selectById: (id) => {
      selectedIds.clear()
      select.getFeatures().clear()
      if (!id) {
        notify()
        return
      }
      const feature = findFeature(source, id)
      if (feature) {
        selectedIds.add(id)
        select.getFeatures().push(feature)
        notify()
      }
    },
    selectedId: () => selectedIds.values().next().value as string | undefined,
    addWgs84Point: (lonlat, provider, name, remark) => {
      const display = toDisplayLonLat(lonlat, provider)
      const feature = new Feature(new Point(fromLonLat(display)))
      const id = newSketchId()
      feature.setId(id)
      feature.set('mugsunId', id)
      feature.set('mugsunKind', 'point')
      feature.set('mugsunVisible', true)
      feature.set('mugsunName', name)
      feature.set('mugsunRemark', remark || '')
      commit()
      source.addFeature(feature)
      handle.selectById(id)
    },
    fit: (id) => {
      const feature = findFeature(source, id)
      const geom = feature?.getGeometry()
      if (!geom) {
        return
      }
      map.getView().fit(geom.getExtent(), { padding: [48, 48, 48, 48], maxZoom: 16, duration: 280 })
    },
    fitAll: () => {
      if (source.isEmpty()) {
        return
      }
      const extent = source.getExtent()
      if (!extent) {
        return
      }
      map.getView().fit(extent, { padding: [56, 56, 56, 56], maxZoom: 14, duration: 280 })
    },
    clear: () => {
      commit()
      source.clear()
      select.getFeatures().clear()
      selectedIds.clear()
    },
    abort: () => {
      draw?.abortDrawing()
      setTool('pan')
    },
    canUndo: () => past.length > 1,
    canRedo: () => future.length > 0,
    undo: () => {
      if (past.length < 2) {
        return
      }
      const current = past.pop()
      if (current) {
        future.push(current)
      }
      restore(past[past.length - 1] ?? [])
    },
    redo: () => {
      const next = future.pop()
      if (!next) {
        return
      }
      past.push(next)
      restore(next)
    },
    setHeatmap: (on) => {
      heat.setVisible(on)
      layer.setOpacity(on ? 0.35 : 1)
    },
    heatmapOn: () => heat.getVisible(),
    destroy: () => {
      removeDraw()
      map.removeInteraction(select)
      map.removeInteraction(modify)
      map.removeInteraction(snap)
      map.removeOverlay(tip)
      map.removeLayer(layer)
      map.removeLayer(heat)
      map.getViewport().removeEventListener('keydown', onKey)
    },
    onChange: (cb) => {
      changeCb = cb
    }
  }

  return handle
}

function findFeature(source: VectorSource, id: string): Feature<Geometry> | undefined {
  return source.getFeatures().find((f) => sketchId(f) === id)
}

function sketchId(feature: FeatureLike): string {
  return String(feature.getId() ?? feature.get('mugsunId') ?? '')
}

function nextName(source: VectorSource, kind: GisFeatureKind, current: Feature<Geometry>): string {
  const n =
    source.getFeatures().filter((f) => f !== current && f.get('mugsunKind') === kind).length + 1
  const prefix: Record<GisFeatureKind, string> = {
    point: '点',
    line: '线',
    polygon: '面',
    circle: '圆',
    rect: '矩形',
    text: '注记',
    measureLength: '测距',
    measureArea: '测面'
  }
  return `${prefix[kind]} ${n}`
}

function lastCoord(geom: Geometry): Coordinate | undefined {
  const type = geom.getType()
  if (type === 'Point') {
    return (geom as Point).getCoordinates()
  }
  if (type === 'Circle') {
    return (geom as Circle).getCenter()
  }
  if (type === 'LineString') {
    const coords = (geom as LineString).getCoordinates()
    return coords[coords.length - 1]
  }
  if (type === 'Polygon') {
    const ring = (geom as unknown as { getCoordinates: () => Coordinate[][] }).getCoordinates()[0]
    return ring?.[ring.length - 2] ?? ring?.[ring.length - 1]
  }
  return undefined
}

export function formatLength(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) {
    return ''
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

export function formatArea(sqm: number): string {
  if (!Number.isFinite(sqm) || sqm <= 0) {
    return ''
  }
  const mu = sqm / 666.6667
  if (sqm < 1_000_000) {
    return `${Math.round(sqm).toLocaleString()} m²（约 ${mu.toFixed(2)} 亩）`
  }
  return `${(sqm / 1_000_000).toFixed(2)} km²（约 ${mu.toFixed(0)} 亩）`
}

function formatGeom(geom: Geometry | undefined, kind?: GisFeatureKind): string {
  if (!geom) {
    return ''
  }
  if (kind === 'text') {
    return ''
  }
  if (kind === 'measureLength' || geom.getType() === 'LineString') {
    return formatLength(getLength(geom, { projection: 'EPSG:3857' }))
  }
  if (geom.getType() === 'Circle') {
    const circle = geom as Circle
    const edge = fromCircle(circle, 64).getCoordinates()[0]?.[0]
    if (!edge) {
      return ''
    }
    const a = toLonLat(circle.getCenter()) as [number, number]
    const b = toLonLat(edge) as [number, number]
    return `半径 ${formatLength(getDistance(a, b))}`
  }
  if (kind === 'measureArea' || kind === 'rect' || geom.getType() === 'Polygon') {
    return formatArea(getArea(geom, { projection: 'EPSG:3857' }))
  }
  return ''
}

function sketchStyle(feature: FeatureLike, selected: boolean): Style[] {
  if (feature.get('mugsunVisible') === false) {
    return []
  }
  const kind = (feature.get('mugsunKind') as GisFeatureKind) || 'polygon'
  const measure = kind === 'measureLength' || kind === 'measureArea'
  const custom = String(feature.get('mugsunColor') || '')
  const color = selected ? SELECT_STROKE : custom || (measure ? MEASURE_STROKE : SKETCH_STROKE)
  const label = String(feature.get('mugsunText') || feature.get('mugsunLabel') || '')
  const fill = new Fill({ color: hexToRgba(color, kind === 'text' ? 0 : 0.22) })
  const stroke = new Stroke({ color, width: selected ? 3 : 2 })
  const text = label
    ? new Text({
        text: label,
        font:
          kind === 'text'
            ? '14px ui-sans-serif, system-ui, sans-serif'
            : '12px ui-sans-serif, system-ui, sans-serif',
        fill: new Fill({ color: kind === 'text' ? color : '#0f172a' }),
        stroke: new Stroke({ color: '#ffffff', width: 3 }),
        offsetY: kind === 'point' || kind === 'text' ? -16 : 0
      })
    : undefined
  const image = new CircleStyle({
    radius: kind === 'text' ? 4 : 6,
    fill: new Fill({ color }),
    stroke: new Stroke({ color: '#ffffff', width: 2 })
  })
  return [new Style({ fill, stroke, image, text })]
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex
  if (raw.length !== 6) {
    return `rgba(37, 99, 235, ${alpha})`
  }
  const n = Number.parseInt(raw, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function writeGeometry(feature: Feature<Geometry>): { type: string; coordinates: unknown } {
  const geom = feature.getGeometry()
  if (!geom) {
    return { type: 'Point', coordinates: [0, 0] }
  }
  const clone = feature.clone()
  if (geom instanceof Circle) {
    clone.setGeometry(fromCircle(geom, 64))
  }
  const obj = FORMAT.writeFeatureObject(clone, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857'
  })
  const geometry = obj.geometry as { type: string; coordinates: unknown }
  return { type: geometry.type, coordinates: geometry.coordinates }
}

function toSketchFeature(feature: Feature<Geometry>, provider: GisProviderCode): GisSketchFeature {
  const written = writeGeometry(feature)
  const geom = feature.getGeometry()
  const kind = (feature.get('mugsunKind') as GisFeatureKind) || 'polygon'
  return {
    type: 'Feature',
    id: sketchId(feature) || newSketchId(),
    properties: {
      name: String(feature.get('mugsunName') || ''),
      kind,
      visible: feature.get('mugsunVisible') !== false,
      label: formatGeom(geom, kind) || undefined,
      color: feature.get('mugsunColor') || undefined,
      remark: feature.get('mugsunRemark') || undefined,
      text: feature.get('mugsunText') || undefined
    },
    geometry: {
      type: written.type,
      coordinates: mapLonLatCoords(written.coordinates, (ll) => fromDisplayLonLat(ll, provider))
    }
  }
}

function fromSketchFeature(feat: GisSketchFeature, provider: GisProviderCode): Feature<Geometry> {
  const displayCoords = mapLonLatCoords(feat.geometry.coordinates, (ll) =>
    toDisplayLonLat(ll, provider)
  )
  const olFeature = FORMAT.readFeature(
    {
      type: 'Feature',
      geometry: { type: feat.geometry.type, coordinates: displayCoords },
      properties: {}
    },
    {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    }
  ) as Feature<Geometry>
  olFeature.setId(feat.id)
  olFeature.set('mugsunId', feat.id)
  olFeature.set('mugsunName', feat.properties.name)
  olFeature.set('mugsunKind', feat.properties.kind)
  olFeature.set('mugsunVisible', feat.properties.visible !== false)
  olFeature.set('mugsunColor', feat.properties.color || '')
  olFeature.set('mugsunRemark', feat.properties.remark || '')
  olFeature.set('mugsunText', feat.properties.text || '')
  olFeature.set(
    'mugsunLabel',
    feat.properties.text ||
      feat.properties.label ||
      formatGeom(olFeature.getGeometry(), feat.properties.kind)
  )
  return olFeature
}
