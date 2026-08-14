<!-- 访问日志：全量请求流水（含 GET 采样），慢接口标红；参数经服务端结构化递归脱敏 -->
<template>
  <div class="api-log-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElRadioGroup v-model="slowFilter" size="small" @change="onSlowFilterChange">
            <ElRadioButton :value="undefined">{{
              $t('pages.system.apiLog.filterAll')
            }}</ElRadioButton>
            <ElRadioButton :value="1">{{ $t('pages.system.apiLog.filterSlowOnly') }}</ElRadioButton>
          </ElRadioGroup>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <ElDialog
        v-model="detailVisible"
        :title="$t('pages.system.apiLog.detailTitle')"
        width="680px"
        align-center
      >
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.traceId')">
            {{ current.traceId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.title')">
            {{ current.title }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.handler')">
            {{ current.method }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.request')">
            {{ current.requestMethod }} {{ current.requestUri }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.operator')">
            {{ current.operator || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="IP">{{ current.ip }}</ElDescriptionsItem>
          <ElDescriptionsItem label="UA">{{ current.userAgent || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.statusCode')">
            {{ current.status }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.duration')">
            {{ current.duration }} ms
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.apiLog.params')">
            <div class="api-log-params">{{ current.params }}</div>
          </ElDescriptionsItem>
          <ElDescriptionsItem
            v-if="current.errorMsg"
            :label="$t('pages.system.apiLog.errorSummary')"
          >
            <div class="api-log-params">{{ current.errorMsg }}</div>
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchApiLogPage } from '@/api/system-manage'
  import { formatTableTime } from '@/utils/date'
  import { ElRadioButton, ElRadioGroup, ElTag } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'ApiLog' })

  const { t } = useI18n()

  const detailVisible = ref(false)
  const current = ref<Record<string, any>>({})
  const slowFilter = ref<number | undefined>(undefined)

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    searchParams,
    handleSizeChange,
    handleCurrentChange,
    getData,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchApiLogPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('table.column.index') },
        {
          prop: 'title',
          label: t('pages.system.apiLog.colApi'),
          minWidth: 150,
          showOverflowTooltip: true
        },
        { prop: 'requestMethod', label: t('pages.system.apiLog.colMethod'), width: 80 },
        {
          prop: 'requestUri',
          label: t('pages.system.apiLog.colRequestUri'),
          minWidth: 200,
          showOverflowTooltip: true
        },
        { prop: 'operator', label: t('pages.system.apiLog.operator'), width: 110 },
        { prop: 'ip', label: 'IP', width: 120 },
        {
          prop: 'status',
          label: t('pages.system.apiLog.statusCode'),
          width: 90,
          formatter: (row: any) => statusTag(row.status)
        },
        {
          prop: 'duration',
          label: t('pages.system.apiLog.colDuration'),
          width: 110,
          formatter: (row: any) =>
            h('div', [
              h('span', String(row.duration ?? '-')),
              row.slow === 1
                ? h(ElTag, { type: 'danger', size: 'small', style: 'margin-left:6px' }, () =>
                    t('pages.system.apiLog.slowTag')
                  )
                : null
            ])
        },
        {
          // 与操作列右固定：窄视口下默认不横滚也能读到完整时间
          prop: 'createTime',
          label: t('pages.system.apiLog.colTime'),
          width: 170,
          fixed: 'right',
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.apiLog.colOperation'),
          width: 90,
          fixed: 'right',
          formatter: (row: any) =>
            h(ArtButtonTable, { type: 'view', onClick: () => showDetail(row) })
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

  const statusTag = (status: number) => {
    if (status == null) return h(ElTag, { type: 'info' }, () => '-')
    if (status < 400) return h(ElTag, { type: 'success' }, () => String(status))
    if (status < 500) return h(ElTag, { type: 'warning' }, () => String(status))
    return h(ElTag, { type: 'danger' }, () => String(status))
  }

  const onSlowFilterChange = (): void => {
    const params = searchParams as Record<string, unknown>
    if (slowFilter.value === undefined) {
      delete params.slow
    } else {
      params.slow = slowFilter.value
    }
    // 筛选变化回到第一页，避免停留在超出结果范围的页码而看到空表
    getData()
  }

  const showDetail = (row: Record<string, any>): void => {
    current.value = row
    detailVisible.value = true
  }
</script>

<style scoped>
  .api-log-params {
    max-height: 200px;
    overflow: auto;
    word-break: break-all;
    white-space: pre-wrap;
  }
</style>
