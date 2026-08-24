<template>
  <div class="gis-pick">
    <div ref="host" class="gis-pick-map" data-testid="gis-pick-map"></div>
    <div class="gis-pick-bar">
      <span class="gis-pick-addr" :title="label">{{ label }}</span>
      <ElButton v-if="picked" link type="danger" :disabled="disabled" @click="clear">
        {{ $t('pages.gis.pickClear') }}
      </ElButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type Map from 'ol/Map'
  import { fetchGisReverse, fetchGisStatus, type GisProviderStatus } from '@/api/gis'
  import { rememberedOrFirst } from '@/gis/preferProvider'
  import { applyOlBasemap, createOlMap, pointerWgs84, setOlView } from '@/gis/olMap'
  import { attachOlOverlays, type OlOverlayHandle } from '@/gis/olOverlay'
  import { geoPointsToSketch } from '@/gis/trackHeat'
  import { DEFAULT_SCENE, type GisProviderCode } from '@/gis/types'

  export interface GisPickValue {
    lon: number
    lat: number
    address?: string
  }

  const props = defineProps<{
    modelValue?: GisPickValue | string | null
    value?: GisPickValue | string | null
    disabled?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: GisPickValue | null): void
    (e: 'change', value: GisPickValue | null): void
  }>()

  defineOptions({ name: 'GisPick', inheritAttrs: false })

  const { t } = useI18n()
  const host = ref<HTMLElement>()
  let map: Map | undefined
  let overlays: OlOverlayHandle | undefined
  let provider: GisProviderCode = DEFAULT_SCENE.baseMap.provider

  const inner = ref<GisPickValue | null>(null)

  const picked = computed(() => inner.value != null)
  const label = computed(() => {
    const v = inner.value
    if (!v) {
      return t('pages.gis.pickEmpty')
    }
    if (v.address) {
      return v.address
    }
    return `${v.lon.toFixed(4)}, ${v.lat.toFixed(4)}`
  })

  function parse(raw: unknown): GisPickValue | null {
    if (raw == null || raw === '') {
      return null
    }
    let obj: unknown = raw
    if (typeof raw === 'string') {
      try {
        obj = JSON.parse(raw)
      } catch {
        return null
      }
    }
    if (!obj || typeof obj !== 'object') {
      return null
    }
    const rec = obj as Record<string, unknown>
    const lon = Number(rec.lon ?? rec.lng ?? rec.longitude)
    const lat = Number(rec.lat ?? rec.latitude)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      return null
    }
    return {
      lon,
      lat,
      address: rec.address ? String(rec.address) : undefined
    }
  }

  function emitValue(next: GisPickValue | null): void {
    inner.value = next
    emit('update:modelValue', next)
    emit('change', next)
    paint()
  }

  function paint(): void {
    if (!overlays) {
      return
    }
    const v = inner.value
    overlays.clear()
    if (!v) {
      return
    }
    overlays.set('pick', geoPointsToSketch([{ lon: v.lon, lat: v.lat }]), provider, {
      name: v.address || `${v.lon.toFixed(4)}, ${v.lat.toFixed(4)}`,
      kind: 'vector',
      color: '#2563eb'
    })
  }

  function firstProvider(rows: GisProviderStatus[]): GisProviderCode {
    return rememberedOrFirst(rows)
  }

  const boot = async (): Promise<void> => {
    if (!host.value) {
      return
    }
    try {
      const status = await fetchGisStatus()
      provider = firstProvider(status.providers || [])
    } catch {
      provider = DEFAULT_SCENE.baseMap.provider
    }
    const center: [number, number] = inner.value
      ? [inner.value.lon, inner.value.lat]
      : DEFAULT_SCENE.view2d.center
    map = createOlMap(host.value, { center, zoom: inner.value ? 14 : 11 }, provider)
    applyOlBasemap(map, provider, 'img_label')
    overlays = attachOlOverlays(map)
    map.on('singleclick', (evt) => {
      if (props.disabled || !map) {
        return
      }
      const wgs = pointerWgs84(map, evt.pixel, provider)
      if (!wgs) {
        return
      }
      void onPick(wgs[0], wgs[1])
    })
    paint()
  }

  const onPick = async (lon: number, lat: number): Promise<void> => {
    const next: GisPickValue = { lon, lat }
    try {
      const rev = await fetchGisReverse(lon, lat, provider)
      if (rev?.address) {
        next.address = rev.address
      }
    } catch {
      // 无 Key / 逆地理失败仍保留坐标
    }
    setOlView(map!, { center: [lon, lat], zoom: map?.getView().getZoom() ?? 14 }, provider)
    emitValue(next)
  }

  const clear = (): void => {
    emitValue(null)
  }

  watch(
    () => props.modelValue ?? props.value,
    (raw) => {
      const parsed = parse(raw)
      inner.value = parsed
      paint()
    },
    { immediate: true }
  )

  onMounted(() => {
    void boot()
  })

  onBeforeUnmount(() => {
    overlays?.destroy()
    map?.setTarget(undefined)
    map = undefined
  })
</script>

<style scoped>
  .gis-pick {
    width: 100%;
  }

  .gis-pick-map {
    width: 100%;
    height: 240px;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }

  .gis-pick-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .gis-pick-addr {
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
