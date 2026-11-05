<!-- 空间行为：agg 热力(weight) / points 点选跳回放或用户画像；读 sys:track-spatial:list。
     DEV 仅 VITE_TRACK_SPATIAL_MOCK=true 走本地 mock（仿 ask）；菜单种子随后端，勿半成品上线。
     地图组合 @/components/gis/GisSpatialMap；不上 Cesium、不做网页热力图。 -->
<template>
  <div class="track-spatial-page art-full-height">
    <div class="track-toolbar">
      <ElSelect
        v-model="appKey"
        :loading="appsLoading"
        :placeholder="$t('pages.track.shared.appPlaceholder')"
        class="track-app-select"
      >
        <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
      </ElSelect>
      <ElRadioGroup v-model="days">
        <ElRadioButton :value="1">{{ $t('pages.track.shared.today') }}</ElRadioButton>
        <ElRadioButton :value="7">{{ $t('pages.track.shared.last7Days') }}</ElRadioButton>
        <ElRadioButton :value="30">{{ $t('pages.track.shared.last30Days') }}</ElRadioButton>
      </ElRadioGroup>
      <ElRadioGroup v-model="mode">
        <ElRadioButton value="agg">{{ $t('pages.track.spatial.modeAgg') }}</ElRadioButton>
        <ElRadioButton value="points">{{ $t('pages.track.spatial.modePoints') }}</ElRadioButton>
      </ElRadioGroup>
      <ElSelect
        v-model="eventNames"
        multiple
        filterable
        allow-create
        default-first-option
        clearable
        collapse-tags
        collapse-tags-tooltip
        :placeholder="$t('pages.track.spatial.eventNamesPlaceholder')"
        class="track-event-names"
      >
        <ElOption v-for="name in eventNameOptions" :key="name" :label="name" :value="name" />
      </ElSelect>
      <ElInput
        v-model="funnelId"
        clearable
        :placeholder="$t('pages.track.spatial.funnelIdPlaceholder')"
        class="track-funnel-id"
      />
      <ElSelect
        v-model="funnelSteps"
        multiple
        filterable
        allow-create
        default-first-option
        clearable
        collapse-tags
        :placeholder="$t('pages.track.spatial.funnelStepsPlaceholder')"
        class="track-funnel-steps"
      />
      <ElSelect v-model="windowHours" class="track-window-select">
        <ElOption :value="1" :label="$t('pages.track.funnel.window1h')" />
        <ElOption :value="24" :label="$t('pages.track.funnel.window24h')" />
        <ElOption :value="168" :label="$t('pages.track.funnel.window7d')" />
      </ElSelect>
      <ElCheckbox v-model="convertedOnly">{{ $t('pages.track.spatial.convertedOnly') }}</ElCheckbox>
      <ElButton type="primary" :loading="loading" :disabled="!canList" @click="search">{{
        $t('pages.track.shared.search')
      }}</ElButton>
    </div>

    <ElAlert
      v-if="usingMock"
      type="info"
      show-icon
      :closable="false"
      class="track-mock-hint"
      :title="$t('pages.track.spatial.mockHint')"
    />
    <ElAlert
      v-if="!canList"
      type="warning"
      show-icon
      :closable="false"
      class="track-no-perm"
      :title="$t('pages.track.spatial.noPerm')"
    />
    <ElAlert
      v-if="result?.truncated"
      type="warning"
      show-icon
      :closable="false"
      class="track-truncated"
      :title="$t('pages.track.spatial.truncated')"
    />

    <div class="track-spatial-body">
      <ElCard class="track-spatial-map-card art-card" shadow="never">
        <div class="track-spatial-map-head">
          <span class="track-spatial-card-title">{{ $t('pages.track.spatial.mapTitle') }}</span>
          <span v-if="searched && result" class="track-spatial-geo-count">
            {{ $t('pages.track.spatial.geoCount', { n: result.geoCount ?? 0 }) }}
          </span>
        </div>
        <div v-loading="loading" class="track-spatial-map-wrap">
          <ElEmpty v-if="!searched" :description="$t('pages.track.spatial.emptyIdle')" />
          <ElEmpty v-else-if="emptyResult" :description="$t('pages.track.spatial.emptyNoData')" />
          <GisSpatialMap
            v-else-if="result"
            :mode="normalizeSpatialMode(result.mode)"
            :cells="result.cells"
            :points="result.points"
            :truncated="result.truncated"
            @update:viewport="onViewport"
            @select-point="onSelectPoint"
          />
        </div>
      </ElCard>

      <ElCard class="track-spatial-side art-card" shadow="never">
        <p class="track-spatial-card-title">{{ $t('pages.track.spatial.sideTitle') }}</p>
        <ElEmpty v-if="!selected" :description="$t('pages.track.spatial.sideEmpty')" />
        <template v-else>
          <div class="track-spatial-kv">
            <span class="k">{{ $t('pages.track.shared.eventName') }}</span>
            <span>{{ selected.eventName || '-' }}</span>
          </div>
          <div class="track-spatial-kv">
            <span class="k">{{ $t('pages.track.spatial.coords') }}</span>
            <span>{{ selected.lon.toFixed(5) }}, {{ selected.lat.toFixed(5) }}</span>
          </div>
          <div class="track-spatial-kv">
            <span class="k">{{ $t('pages.track.shared.page') }}</span>
            <span>{{ selected.urlPath || '-' }}</span>
          </div>
          <div class="track-spatial-kv">
            <span class="k">{{ $t('pages.track.spatial.time') }}</span>
            <span>{{ fmtTrackTime(selected.ts as any) }}</span>
          </div>
          <div class="track-spatial-actions">
            <ElButton type="primary" :disabled="!canGoReplay" @click="goReplay">
              {{ $t('pages.track.spatial.openReplay') }}
            </ElButton>
            <ElButton :disabled="!canGoUser" @click="goUser">
              {{ $t('pages.track.spatial.openUser') }}
            </ElButton>
          </div>
          <p v-if="jumpHint" class="track-spatial-jump-hint">{{ jumpHint }}</p>
        </template>
      </ElCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { fetchTrackEventDefPage, fetchTrackSpatial } from '@/api/track'
  import GisSpatialMap from '@/components/gis/GisSpatialMap.vue'
  import type { TrackSpatialPoint, TrackSpatialViewport } from '@/gis/trackSpatial'
  import { hasPerm } from '@/utils/permission'
  import { fmtTrackTime, useTrackApp } from '@/views/track/shared/useTrackApp'
  import {
    clampSpatialDays,
    isSpatialEmpty,
    isTrackSpatialMockEnabled,
    normalizeSpatialMode,
    resolveSpatialPointJump,
    zoomToGridPrecision,
    type TrackSpatialMode,
    type TrackSpatialQuery,
    type TrackSpatialResult
  } from '../../spatial-shape'

  defineOptions({ name: 'TrackSpatial' })

  const { t } = useI18n()
  const router = useRouter()
  const { appOptions, appKey, days, appsLoading } = useTrackApp()

  /** 读：sys:track-spatial:list（菜单/种子随后端合入） */
  const canList = computed(() => hasPerm('sys:track-spatial:list'))
  const canReplay = computed(() => hasPerm('sys:track-replay:view'))

  /** DEV 仅 VITE_TRACK_SPATIAL_MOCK=true；生产动态 import 分支被消除（仿 ask） */
  const usingMock = isTrackSpatialMockEnabled()

  const mode = ref<TrackSpatialMode>('agg')
  const eventNames = ref<string[]>([])
  const eventNameOptions = ref<string[]>(['page_view', 'click', 'purchase', 'add_cart'])
  const funnelId = ref('')
  const funnelSteps = ref<string[]>([])
  const windowHours = ref(24)
  const convertedOnly = ref(false)
  const viewport = ref<Partial<TrackSpatialViewport>>({})

  const loading = ref(false)
  const searched = ref(false)
  const result = ref<TrackSpatialResult | null>(null)
  const selected = ref<TrackSpatialPoint | null>(null)
  /** 避免首帧 viewport 与手动查询打架 */
  const autoReloadEnabled = ref(false)

  const emptyResult = computed(() => searched.value && isSpatialEmpty(result.value))

  const selectedJump = computed(() => resolveSpatialPointJump(selected.value, canReplay.value))
  const canGoReplay = computed(() => selectedJump.value.kind === 'replay')
  const canGoUser = computed(() => selectedJump.value.kind === 'user')
  const jumpHint = computed(() => {
    const j = selectedJump.value
    if (j.kind === 'none' && j.reason === 'no-replay-perm') {
      return t('pages.track.spatial.noReplayPerm')
    }
    if (j.kind === 'none' && j.reason === 'no-id') {
      return t('pages.track.spatial.noJumpId')
    }
    return ''
  })

  void fetchTrackEventDefPage({ pageNum: 1, pageSize: 100 })
    .then((resp: any) => {
      const records = resp?.records ?? resp?.data?.records ?? []
      const names = records.map((r: any) => String(r.eventName || '').trim()).filter(Boolean)
      if (names.length) {
        eventNameOptions.value = Array.from(new Set([...eventNameOptions.value, ...names]))
      }
    })
    .catch(() => {
      /* 事件名列表失败不挡主流程 */
    })

  const buildQuery = (): TrackSpatialQuery => {
    const q: TrackSpatialQuery = {
      appKey: appKey.value,
      days: clampSpatialDays(Number(days.value)),
      mode: normalizeSpatialMode(mode.value)
    }
    if (viewport.value.bbox) q.bbox = viewport.value.bbox
    if (viewport.value.zoom != null) {
      q.zoom = viewport.value.zoom
      q.gridPrecision = zoomToGridPrecision(viewport.value.zoom)
    }
    if (eventNames.value.length) q.eventNames = [...eventNames.value]
    if (funnelId.value.trim()) q.funnelId = funnelId.value.trim()
    if (funnelSteps.value.length) q.funnelSteps = [...funnelSteps.value]
    if (convertedOnly.value) q.convertedOnly = true
    if (funnelId.value.trim() || funnelSteps.value.length) {
      q.windowHours = Number(windowHours.value) || 24
    }
    return q
  }

  const loadSpatial = async (opts?: { fromViewport?: boolean }): Promise<void> => {
    if (!canList.value) return
    if (!appKey.value) {
      if (!opts?.fromViewport) ElMessage.warning(t('pages.track.spatial.needApp'))
      return
    }
    loading.value = true
    if (!opts?.fromViewport) selected.value = null
    try {
      const query = buildQuery()
      if (usingMock) {
        const { buildTrackSpatialMock } = await import('../../spatial-mock')
        result.value = buildTrackSpatialMock(query)
      } else {
        const data = await fetchTrackSpatial(query)
        result.value = data as TrackSpatialResult
      }
      searched.value = true
      autoReloadEnabled.value = true
    } catch (err: any) {
      result.value = null
      searched.value = true
      if (!opts?.fromViewport) {
        const msg =
          err?.message ||
          err?.msg ||
          (err?.code === 403 || err?.status === 403
            ? t('pages.track.spatial.noPerm')
            : t('pages.track.spatial.loadFailed'))
        ElMessage.error(String(msg))
      }
    } finally {
      loading.value = false
    }
  }

  const search = (): Promise<void> => loadSpatial()

  const onViewport = (payload: TrackSpatialViewport): void => {
    const prev = viewport.value
    viewport.value = payload
    // 地图内已 300ms debounce；此处用 bbox/zoom 变化触发重拉
    if (!autoReloadEnabled.value || !searched.value) return
    if (prev.bbox === payload.bbox && prev.zoom === payload.zoom) return
    void loadSpatial({ fromViewport: true })
  }

  const onSelectPoint = (point: TrackSpatialPoint): void => {
    selected.value = point
  }

  const goReplay = (): void => {
    const j = selectedJump.value
    if (j.kind !== 'replay') return
    void router.push({
      path: '/track/replay',
      query: {
        sessionId: j.sessionId,
        ...(appKey.value ? { appKey: appKey.value } : {})
      }
    })
  }

  const goUser = (): void => {
    const j = selectedJump.value
    if (j.kind !== 'user') return
    const query: Record<string, string> = {}
    if (j.userId) query.userId = j.userId
    else if (j.distinctId) query.distinctId = j.distinctId
    else return
    if (appKey.value) query.appKey = appKey.value
    void router.push({ path: '/track/user', query })
  }
