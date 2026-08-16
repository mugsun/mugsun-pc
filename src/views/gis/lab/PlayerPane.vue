<template>
  <div class="gis-lab-play">
    <div class="gis-lab-stage">
      <div ref="mapHost" class="gis-map"></div>
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
      <p v-if="hint" class="gis-hud gis-lab-float">{{ hint }}</p>
    </div>
    <ElDrawer v-model="srcOpen" :title="meta?.title || code" direction="btt" size="42%">
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
  import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
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
    fetchGisReverse,
    fetchGisStatus,
    type GisDemoMeta
  } from '@/api/gis'
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
  import type { GisProviderCode } from '@/gis/types'

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

  const meta = computed(() => props.catalog.find((row) => row.code === props.code))
  const uiOf = (code: string): string => {
    if (meta.value?.ui) {
      return meta.value.ui
    }
    const map: Record<string, string> = {
      heat: 'heatmap',
      cluster: 'cluster',
      playback: 'playback',
      track: 'playback',
      buffer: 'buffer',
      radius: 'radius',
      geocode: 'geocode',
      measure: 'measure'
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
    return ''
  })

  const copy = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('pages.gis.copied'))
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
    extraLayer?.getSource()?.clear()
    jsonOpen.value = false
    tab.value = 'code'
    const data = await fetchGisDemo(props.code)
    rawCollection = data
    payload.value = data
    const ui = uiOf(props.code)
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
      const info = await fetchGisReverse(wgs[0], wgs[1])
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
    const first = status.providers.find((p) => p.enabled && p.configured)
    const provider = (first?.provider || 'tianditu') as GisProviderCode
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

  onBeforeUnmount(() => {
    playback?.destroy()
    if (draw && bag) {
      bag.map.removeInteraction(draw)
    }
    bag?.destroy()
  })
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-lab-play,
  .gis-lab-stage {
    position: absolute;
    inset: 0;
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
