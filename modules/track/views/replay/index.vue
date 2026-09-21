<!-- 会话回放（G100）：回放会话列表（开始时间/时长/页面/事件/大小/错误标/入口页/访客）+ 播放器抽屉 -->
<template>
  <div class="track-replay-page art-full-height">
    <!-- 工具栏：应用选择（看板共享选中态）+ 错误会话筛选 -->
    <div class="track-toolbar">
      <ElSelect
        v-model="appKey"
        :loading="appsLoading"
        :placeholder="$t('pages.track.shared.appPlaceholder')"
        class="track-app-select"
      >
        <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
      </ElSelect>
      <ElRadioGroup v-model="hasError">
        <ElRadioButton :value="undefined">{{ $t('pages.track.shared.all') }}</ElRadioButton>
        <ElRadioButton :value="1">{{ $t('pages.track.replay.onlyError') }}</ElRadioButton>
      </ElRadioGroup>
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

    <!-- 播放器抽屉（与错误详情共用组件） -->
    <ReplayPlayerDrawer v-model:visible="playerVisible" :session-id="currentSessionId" />
  </div>
</template>

<script setup lang="ts">
  import { h, onDeactivated, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchTrackReplayPage } from '@/api/track'
  import {
    fmtTrackDuration,
    fmtTrackSize,
    fmtTrackTime,
    useTrackApp
  } from '@/views/track/shared/useTrackApp'
  import ReplayPlayerDrawer from '@/views/track/shared/ReplayPlayerDrawer.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { hasPerm } from '@/utils/permission'
  import { ElOption, ElRadioButton, ElRadioGroup, ElSelect, ElTag } from 'element-plus'

  defineOptions({ name: 'TrackReplay' })

  const { t } = useI18n()

  const { appOptions, appKey, appsLoading } = useTrackApp()
  /** 错误会话筛选（undefined=全部） */
  const hasError = ref<number | undefined>(undefined)

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
      apiFn: fetchTrackReplayPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 首载等 appKey 就绪后手动触发，避免空 appKey 打一次无效请求
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.track.shared.index') },
        {
          prop: 'startTime',
          label: t('pages.track.replay.startTime'),
          minWidth: 150,
          formatter: (row: any) => fmtTrackTime(row.startTime)
        },
        {
          prop: 'durationMs',
          label: t('pages.track.shared.duration'),
          width: 100,
          align: 'right',
          headerAlign: 'right',
          formatter: (row: any) => fmtTrackDuration(row.durationMs)
        },
        {
          prop: 'pageCount',
          label: t('pages.track.replay.pageCount'),
          width: 90,
          align: 'right',
          headerAlign: 'right'
        },
        {
          prop: 'rrwebEvents',
          label: t('pages.track.shared.eventCount'),
          width: 90,
          align: 'right',
          headerAlign: 'right'
        },
        {
          prop: 'sizeBytes',
          label: t('pages.track.shared.size'),
          width: 100,
          align: 'right',
          headerAlign: 'right',
          formatter: (row: any) => fmtTrackSize(row.sizeBytes)
        },
        {
          prop: 'hasError',
          label: t('pages.track.replay.errorCol'),
          width: 80,
          formatter: (row: any) =>
            row.hasError === 1
              ? h(ElTag, { type: 'danger', size: 'small', effect: 'plain' }, () =>
                  t('pages.track.shared.hasError')
                )
              : h(ElTag, { type: 'info', size: 'small', effect: 'plain' }, () =>
                  t('pages.track.replay.none')
                )
        },
        {
          prop: 'entryPath',
          label: t('pages.track.replay.entryPage'),
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row: any) => row.entryPath || '-'
        },
        {
          prop: 'distinctId',
          label: t('pages.track.shared.visitor'),
          minWidth: 150,
          showOverflowTooltip: true,
          formatter: (row: any) => row.distinctId || '-'
        },
        {
          prop: 'operation',
          label: t('pages.track.shared.operation'),
          width: 90,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 按真实权限码门控
          formatter: (row: any) =>
            hasPerm('sys:track-replay:view')
              ? h(ArtButtonTable, {
                  icon: 'ri:play-circle-line',
                  iconClass: 'bg-theme/12 text-theme track-replay-play',
                  title: t('pages.track.replay.play'),
                  onClick: () => play(row)
                })
              : null
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

  const loadPage = async (): Promise<void> => {
    if (!appKey.value) return
    const params: Record<string, any> = { appKey: appKey.value, pageNum: 1, pageSize: 20 }
    if (hasError.value !== undefined) params.hasError = hasError.value
    replaceSearchParams(params)
    await fetchData()
  }

  // 应用/筛选变化即重查（首载同样在 appKey 就绪后触发）
  watch([appKey, hasError], loadPage, { immediate: true })

  // ===== 播放器抽屉 =====
  const playerVisible = ref(false)
  const currentSessionId = ref('')

  const play = (row: Record<string, any>): void => {
    currentSessionId.value = String(row.sessionId ?? '')
    playerVisible.value = true
  }

  const closeOverlays = (): void => {
    playerVisible.value = false
  }

  onDeactivated(closeOverlays)
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
</script>

<style lang="scss" scoped>
  .track-replay-page {
    .track-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;

      .track-app-select {
        width: 220px;
      }
    }
  }
</style>
