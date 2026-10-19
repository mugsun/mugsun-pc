<template>
  <div class="gis-heat-wrap">
    <div ref="host" class="gis-heat" data-testid="gis-heat-map"></div>
    <GisTileErrorHint :host="host" />
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import GisTileErrorHint from './GisTileErrorHint.vue'
  import type Map from 'ol/Map'
  // 控件（比例尺、版权归属）的样式；此前只在 GIS 页面和 GisPick 里引入，直接打开概览时缺失
  import 'ol/ol.css'
  import { fetchGisStatus, type GisProviderStatus } from '@/api/gis'
  import { rememberedOrFirst } from '@/gis/preferProvider'
  import { applyOlBasemap, createOlMap } from '@/gis/olMap'
  import { attachOlOverlays, type OlOverlayHandle } from '@/gis/olOverlay'
  import { geoPointsToSketch, type TrackGeoPoint } from '@/gis/trackHeat'
  import { DEFAULT_SCENE, type GisProviderCode } from '@/gis/types'

  const props = defineProps<{
    points: TrackGeoPoint[]
  }>()

  const host = ref<HTMLElement>()
  let map: Map | undefined
  let overlays: OlOverlayHandle | undefined
  let provider: GisProviderCode = DEFAULT_SCENE.baseMap.provider

  function firstProvider(rows: GisProviderStatus[]): GisProviderCode {
    return rememberedOrFirst(rows)
  }

  const paint = (): void => {
    if (!overlays) {
      return
    }
    overlays.clear()
    const feats = geoPointsToSketch(props.points || [])
    if (!feats.length) {
      return
    }
    overlays.set('track-heat', feats, provider, {
      name: 'track-heat',
      kind: 'heatmap',
      color: '#ef4444'
    })
    overlays.fit('track-heat')
  }

  onMounted(async () => {
    if (!host.value) {
      return
    }
    try {
      // 静默探测：失败时下面退回默认底图，不弹 toast
      const status = await fetchGisStatus({ silent: true })
      provider = firstProvider(status.providers || [])
    } catch {
      provider = DEFAULT_SCENE.baseMap.provider
    }
    // 卡片高度有限：不放缩放控件，只保留比例尺（样式里移到右下角）
    map = createOlMap(host.value, DEFAULT_SCENE.view2d, provider, { zoomControl: false })
    applyOlBasemap(map, provider, 'img_label')
    overlays = attachOlOverlays(map)
    paint()
  })

  watch(
    () => props.points,
    () => paint(),
    { deep: true }
  )

  onBeforeUnmount(() => {
    overlays?.destroy()
    map?.setTarget(undefined)
  })
</script>

<style scoped>
  .gis-heat-wrap {
    position: relative;
  }

  .gis-heat {
    width: 100%;
    height: 280px;
    overflow: hidden;
    border-radius: 8px;
  }

  /* 比例尺放右下角，叠在版权归属上方 */
  .gis-heat :deep(.ol-scale-line) {
    right: 8px;
    bottom: 28px;
    left: auto;
  }
</style>
