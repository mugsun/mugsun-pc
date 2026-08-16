<!-- 空间分析：全幅地图 + 左侧 HUD 运算表单。 -->
<template>
  <div class="gis-shell art-full-height">
    <div class="gis-map-shell">
      <div ref="mapHost" class="gis-map"></div>
      <aside class="gis-hud gis-hud-panel gis-hud-panel-wide">
        <p class="gis-panel-lead">{{ $t('pages.gis.analyzeHint') }}</p>
        <ElForm label-position="top" size="small">
          <ElFormItem :label="$t('pages.gis.analyzeSource')">
            <ElSelect v-model="sourceId" clearable filterable class="gis-w-full">
              <ElOption
                v-for="row in catalog"
                :key="row.id"
                :label="sourceLabel(row)"
                :value="String(row.id)"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem :label="$t('pages.gis.analyzeOp')">
            <ElSelect v-model="op" class="gis-w-full">
              <ElOption
                v-for="item in ops"
                :key="item"
                :label="$t(`pages.gis.op${cap(item)}`)"
                :value="item"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem v-if="op === 'buffer'" :label="$t('pages.gis.analyzeDistance')">
            <ElInputNumber
              v-model="distance"
              :min="1"
              :max="200000"
              :step="50"
              controls-position="right"
              class="gis-w-full"
            />
          </ElFormItem>
          <ElFormItem v-if="op === 'simplify'" :label="$t('pages.gis.analyzeTolerance')">
            <ElInputNumber
              v-model="tolerance"
              :min="0"
              :max="1"
              :step="0.0001"
              controls-position="right"
              class="gis-w-full"
            />
          </ElFormItem>
          <ElFormItem v-if="needsOther" :label="$t('pages.gis.analyzeOther')">
            <ElSelect v-model="otherId" clearable filterable class="gis-w-full">
              <ElOption
                v-for="row in catalog"
                :key="row.id"
                :label="sourceLabel(row)"
                :value="String(row.id)"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem :label="$t('pages.gis.layerPayload')">
            <ElInput
              v-model="payload"
              type="textarea"
              :rows="4"
              :placeholder="$t('pages.gis.layerPayloadHint')"
            />
          </ElFormItem>
        </ElForm>
        <div class="gis-analyze-actions">
          <ElButton type="primary" size="small" :loading="running" @click="run">{{
            $t('pages.gis.analyzeRun')
          }}</ElButton>
          <ElButton
            v-perm="'gis:layer:save'"
            size="small"
            :disabled="!result"
            :loading="saving"
            @click="save"
          >
            {{ $t('pages.gis.analyzeSave') }}
          </ElButton>
          <ElButton size="small" :disabled="!result" @click="openOnMap">{{
            $t('pages.gis.overlay')
          }}</ElButton>
        </div>
        <dl v-if="metricsText.length" class="gis-metrics">
          <div v-for="item in metricsText" :key="item">{{ item }}</div>
        </dl>
      </aside>
      <p class="gis-hud gis-hud-status">{{ $t('pages.gis.analyzeCoach') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    fetchGisAnalyze,
    fetchGisLayerList,
    fetchGisStatus,
    fetchSaveGisLayer,
    type GisAnalyzeResult,
    type GisLayerRow
  } from '@/api/gis'
  import { collectionToSketch } from '@/gis/olOverlay'
  import { bootLabMap, type LabMapBag } from '@/gis/labBoot'
  import type { GisProviderCode } from '@/gis/types'

  defineOptions({ name: 'GisAnalyze' })

  const OPS = [
    'buffer',
    'centroid',
    'bbox',
    'area',
    'length',
    'distance',
    'intersects',
    'contains',
    'union',
    'difference',
    'simplify',
    'convexHull'
  ] as const

  const { t } = useI18n()
  const router = useRouter()
  const catalog = ref<GisLayerRow[]>([])
  const sourceId = ref('')
  const otherId = ref('')
  const op = ref<(typeof OPS)[number]>('buffer')
  const distance = ref(500)
  const tolerance = ref(0.0001)
  const payload = ref('')
  const running = ref(false)
  const saving = ref(false)
  const result = ref<GisAnalyzeResult | null>(null)
  const savedId = ref<string | number | undefined>()
  const mapHost = ref<HTMLElement>()
  const ops = OPS
  let bag: LabMapBag | undefined

  const needsOther = computed(() =>
    ['distance', 'intersects', 'contains', 'difference'].includes(op.value)
  )

  const cap = (raw: string): string => raw.charAt(0).toUpperCase() + raw.slice(1)

  const sourceLabel = (row: GisLayerRow): string =>
    `${row.name}${row.featureCount ? ` (${row.featureCount})` : ''}`

  const parsePayload = (): unknown => {
    const raw = payload.value.trim()
    if (!raw) {
      return undefined
    }
    if (raw.startsWith('{') || raw.startsWith('[')) {
      return JSON.parse(raw)
    }
    return raw
  }

  const metricsText = computed(() => {
    const m = result.value?.metrics
    if (!m) {
      return []
    }
    const out: string[] = []
    if (m.count != null) {
      out.push(t('pages.gis.metricsCount', { n: m.count }))
    }
    if (typeof m.areaSqMeters === 'number') {
      out.push(t('pages.gis.metricsArea', { n: Math.round(m.areaSqMeters) }))
    }
    if (typeof m.lengthMeters === 'number') {
      out.push(t('pages.gis.metricsLength', { n: Math.round(m.lengthMeters) }))
    }
    if (typeof m.distanceMeters === 'number') {
      out.push(t('pages.gis.metricsDistance', { n: Math.round(m.distanceMeters) }))
    }
    if (m.intersects != null) {
      out.push(`${t('pages.gis.opIntersects')}: ${m.intersects}`)
    }
    if (m.contains != null) {
      out.push(`${t('pages.gis.opContains')}: ${m.contains}`)
    }
    return out
  })

  const preview = async (): Promise<void> => {
    if (!bag) {
      return
    }
    bag.overlays.clear()
    const feats = collectionToSketch(result.value?.collection)
    bag.overlays.set('analyze-preview', feats, bag.provider, {
      name: t(`pages.gis.op${cap(op.value)}`),
      kind: 'vector',
      color: '#db2777'
    })
    bag.overlays.fit('analyze-preview')
    bag.map.updateSize()
  }

  const run = async (): Promise<void> => {
    running.value = true
    savedId.value = undefined
    try {
      const body: Record<string, unknown> = {
        op: op.value,
        distance: distance.value,
        tolerance: tolerance.value
      }
      const pasted = parsePayload()
      if (pasted !== undefined) {
        body.payload = pasted
      } else if (sourceId.value) {
        body.layerId = sourceId.value
      } else {
        ElMessage.warning(t('pages.gis.analyzeEmpty'))
        return
      }
      if (needsOther.value) {
        if (!otherId.value) {
          ElMessage.warning(t('pages.gis.analyzeOther'))
          return
        }
        body.otherLayerId = otherId.value
      }
      result.value = await fetchGisAnalyze(body)
      await nextTick()
      await preview()
    } finally {
      running.value = false
    }
  }

  const save = async (): Promise<void> => {
    if (!result.value?.collection) {
      return
    }
    saving.value = true
    try {
      const row = await fetchSaveGisLayer({
        name: `${t(`pages.gis.op${cap(op.value)}`)}-${Date.now().toString().slice(-6)}`,
        kind: 'vector',
        payload: result.value.collection
      })
      savedId.value = row.id
      ElMessage.success(t('pages.gis.analyzeSaved'))
    } finally {
      saving.value = false
    }
  }

  const openOnMap = (): void => {
    if (!savedId.value) {
      ElMessage.warning(t('pages.gis.analyzeSave'))
      return
    }
    router.push({ path: '/gis/workspace', query: { layerId: String(savedId.value) } })
  }

  onMounted(async () => {
    catalog.value = ((await fetchGisLayerList()) ?? []).filter(
      (row) => row.kind !== 'xyz' && row.kind !== 'wms'
    )
    const status = await fetchGisStatus()
    const first = status.providers.find((p) => p.enabled && p.configured)
    const provider = (first?.provider || 'tianditu') as GisProviderCode
    await nextTick()
    if (mapHost.value) {
      bag = await bootLabMap(mapHost.value, provider)
    }
  })

  onActivated(() => {
    bag?.map.updateSize()
  })

  onBeforeUnmount(() => {
    bag?.destroy()
    bag = undefined
  })
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-hud-panel-wide {
    overflow: auto;
  }

  .gis-panel-lead {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .gis-analyze-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .gis-metrics {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
</style>
