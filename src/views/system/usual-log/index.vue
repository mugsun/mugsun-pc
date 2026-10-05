<!-- 通用日志：按级别和业务编号查看业务流水 -->
<template>
  <div class="usual-log-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />
      <ElAlert
        v-if="!loading && (data as any[]).length === 0"
        class="usual-log-empty"
        type="info"
        :closable="false"
        :title="$t('pages.system.usualLog.empty')"
      />
      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        border
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog
      v-model="detailVisible"
      :title="$t('pages.system.usualLog.detailTitle')"
      width="520px"
      align-center
    >
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.level')">{{
          levelLabel(detail.logLevel)
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.logId')">{{
          detail.logId || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.data')">{{
          detail.logData || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.method')">{{
          detail.method || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.uri')">{{
          detail.requestUri || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="IP">{{ detail.remoteIp || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.time')">{{
          formatTableTime(detail.createTime)
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.usualLog.userAgent')">{{
          detail.userAgent || $t('pages.system.usualLog.userAgentEmpty')
        }}</ElDescriptionsItem>
      </ElDescriptions>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, ref } from 'vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchUsualLogDetail, fetchUsualLogPage } from '@/api/system-manage'
  import { ElButton } from 'element-plus'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'UsualLog' })

  const { t } = useI18n()
  const detailVisible = ref(false)
  const detail = ref<any>(null)

  function levelLabel(value?: string) {
    if (value === 'info') return t('pages.system.usualLog.info')
    if (value === 'debug') return t('pages.system.usualLog.debug')
    if (value === 'warn') return t('pages.system.usualLog.warn')
    if (value === 'error') return t('pages.system.usualLog.error')
    return value || '—'
  }

  async function openDetail(row: any) {
    detail.value = await fetchUsualLogDetail(row.id)
    detailVisible.value = true
  }

  const searchForm = ref({
    level: '',
    logId: '',
    uri: ''
  })
  const searchItems = computed(() => [
    {
      key: 'level',
      label: t('pages.system.usualLog.level'),
      type: 'select',
      props: {
        placeholder: t('pages.system.usualLog.levelAll'),
        clearable: true,
        options: [
          { label: t('pages.system.usualLog.info'), value: 'info' },
          { label: t('pages.system.usualLog.debug'), value: 'debug' },
          { label: t('pages.system.usualLog.warn'), value: 'warn' },
          { label: t('pages.system.usualLog.error'), value: 'error' }
        ]
      }
    },
    {
      key: 'logId',
      label: t('pages.system.usualLog.logId'),
      type: 'input',
      props: { placeholder: t('pages.system.usualLog.logIdPlaceholder'), clearable: true }
    },
    {
      key: 'uri',
      label: t('pages.system.usualLog.uri'),
      type: 'input',
      props: { placeholder: t('pages.system.usualLog.uriPlaceholder'), clearable: true }
    }
  ])

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
    replaceSearchParams,
    resetSearchParams
  } = useTable({
    core: {
      apiFn: fetchUsualLogPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('table.column.index') },
        {
          prop: 'logLevel',
          label: t('pages.system.usualLog.level'),
          width: 80,
          formatter: (row: any) => levelLabel(row.logLevel)
        },
        {
          prop: 'logId',
          label: t('pages.system.usualLog.logId'),
          minWidth: 120,
          showOverflowTooltip: true
        },
        {
          prop: 'logData',
          label: t('pages.system.usualLog.data'),
          minWidth: 180,
          showOverflowTooltip: true
        },
        {
          prop: 'method',
          label: t('pages.system.usualLog.method'),
          width: 72
        },
        {
          prop: 'requestUri',
          label: t('pages.system.usualLog.uri'),
          minWidth: 140,
          showOverflowTooltip: true
        },
        { prop: 'remoteIp', label: 'IP', minWidth: 110, showOverflowTooltip: true },
        {
          prop: 'createTime',
          label: t('pages.system.usualLog.time'),
          width: 168,
          fixed: 'right',
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('table.column.operation'),
          width: 72,
          fixed: 'right',
          formatter: (row: any) =>
            h(
              ElButton,
              { link: true, type: 'primary', size: 'small', onClick: () => openDetail(row) },
              () => t('pages.system.usualLog.detail')
            )
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

  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = { level: '', logId: '', uri: '' }
    resetSearchParams()
    await fetchData()
  }
</script>

<style scoped>
  .usual-log-empty {
    margin-bottom: 8px;
  }
</style>
