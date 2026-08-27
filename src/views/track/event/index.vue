<!-- 事件分析：事件名筛选 + 次数/会话/UV/最近发生 + 抽屉趋势图 + 实时事件流（5s 轮询可暂停） -->
<template>
  <div class="track-event-page art-full-height">
    <!-- 工具栏：应用选择（5 页共享选中态）+ 统计天数 + 事件名筛选 -->
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
      <ElInput
        v-model="eventName"
        :placeholder="$t('pages.track.shared.eventFilterPlaceholder')"
        clearable
        class="track-event-input"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <ElButton :loading="loading" @click="handleSearch" v-ripple>{{
        $t('pages.track.shared.search')
      }}</ElButton>
    </div>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>
    </ElCard>

    <!-- 实时事件流 -->
    <ElCard class="art-table-card track-realtime-card">
      <div class="track-realtime-head">
        <span class="track-card-title">{{ $t('pages.track.event.realtimeStream') }}</span>
        <div class="track-realtime-ops">
          <ElTag :type="paused ? 'info' : 'success'" size="small">
            {{ paused ? $t('pages.track.event.paused') : $t('pages.track.event.live') }}
          </ElTag>
          <ElButton size="small" @click="togglePause">{{
            paused ? $t('pages.track.event.resume') : $t('pages.track.event.pause')
          }}</ElButton>
        </div>
      </div>
      <ElTable :data="realtimeList" v-loading="realtimeLoading && !realtimeLoaded" max-height="320">
        <ElTableColumn :label="$t('pages.track.shared.time')" width="110">
          <template #default="{ row }">{{ fmtTrackClock(row.ts) }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="eventName"
          :label="$t('pages.track.event.eventCol')"
          min-width="160"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="distinctId"
          :label="$t('pages.track.shared.visitor')"
          min-width="140"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('pages.track.shared.session')" min-width="140">
          <template #default="{ row }">
            <span :title="row.sessionId">{{ shortId(row.sessionId) }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="urlPath"
          :label="$t('pages.track.shared.page')"
          min-width="180"
          show-overflow-tooltip
        />
        <template #empty
          ><ElEmpty :description="$t('pages.track.event.noRealtimeEvents')" :image-size="60"
        /></template>
      </ElTable>
    </ElCard>

    <!-- 事件趋势抽屉 -->
    <ElDrawer
      v-model="trendVisible"
      :title="$t('pages.track.event.trendTitle', { name: trendEventName })"
      size="560px"
      destroy-on-close
    >
      <ArtLineChart
        :data="trendSeries"
        :x-axis-data="trendLabels"
        :loading="trendLoading"
        height="320px"
        show-legend
        show-area-color
        :symbol="trendLabels.length <= 1 ? 'circle' : 'none'"
      />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { h, onActivated, onDeactivated, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchTrackEventPage, fetchTrackEventRealtime, fetchTrackTrend } from '@/api/track'
  import { fmtTrackClock, fmtTrackTime, useTrackApp } from '@/views/track/shared/useTrackApp'
  import type { LineDataItem } from '@/types/component/chart'
  import {
    ElButton,
    ElInput,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElSelect,
    ElTag
  } from 'element-plus'

  defineOptions({ name: 'TrackEvent' })

  const { t } = useI18n()

  const { appOptions, appKey, days, appsLoading } = useTrackApp()
  const eventName = ref('')

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    fetchData,
    replaceSearchParams
  } = useTable({
    core: {
      apiFn: fetchTrackEventPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 首载等 appKey 就绪后手动触发，避免空 appKey 打一次无效请求
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.track.shared.index') },
        {
          prop: 'eventName',
          label: t('pages.track.shared.eventName'),
          minWidth: 180,
          showOverflowTooltip: true
        },
        {
          prop: 'eventCount',
          label: t('pages.track.shared.count'),
          width: 110,
          align: 'right',
          headerAlign: 'right'
        },
        {
          prop: 'sessionCount',
          label: t('pages.track.shared.sessionCount'),
          width: 110,
          align: 'right',
          headerAlign: 'right'
        },
        { prop: 'uv', label: 'UV', width: 100, align: 'right', headerAlign: 'right' },
        {
          prop: 'lastTime',
          label: t('pages.track.shared.lastSeen'),
          minWidth: 170,
          formatter: (row: any) => fmtTrackTime(row.lastTime)
        },
        {
          prop: 'operation',
          label: t('pages.track.shared.operation'),
          width: 80,
          fixed: 'right',
          formatter: (row: any) =>
            h(ArtButtonTable, { type: 'view', onClick: () => showTrend(row) })
        }
      ]
    },
    transform: {
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 20
      })
    }
  })

  const buildParams = (): Record<string, any> => {
    const params: Record<string, any> = {
      appKey: appKey.value,
      days: days.value,
      pageNum: 1,
      pageSize: 20
    }
    if (eventName.value) params.eventName = eventName.value
    return params
  }

  const handleSearch = async (): Promise<void> => {
    if (!appKey.value) return
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams(buildParams())
    await fetchData()
  }

  // 应用/天数变化即重查（首载同样在 appKey 就绪后触发）
  watch([appKey, days], handleSearch, { immediate: true })

  // ===== 事件趋势抽屉（days≤2 小时粒度 time=epochMs；days>2 天粒度 date） =====
  const trendVisible = ref(false)
  const trendEventName = ref('')
  const trendLoading = ref(false)
  const trendLabels = ref<string[]>([])
  const trendSeries = ref<LineDataItem[]>([])

  const showTrend = async (row: Record<string, any>): Promise<void> => {
    trendEventName.value = row.eventName
    trendVisible.value = true
    trendLoading.value = true
    try {
      const rows =
        (await fetchTrackTrend({
          appKey: appKey.value,
          days: days.value,
          dimType: 'event',
          dimKey: row.eventName
        })) ?? []
      const byDay = rows.some((r: any) => r.date !== undefined)
      trendLabels.value = rows.map((r: any) =>
        byDay ? String(r.date).slice(5) : fmtTrackClock(r.time)
      )
      trendSeries.value = [
        {
          name: t('pages.track.shared.count'),
          data: rows.map((r: any) => Number(r.eventCount ?? 0)),
          showAreaColor: true
        },
        {
          name: t('pages.track.shared.sessionCount'),
          data: rows.map((r: any) => Number(r.sessionCount ?? 0))
        }
      ]
    } finally {
      trendLoading.value = false
    }
  }

  // ===== 实时事件流（5s 轮询，可暂停） =====
  const realtimeList = ref<any[]>([])
  const realtimeLoading = ref(false)
  const realtimeLoaded = ref(false)
  const paused = ref(false)

  const loadRealtime = async (): Promise<void> => {
    if (!appKey.value) return
    realtimeLoading.value = true
    try {
      realtimeList.value =
        (await fetchTrackEventRealtime({ appKey: appKey.value, limit: 20 })) ?? []
      realtimeLoaded.value = true
    } finally {
      realtimeLoading.value = false
    }
  }

  const { pause, resume } = useIntervalFn(loadRealtime, 5000)

  const togglePause = (): void => {
    paused.value = !paused.value
    if (paused.value) {
      pause()
    } else {
      loadRealtime()
      resume()
    }
  }

  const shortId = (id?: string): string => (id ? `${id.slice(0, 8)}…` : '-')

  const closeOverlays = (): void => {
    trendVisible.value = false
  }

  // keepAlive 页面切走暂停轮询，切回且未手动暂停时恢复并立即拉一次
  onDeactivated(() => {
    pause()
    closeOverlays()
  })
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
  onActivated(() => {
    if (!paused.value) {
      loadRealtime()
      resume()
    }
  })

  watch(appKey, loadRealtime, { immediate: true })
</script>

<style lang="scss" scoped>
  .track-event-page {
    // 双卡均为 flex:1 会互挤：视口偏矮时实时流卡片（表头 24 + 表 320 + 内边距）
    // 超出分得高度，被全局 .art-table-card .el-card__body 的 overflow:hidden 把表尾横向切断。
    // 改为卡片自然高度 + 页面级纵向滚动
    overflow-y: auto;

    .art-table-card {
      flex: none;
    }

    .track-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;

      .track-app-select {
        width: 220px;
      }

      .track-event-input {
        width: 240px;
      }
    }

    .track-card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .track-realtime-card {
      margin-top: 16px;

      .track-realtime-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .track-realtime-ops {
        display: flex;
        gap: 8px;
        align-items: center;
      }
    }
  }
</style>
