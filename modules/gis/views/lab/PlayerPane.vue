<template>
  <div class="gis-lab-play">
    <div class="gis-lab-stage">
      <div v-show="!is3d" ref="mapHost" class="gis-map"></div>
      <div v-if="is3d" ref="cesiumHost" class="gis-map">
        <div v-if="loading3d" class="gis-loading">{{ $t('pages.gis.load3d') }}</div>
      </div>
      <aside v-if="is3d && pick3d" class="gis-hud gis-lab-pick" data-test="lab-3d-pick">
        <strong>{{ $t('pages.gis.tilesetPick') }}</strong>
        <ul>
          <li v-for="item in pick3d.properties" :key="item.key">
            <span class="gis-pick-key">{{ item.key }}</span>
            <span>{{ item.value }}</span>
          </li>
        </ul>
      </aside>
      <div class="gis-hud gis-hud-tr gis-lab-chip">
        <strong>{{ meta?.title || code }}</strong>
        <span>{{ meta?.summary }}</span>
        <ElButton size="small" type="primary" plain @click="srcOpen = true">{{
          $t('pages.gis.labCode')
        }}</ElButton>
      </div>
      <div v-if="code === 'playback'" class="gis-hud gis-playbar">
        <ElButton size="small" type="primary" @click="togglePlay">
          {{ playing ? $t('pages.gis.labPause') : $t('pages.gis.labPlay') }}
        </ElButton>
        <ElButton size="small" @click="stopPlay">{{ $t('pages.gis.labStop') }}</ElButton>
        <ElSlider
          v-model="ratioPct"
          :min="0"
          :max="100"
          class="gis-play-slider"
          @update:model-value="onSeek"
        />
        <span class="gis-clock">{{ clockText }}</span>
        <ElSelect v-model="speed" class="gis-speed" size="small" @change="onSpeed">
          <ElOption :value="0.5" label="0.5x" />
          <ElOption :value="1" label="1x" />
          <ElOption :value="2" label="2x" />
          <ElOption :value="4" label="4x" />
          <ElOption :value="8" label="8x" />
        </ElSelect>
      </div>
      <div v-else-if="code === 'measure'" class="gis-hud gis-playbar">
        <ElRadioGroup v-model="measureMode" size="small" @change="resetMeasure">
          <ElRadioButton value="length">{{ $t('pages.gis.opLength') }}</ElRadioButton>
          <ElRadioButton value="area">{{ $t('pages.gis.opArea') }}</ElRadioButton>
        </ElRadioGroup>
        <ElButton size="small" @click="resetMeasure">{{ $t('pages.gis.featClear') }}</ElButton>
      </div>
      <div v-else-if="code === 'ops'" class="gis-hud gis-playbar" data-test="lab-ops-bar">
        <span class="gis-bar-label">{{ $t('pages.gis.labOpsPick') }}</span>
        <ElSelect v-model="opsOp" size="small" class="gis-ops-select" @change="runOps">
          <ElOption v-for="item in OPS_DEMO" :key="item" :value="item" :label="opLabel(item)" />
        </ElSelect>
        <span class="gis-clock" data-test="lab-ops-metrics">{{
          opsText || $t('pages.gis.labOpsRunning')
        }}</span>
      </div>
      <div v-else-if="code === 'raster'" class="gis-hud gis-playbar" data-test="lab-raster-bar">
        <ElSwitch
          v-model="rasterOn"
          size="small"
          :active-text="$t('pages.gis.labRasterOn')"
          @change="applyRaster"
        />
        <span class="gis-bar-label">{{ $t('pages.gis.labRasterOpacity') }}</span>
        <ElSlider
          v-model="rasterOpacity"
          :min="10"
          :max="100"
          class="gis-play-slider"
          @update:model-value="applyRaster"
        />
        <span class="gis-clock" data-test="lab-raster-opacity">{{ rasterOpacity }}%</span>
      </div>
      <div v-else-if="code === 'ingest'" class="gis-hud gis-ingest-bar" data-test="lab-ingest-bar">
        <div class="gis-ingest-head">
          <ElRadioGroup v-model="ingestFormat" size="small" @change="pickSample">
            <ElRadioButton v-for="row in ingestSamples" :key="row.format" :value="row.format">
              {{ row.label }}
            </ElRadioButton>
          </ElRadioGroup>
          <ElButton size="small" type="primary" :loading="ingesting" @click="runIngest">
            {{ $t('pages.gis.labIngestRun') }}
          </ElButton>
          <span class="gis-clock" data-test="lab-ingest-count">{{ ingestText }}</span>
        </div>
        <ElInput
          v-model="ingestRaw"
          type="textarea"
          :rows="4"
          spellcheck="false"
          :placeholder="$t('pages.gis.labIngestPlaceholder')"
        />
      </div>
      <p v-if="hint" class="gis-hud gis-lab-float">{{ hint }}</p>
    </div>
    <ElDrawer
      v-model="srcOpen"
      :title="meta?.title || code"
      direction="btt"
      size="42%"
      destroy-on-close
    >
      <p class="gis-lab-sum">{{ meta?.summary }}</p>
      <ElTabs v-model="tab">
        <ElTabPane :label="$t('pages.gis.labCode')" name="code">
          <pre class="gis-pre">{{ snippet }}</pre>
          <ElButton size="small" @click="copy(snippet)">{{ $t('pages.gis.labCopy') }}</ElButton>
        </ElTabPane>
        <ElTabPane :label="$t('pages.gis.labData')" name="data">
          <pre class="gis-pre">{{ jsonView || $t('pages.gis.labDataEmpty') }}</pre>
          <div class="gis-lab-actions">
            <ElButton v-if="canExpand" size="small" @click="jsonOpen = !jsonOpen">
              {{ jsonOpen ? $t('pages.gis.labShowLess') : $t('pages.gis.labShowAll') }}
            </ElButton>
            <ElButton size="small" :disabled="!jsonView" @click="copy(jsonView)">
              {{ $t('pages.gis.labCopy') }}
            </ElButton>
          </div>
        </ElTabPane>
      </ElTabs>
      <dl v-if="lines.length" class="gis-metrics">
        <div v-for="row in lines" :key="row">{{ row }}</div>
      </dl>
      <ul v-if="hits.length" class="gis-hits">
        <li v-for="name in hits" :key="name">{{ name }}</li>
      </ul>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import {
    computed,
    nextTick,
    onActivated,
    onBeforeUnmount,
    onDeactivated,
    onMounted,
    ref,
    watch
  } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import Feature from 'ol/Feature'
  import { circular } from 'ol/geom/Polygon'
  import VectorLayer from 'ol/layer/Vector'
  import VectorSource from 'ol/source/Vector'
  import Draw from 'ol/interaction/Draw'
  import { getArea, getLength } from 'ol/sphere'
  import { Style, Stroke, Fill } from 'ol/style'
  import type Geometry from 'ol/geom/Geometry'
  import LineString from 'ol/geom/LineString'
  import Polygon from 'ol/geom/Polygon'
  import {
    fetchGisAnalyze,
    fetchGisDemo,
    fetchGisLayerIngestText,
    fetchGisReverse,
    fetchGisStatus,
    type GisDemoMeta
  } from '@/api/gis'
  import { rememberedOrFirst } from '@/gis/preferProvider'
  import { collectionToSketch } from '@/gis/olOverlay'
  import { attachOlPlayback, samplesFromTrack, type OlPlaybackHandle } from '@/gis/olPlayback'
  import {
    bootLabMap,
    compactLabJson,
    haversineMeters,
    labSnippet,
    type LabMapBag
  } from '@/gis/labBoot'
  import { pointerWgs84 } from '@/gis/olMap'
  import { parseRasterSpec, parseTilesetSpec } from '@/gis/raster'
  import type { CesiumMod, CesiumViewer, TilesetPick } from '@/gis/cesiumMap'

  const props = defineProps<{ code: string; catalog: GisDemoMeta[] }>()
  const { t } = useI18n()
  const mapHost = ref<HTMLElement>()
  const payload = ref<unknown>(null)
  const jsonOpen = ref(false)
  const srcOpen = ref(false)
  const tab = ref('code')
  const ratioPct = ref(0)
  const speed = ref(1)
  const playing = ref(false)
  const clock = ref(0)
  const duration = ref(48)
  const measureMode = ref<'length' | 'area'>('length')
  const lines = ref<string[]>([])
  const hits = ref<string[]>([])
  let bag: LabMapBag | undefined
  let playback: OlPlaybackHandle | undefined
  let draw: Draw | undefined
  let measureSource: VectorSource | undefined
  let extraLayer: VectorLayer | undefined
  let rawCollection: unknown
  const RADIUS_M = 800

  /** 空间运算示例暴露的算子：缓冲另有独立示例，这里不重复 */
  const OPS_DEMO = [
    'intersects',
    'contains',
    'union',
    'difference',
    'convexHull',
    'centroid',
    'simplify',
    'bbox',
    'area',
    'length',
    'distance'
  ] as const
  const opsOp = ref<(typeof OPS_DEMO)[number]>('intersects')
  const opsText = ref('')
  const rasterOn = ref(true)
  const rasterOpacity = ref(90)
  const ingestSamples = ref<{ format: string; label: string; text: string }[]>([])
  const ingestFormat = ref('wkt')
  const ingestRaw = ref('')
  const ingestText = ref('')
  const ingesting = ref(false)
  let rasterSpecRaw: unknown

  const cesiumHost = ref<HTMLElement>()
  const loading3d = ref(false)
  const pick3d = ref<TilesetPick | undefined>()
  let cesiumApi: typeof import('@/gis/cesiumMap') | undefined
  let cesiumMod: CesiumMod | undefined
  let cesiumViewer: CesiumViewer | undefined
  let cesiumHandler: InstanceType<CesiumMod['ScreenSpaceEventHandler']> | undefined

  const meta = computed(() => props.catalog.find((row) => row.code === props.code))
  const is3d = computed(() => uiOf(props.code) === 'tileset')
  const uiOf = (code: string): string => {
    if (meta.value?.ui) {
      return meta.value.ui
    }
    const map: Record<string, string> = {
      heat: 'heatmap',
      cluster: 'cluster',
      playback: 'playback',
      buffer: 'buffer',
      ops: 'ops',
      radius: 'radius',
      geocode: 'geocode',
      measure: 'measure',
      tiles3d: 'tileset',
      raster: 'raster',
      ingest: 'ingest'
    }
    return map[code] || 'overlay'
  }
  const snippet = computed(() => labSnippet(props.code))
  const jsonView = computed(() => compactLabJson(payload.value, jsonOpen.value))
  const canExpand = computed(() => jsonView.value.includes('"omitted":'))
  const clockText = computed(() => {
    const fmt = (s: number) =>
      `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    return `${fmt(clock.value)} / ${fmt(duration.value)}`
  })
  const hint = computed(() => {
    if (props.code === 'geocode') {
      return t('pages.gis.labHintGeocode')
    }
    if (props.code === 'radius') {
      return t('pages.gis.labHintRadius')
    }
    if (props.code === 'measure') {
      return t('pages.gis.labHintMeasure')
    }
    if (props.code === 'playback') {
      return t('pages.gis.labHintPlayback')
    }
    if (props.code === 'ingest') {
      return t('pages.gis.labHintIngest')
    }
    if (props.code === 'raster') {
      return t('pages.gis.labHintRaster')
    }
    return ''
  })

  const opLabel = (op: string): string =>
    t(`pages.gis.op${op.charAt(0).toUpperCase()}${op.slice(1)}`)

  /** 示例的两个围栏：role=source 当运算对象，role=other 当第二个几何 */
  const roleFeature = (role: string): unknown => {
    const feats = (rawCollection as { features?: unknown[] })?.features ?? []
    const hit = feats.find(
      (f) => (f as { properties?: { role?: string } })?.properties?.role === role
    )
    return hit ? { type: 'FeatureCollection', features: [hit] } : undefined
  }

  const runOps = async (): Promise<void> => {
    if (!bag) {
      return
    }
    const source = roleFeature('source')
    const other = roleFeature('other')
    if (!source || !other) {
      return
    }
    opsText.value = ''
    const analyzed = await fetchGisAnalyze({
      op: opsOp.value,
      payload: source,
      other,
      tolerance: 0.002
    })
    payload.value = analyzed
    const m = analyzed.metrics || {}
    const parts: string[] = []
    if (typeof m.areaSqMeters === 'number' && m.areaSqMeters > 0) {
      parts.push(t('pages.gis.metricsArea', { n: Math.round(m.areaSqMeters) }))
    }
    if (typeof m.lengthMeters === 'number' && m.lengthMeters > 0) {
      parts.push(t('pages.gis.metricsLength', { n: Math.round(m.lengthMeters) }))
    }
    if (typeof m.distanceMeters === 'number') {
      parts.push(t('pages.gis.metricsDistance', { n: Math.round(m.distanceMeters) }))
    }
    if (m.intersects != null) {
      parts.push(`${t('pages.gis.opIntersects')}: ${m.intersects}`)
    }
    if (m.contains != null) {
      parts.push(`${t('pages.gis.opContains')}: ${m.contains}`)
    }
    const got = analyzed.collection?.count
    if (!parts.length && typeof got === 'number') {
      parts.push(t('pages.gis.metricsCount', { n: got }))
    }
    lines.value = parts
    opsText.value = parts.join(' · ') || t('pages.gis.labOpsNoMetrics')
    const result = collectionToSketch(analyzed.collection)
    if (result.length) {
      bag.overlays.set('lab-ops', result, bag.provider, {
        name: opLabel(opsOp.value),
        kind: 'vector',
        color: '#db2777'
      })
      bag.overlays.fit('lab-ops')
    } else {
      bag.overlays.remove('lab-ops')
      bag.overlays.fit('lab')
    }
    bag.map.updateSize()
  }

  /** 栅格叠加：{provider} 换成当前生效的供应商，地址仍走同源代理，密钥不落浏览器 */
  const applyRaster = (): void => {
    if (!bag) {
      return
    }
    const rec = (rasterSpecRaw || {}) as { url?: string }
    const spec = parseRasterSpec({
      ...(rasterSpecRaw as object),
      url: String(rec.url || '').replace('{provider}', bag.provider)
    })
    if (!spec) {
      ElMessage.error(t('pages.gis.labRasterBad'))
      return
    }
    bag.overlays.setRaster('lab-raster', spec, {
      name: meta.value?.title || props.code,
      kind: spec.type === 'WMS' ? 'wms' : 'xyz',
      visible: rasterOn.value,
      opacity: rasterOpacity.value / 100
    })
  }

  const pickSample = (): void => {
    const hit = ingestSamples.value.find((row) => row.format === ingestFormat.value)
    ingestRaw.value = hit?.text || ''
    ingestText.value = ''
  }

  const runIngest = async (): Promise<void> => {
    if (!bag) {
      return
    }
    if (!ingestRaw.value.trim()) {
      ElMessage.warning(t('pages.gis.labIngestEmpty'))
      return
    }
    ingesting.value = true
    try {
      const parsed = await fetchGisLayerIngestText(ingestRaw.value)
      payload.value = parsed
      const feats = collectionToSketch(parsed)
      bag.overlays.set('lab-ingest', feats, bag.provider, {
        name: meta.value?.title || props.code,
        kind: 'vector',
        color: '#0ea5e9'
      })
      bag.overlays.fit('lab-ingest')
      bag.map.updateSize()
      ingestText.value = t('pages.gis.metricsCount', { n: parsed.count ?? feats.length })
    } catch {
      ingestText.value = t('pages.gis.labIngestFailed')
    } finally {
      ingesting.value = false
    }
  }

  const copy = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('pages.gis.copiedContent'))
  }

  const togglePlay = (): void => {
    if (playing.value) {
      playback?.pause()
      playing.value = false
      return
    }
    playback?.play()
    playing.value = true
  }

  const stopPlay = (): void => {
    playback?.stop()
    playing.value = false
  }

  const onSeek = (val: number | number[]): void => {
    playback?.seek(Number(val) / 100)
  }

  const onSpeed = (val: string | number): void => {
    playback?.setSpeed(Number(val))
  }

  const resetMeasure = (): void => {
    measureSource?.clear()
    lines.value = []
    if (bag && measureSource) {
      bag.map.removeInteraction(draw as Draw)
      bindMeasure()
    }
  }

  const bindMeasure = (): void => {
    if (!bag || !measureSource) {
      return
    }
    draw = new Draw({
      source: measureSource,
      type: measureMode.value === 'area' ? 'Polygon' : 'LineString'
    })
    draw.on('drawend', (evt) => {
      const geom = evt.feature.getGeometry() as Geometry
      if (measureMode.value === 'length' && geom instanceof LineString) {
        const m = getLength(geom)
        lines.value = [t('pages.gis.metricsLength', { n: Math.round(m) })]
      } else if (geom instanceof Polygon) {
        const area = getArea(geom)
        lines.value = [t('pages.gis.metricsArea', { n: Math.round(area) })]
      }
    })
    bag.map.addInteraction(draw)
  }

  const paintRadius = (lon: number, lat: number): void => {
    if (!bag) {
      return
    }
    extraLayer?.getSource()?.clear()
    const ring = circular([lon, lat], RADIUS_M, 64)
    ring.transform('EPSG:4326', 'EPSG:3857')
    extraLayer?.getSource()?.addFeature(new Feature({ geometry: ring }))
    const points = collectionToSketch(rawCollection)
    const names = points
      .filter((f) => {
        const c = f.geometry.coordinates
        return (
          Array.isArray(c) && haversineMeters([lon, lat], [Number(c[0]), Number(c[1])]) <= RADIUS_M
        )
      })
      .map((f) => f.properties.name)
    hits.value = names
    lines.value = [t('pages.gis.labRadiusHit', { n: names.length, m: RADIUS_M })]
  }

  const mountScene = async (): Promise<void> => {
    srcOpen.value = false
    playback?.destroy()
    playback = undefined
    playing.value = false
    hits.value = []
    lines.value = []
    if (!bag) {
      return
    }
    if (draw) {
      bag.map.removeInteraction(draw)
      draw = undefined
    }
    bag.overlays.clear()
    bag.overlays.setCluster(false)
    pick3d.value = undefined
    extraLayer?.getSource()?.clear()
    jsonOpen.value = false
    tab.value = 'code'
    const data = await fetchGisDemo(props.code)
    rawCollection = data
    payload.value = data
    const ui = uiOf(props.code)
    if (ui === 'tileset') {
      await renderTileset(data)
      return
    }
    if (ui === 'playback') {
      const pack = samplesFromTrack(data)
      duration.value = pack.durationSec
      playback = attachOlPlayback(bag.map, pack.samples, bag.provider, {
        durationSec: pack.durationSec,
        onTick: (s) => {
          ratioPct.value = Math.round(s.ratio * 100)
          clock.value = s.clock
          if (s.ratio >= 1) {
            playing.value = false
          }
        }
      })
      playback.play()
      playing.value = true
      return
    }
    if (ui === 'geocode' || ui === 'measure') {
      payload.value = null
      if (ui === 'measure') {
        bindMeasure()
      }
      bag.map.updateSize()
      return
    }
    if (ui === 'raster') {
      rasterSpecRaw = data
      rasterOn.value = true
      const opacity = Number((data as { opacity?: number })?.opacity)
      rasterOpacity.value = Number.isFinite(opacity) ? Math.round(opacity * 100) : 90
      applyRaster()
      bag.map.updateSize()
      return
    }
    if (ui === 'ingest') {
      const rows = (data as { samples?: { format: string; label: string; text: string }[] })
        ?.samples
      ingestSamples.value = Array.isArray(rows) ? rows : []
      ingestFormat.value = ingestSamples.value[0]?.format || 'wkt'
      pickSample()
      bag.map.updateSize()
      return
    }
    if (ui === 'ops') {
      bag.overlays.set('lab', collectionToSketch(data), bag.provider, {
        name: meta.value?.title || props.code,
        kind: 'vector',
        color: '#2563eb'
      })
      bag.overlays.fit('lab')
      await runOps()
      return
    }
    let collection: unknown = data
    let kind: 'vector' | 'heatmap' = ui === 'heatmap' ? 'heatmap' : 'vector'
    if (ui === 'buffer') {
      const analyzed = await fetchGisAnalyze({ op: 'buffer', distance: 500, payload: data })
      collection = analyzed.collection
      payload.value = analyzed
      const area = analyzed.metrics?.areaSqMeters
      if (typeof area === 'number') {
        lines.value = [t('pages.gis.metricsArea', { n: Math.round(area) })]
      }
    }
    bag.overlays.set('lab', collectionToSketch(collection), bag.provider, {
      name: meta.value?.title || props.code,
      kind,
      color: ui === 'buffer' ? '#db2777' : '#2563eb'
    })
    if (ui === 'cluster') {
      bag.overlays.setCluster(true)
    }
    bag.overlays.fit('lab')
    if (ui === 'radius') {
      paintRadius(116.475, 39.918)
    }
    bag.map.updateSize()
  }

  /** 三维示例：起 Cesium、加载示例切片、绑点选 */
  const renderTileset = async (data: unknown): Promise<void> => {
    const spec = parseTilesetSpec(data)
    if (!spec) {
      ElMessage.error(t('pages.gis.tilesetFailed', { name: meta.value?.title || props.code }))
      return
    }
    await nextTick()
    if (!cesiumHost.value) {
      return
    }
    loading3d.value = true
    try {
      cesiumApi = await import('@/gis/cesiumMap')
      cesiumMod = cesiumMod ?? (await cesiumApi.loadCesium())
      if (!cesiumViewer) {
        cesiumViewer = cesiumApi.createCesiumViewer(cesiumHost.value, cesiumMod)
        const provider = rememberedOrFirst((await fetchGisStatus()).providers)
        cesiumApi.applyCesiumBasemap(cesiumMod, cesiumViewer, provider, 'img_label')
        bindTilesetPick(cesiumMod, cesiumViewer)
      }
      const tileset = await cesiumApi.loadCesiumTileset(cesiumMod, cesiumViewer, spec)
      cesiumApi.flyToCesiumTileset(cesiumMod, cesiumViewer, tileset)
    } catch {
      ElMessage.error(t('pages.gis.tilesetFailed', { name: meta.value?.title || props.code }))
    } finally {
      loading3d.value = false
    }
  }

  const bindTilesetPick = (Cesium: CesiumMod, viewer: CesiumViewer): void => {
    cesiumHandler?.destroy()
    cesiumHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas)
    cesiumHandler.setInputAction((movement: { position: unknown }) => {
      const picked = viewer.scene.pick(movement.position as never)
      pick3d.value = cesiumApi?.readTilesetPick(Cesium, picked)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  const onMapClick = async (pixel: number[]): Promise<void> => {
    if (!bag) {
      return
    }
    const wgs = pointerWgs84(bag.map, pixel, bag.provider)
    if (!wgs) {
      return
    }
    if (props.code === 'radius') {
      paintRadius(wgs[0], wgs[1])
      return
    }
    if (props.code === 'geocode') {
      const info = await fetchGisReverse(wgs[0], wgs[1], bag.provider)
      lines.value = [
        `${wgs[0].toFixed(6)}, ${wgs[1].toFixed(6)}`,
        info.address || [info.province, info.city, info.county, info.poi].filter(Boolean).join(' ')
      ].filter(Boolean)
      payload.value = info
      tab.value = 'data'
      srcOpen.value = true
    }
  }

  watch(
    () => props.code,
    async () => {
      if (bag) {
        await mountScene()
      }
    }
  )

  onMounted(async () => {
    if (!mapHost.value) {
      return
    }
    const status = await fetchGisStatus()
    const provider = rememberedOrFirst(status.providers)
    bag = await bootLabMap(mapHost.value, provider)
    extraLayer = new VectorLayer({
      zIndex: 22,
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({ color: '#0ea5e9', width: 2 }),
        fill: new Fill({ color: 'rgba(14,165,233,0.12)' })
      })
    })
    measureSource = extraLayer.getSource() as VectorSource
    bag.map.addLayer(extraLayer)
    bag.map.on('singleclick', (evt) => {
      void onMapClick(evt.pixel)
    })
    await nextTick()
    await mountScene()
  })

  onActivated(() => {
    bag?.map.updateSize()
  })

  const closeOverlays = (): void => {
    srcOpen.value = false
  }

  onDeactivated(closeOverlays)

  onBeforeRouteLeave(() => {
    closeOverlays()
  })

  onBeforeUnmount(() => {
    closeOverlays()
    playback?.destroy()
    if (draw && bag) {
      bag.map.removeInteraction(draw)
    }
    bag?.destroy()
    cesiumHandler?.destroy()
    cesiumHandler = undefined
    cesiumViewer?.destroy()
    cesiumViewer = undefined
  })
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-lab-play,
  .gis-lab-stage {
    position: absolute;
    inset: 0;
  }

  /* 左上角被示例导航面板占着，属性浮层放右侧信息卡下方 */
  .gis-lab-pick {
    top: 60px;
    right: 12px;
    flex-direction: column;
    align-items: stretch;
    width: 240px;
    font-size: 12px;
  }

  .gis-lab-pick ul {
    padding: 0;
    margin: 6px 0 0;
    list-style: none;
  }

  .gis-lab-pick li {
    display: flex;
    gap: 8px;
    padding: 2px 0;
  }

  .gis-lab-pick .gis-pick-key {
    flex: 0 0 76px;
    color: var(--el-text-color-secondary);
  }

  .gis-lab-chip {
    max-width: min(480px, calc(100% - 320px));
  }

  .gis-lab-chip strong {
    flex-shrink: 0;
    font-size: 14px;
  }

  .gis-lab-chip span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gis-playbar {
    right: 12px;
    bottom: 12px;
    left: 304px;
    z-index: 5;
  }

  .gis-play-slider {
    flex: 1;
    min-width: 80px;
  }

  .gis-speed {
    width: 88px;
  }

  .gis-clock {
    flex-shrink: 0;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
  }

  .gis-bar-label {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gis-ops-select {
    width: 128px;
  }

  /* 入站示例要放原文输入，改成上下两行；高度跟内容走，不加内层滚动 */
  .gis-ingest-bar {
    right: 12px;
    bottom: 12px;
    left: 304px;
    z-index: 5;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .gis-ingest-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .gis-ingest-bar :deep(.el-textarea__inner) {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    resize: none;
  }

  .gis-lab-float {
    top: 72px;
    left: 304px;
    max-width: 360px;
    margin: 0;
    pointer-events: none;
  }

  .gis-lab-sum {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .gis-pre {
    min-height: 80px;
    max-height: 220px;
    padding: 10px;
    margin: 0 0 8px;
    overflow: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .gis-lab-actions {
    display: flex;
    gap: 8px;
  }

  .gis-metrics,
  .gis-hits {
    padding: 0;
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.7;
    list-style: none;
  }
</style>
