<template>
  <div class="gis-spatial-wrap">
    <div ref="host" class="gis-spatial" data-testid="gis-spatial-map"></div>
    <div v-if="truncated" class="gis-spatial-truncated" data-testid="gis-spatial-truncated"
      >truncated</div
    >
    <GisTileErrorHint :host="host" />
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import GisTileErrorHint from './GisTileErrorHint.vue'
  import type Map from 'ol/Map'
  import type { EventsKey } from 'ol/events'
  import { unByKey } from 'ol/Observable'
  import Feature from 'ol/Feature'
  import type { FeatureLike } from 'ol/Feature'
  import Point from 'ol/geom/Point'
  import Heatmap from 'ol/layer/Heatmap'
  import VectorLayer from 'ol/layer/Vector'
  import VectorSource from 'ol/source/Vector'
  import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
  import { fromLonLat } from 'ol/proj'
  import 'ol/ol.css'
  import { fetchGisStatus, type GisProviderStatus } from '@/api/gis'
  import { rememberedOrFirst } from '@/gis/preferProvider'
  import { applyOlBasemap, createOlMap, OL_ROLE_OVERLAY, readOlExtentLonLat } from '@/gis/olMap'
  import { toDisplayLonLat } from '@/gis/coord'
  import {
    cellWeight,
    filterValidCells,
    filterValidPoints,
    formatBbox,
    maxCellWeight,
    normalizeHeatWeight,
    pointDimmed,
    type TrackSpatialCell,
    type TrackSpatialPoint,
    type TrackSpatialViewport
  } from '@/gis/trackSpatial'
  import { DEFAULT_SCENE, type GisProviderCode } from '@/gis/types'

  const props = withDefaults(
    defineProps<{
      mode: 'agg' | 'points'
      cells?: TrackSpatialCell[]
      points?: TrackSpatialPoint[]
      truncated?: boolean
    }>(),
    {
      cells: () => [],
      points: () => [],
      truncated: false
    }
  )

  const emit = defineEmits<{
    'update:viewport': [TrackSpatialViewport]
    'select-point': [TrackSpatialPoint]
  }>()

  const host = ref<HTMLElement>()
  let map: Map | undefined
  let provider: GisProviderCode = DEFAULT_SCENE.baseMap.provider
  let dataSource: VectorSource | undefined
  let heatLayer: Heatmap | undefined
  let pointLayer: VectorLayer | undefined
  let viewportTimer: ReturnType<typeof setTimeout> | undefined
  let eventKeys: EventsKey[] = []
  /** 同一 mode 下只在「空→有数据」时 fit，避免 bbox 拉数后拽视野 */
  let fittedForMode = false
  let lastMode: 'agg' | 'points' | undefined

  const POINT_ACTIVE = '#ef4444'
  const POINT_DIM = '#94a3b8'

  function firstProvider(rows: GisProviderStatus[]): GisProviderCode {
    return rememberedOrFirst(rows)
  }

  function clearDataLayers(): void {
    if (!map) {
      return
    }
    if (heatLayer) {
      map.removeLayer(heatLayer)
      heatLayer = undefined
    }
    if (pointLayer) {
      map.removeLayer(pointLayer)
      pointLayer = undefined
    }
    dataSource?.clear()
    dataSource = undefined
  }

  function wgsToMapCoord(lon: number, lat: number): number[] {
    return fromLonLat(toDisplayLonLat([lon, lat], provider))
  }

  function maybeFit(hasData: boolean): void {
    if (!map || !dataSource || !hasData) {
      return
    }
    if (fittedForMode) {
      return
    }
    const extent = dataSource.getExtent()
    if (!extent || !Number.isFinite(extent[0])) {
      return
    }
    map.getView().fit(extent, { padding: [48, 48, 48, 48], maxZoom: 14, duration: 280 })
    fittedForMode = true
  }

  function paintAgg(): void {
    if (!map) {
      return
    }
    clearDataLayers()
    const cells = filterValidCells(props.cells)
    if (!cells.length) {
      return
    }
    const maxW = maxCellWeight(cells)
    dataSource = new VectorSource()
    for (const cell of cells) {
      const raw = cellWeight(cell)
      const feat = new Feature({
        geometry: new Point(wgsToMapCoord(cell.lon, cell.lat))
      })
      feat.set('weight', normalizeHeatWeight(raw, maxW))
      feat.set('mugsunRawWeight', raw)
      dataSource.addFeature(feat)
    }
    heatLayer = new Heatmap({
      className: 'gis-spatial-heat',
      source: dataSource,
      zIndex: 17,
      blur: 28,
      radius: 16,
      weight: 'weight'
    })
    heatLayer.set('mugsunRole', OL_ROLE_OVERLAY)
    map.addLayer(heatLayer)
    maybeFit(true)
  }

  function pointStyle(feature: FeatureLike): Style {
    const dim = feature.get('mugsunDim') === true
    return new Style({
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: dim ? POINT_DIM : POINT_ACTIVE }),
        stroke: new Stroke({ color: '#ffffff', width: 1.5 })
      })
    })
  }

  function paintPoints(): void {
    if (!map) {
      return
    }
    clearDataLayers()
    const points = filterValidPoints(props.points)
    if (!points.length) {
      return
    }
    dataSource = new VectorSource()
    for (const point of points) {
      const feat = new Feature({
        geometry: new Point(wgsToMapCoord(point.lon, point.lat))
      })
      feat.set('mugsunPoint', point)
      feat.set('mugsunDim', pointDimmed(point))
      dataSource.addFeature(feat)
    }
    pointLayer = new VectorLayer({
      className: 'gis-spatial-points',
      source: dataSource,
      zIndex: 18,
      style: pointStyle
    })
    pointLayer.set('mugsunRole', OL_ROLE_OVERLAY)
    map.addLayer(pointLayer)
    maybeFit(true)
  }

  function paint(): void {
    if (!map) {
      return
    }
    if (lastMode !== props.mode) {
      lastMode = props.mode
      fittedForMode = false
    }
    if (props.mode === 'agg') {
      paintAgg()
    } else {
      paintPoints()
    }
  }

  function emitViewport(): void {
    if (!map) {
      return
    }
    const ext = readOlExtentLonLat(map, provider)
    const zoom = Math.round(map.getView().getZoom() ?? 11)
    emit('update:viewport', {
      bbox: formatBbox(ext.minLon, ext.minLat, ext.maxLon, ext.maxLat),
      zoom
    })
  }

  function scheduleViewport(): void {
    if (viewportTimer) {
      clearTimeout(viewportTimer)
    }
    viewportTimer = setTimeout(() => {
      viewportTimer = undefined
      emitViewport()
    }, 300)
  }

  function onMapClick(evt: { pixel: number[] }): void {
    if (!map || props.mode !== 'points' || !pointLayer) {
      return
    }
    const hit = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat, {
      layerFilter: (layer) => layer === pointLayer
    })
    if (!hit) {
      return
    }
    const point = hit.get('mugsunPoint') as TrackSpatialPoint | undefined
    if (point) {
      emit('select-point', point)
    }
  }

  onMounted(async () => {
    if (!host.value) {
      return
    }
    try {
      // 静默探测：失败时退回默认底图，不弹 toast（同 GisHeatMap）
      const status = await fetchGisStatus({ silent: true })
      provider = firstProvider(status.providers || [])
    } catch {
      provider = DEFAULT_SCENE.baseMap.provider
    }
    map = createOlMap(host.value, DEFAULT_SCENE.view2d, provider, { zoomControl: true })
    applyOlBasemap(map, provider, 'img_label')
    paint()
    eventKeys.push(map.on('singleclick', onMapClick))
    eventKeys.push(map.on('moveend', scheduleViewport))
    scheduleViewport()
  })

  watch(
    () => [props.mode, props.cells, props.points] as const,
    () => paint(),
    { deep: true }
  )

  onBeforeUnmount(() => {
    if (viewportTimer) {
      clearTimeout(viewportTimer)
    }
    unByKey(eventKeys)
    eventKeys = []
    clearDataLayers()
    map?.setTarget(undefined)
    map = undefined
  })
</script>

<style scoped>
  .gis-spatial-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 360px;
  }

  .gis-spatial {
    width: 100%;
    height: 100%;
    min-height: 360px;
    overflow: hidden;
    border-radius: 8px;
  }

  .gis-spatial-truncated {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    padding: 2px 8px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-color-warning-dark-2, #b88230);
    pointer-events: none;
    background: var(--el-bg-color, #fff);
    border: 1px solid var(--el-color-warning-light-5, #f3d19e);
    border-radius: 4px;
  }

  .gis-spatial :deep(.ol-scale-line) {
    right: 8px;
    bottom: 28px;
    left: auto;
  }
</style>