</script>

<style lang="scss" scoped>
  .track-spatial-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;

    .track-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;

      .track-app-select {
        width: 220px;
      }

      .track-event-names {
        min-width: 200px;
        max-width: 280px;
      }

      .track-funnel-id {
        width: 140px;
      }

      .track-funnel-steps {
        min-width: 160px;
        max-width: 220px;
      }

      .track-window-select {
        width: 140px;
      }
    }

    .track-mock-hint,
    .track-no-perm,
    .track-truncated {
      flex-shrink: 0;
    }

    .track-spatial-body {
      display: grid;
      flex: 1;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 12px;
      min-height: 0;
    }

    .track-spatial-map-card,
    .track-spatial-side {
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 16px;
    }

    .track-spatial-map-head {
      display: flex;
      gap: 12px;
      align-items: baseline;
      margin-bottom: 8px;
    }

    .track-spatial-card-title {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }

    .track-spatial-geo-count {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .track-spatial-map-wrap {
      flex: 1;
      min-height: 360px;
    }

    .track-spatial-kv {
      display: flex;
      gap: 8px;
      margin: 8px 0;
      font-size: 13px;

      .k {
        flex-shrink: 0;
        width: 72px;
        color: var(--el-text-color-secondary);
      }
    }

    .track-spatial-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .track-spatial-jump-hint {
      margin-top: 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 960px) {
    .track-spatial-page .track-spatial-body {
      grid-template-columns: 1fr;
    }
  }
</style>
