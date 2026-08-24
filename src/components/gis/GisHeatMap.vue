<template>
  <div ref="host" class="gis-heat" data-testid="gis-heat-map"></div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import type Map from 'ol/Map'
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
      const status = await fetchGisStatus()
      provider = firstProvider(status.providers || [])
    } catch {
      provider = DEFAULT_SCENE.baseMap.provider
    }
    map = createOlMap(host.value, DEFAULT_SCENE.view2d, provider)
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
  .gis-heat {
    width: 100%;
    height: 280px;
    overflow: hidden;
    border-radius: 8px;
  }
</style>
