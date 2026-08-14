<!-- 操作日志页面（只读，含错误日志按状态区分） -->
<template>
  <div class="log-page art-full-height">
    <!-- 查询栏：模块/操作人/状态/时间范围，条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton
            v-perm="'sys:oper-log:verify'"
            :loading="verifyLoading"
            @click="verify"
            v-ripple
            >{{ $t('pages.system.log.verifyBtn') }}</ElButton
          >
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
        v-model="verifyVisible"
        :title="$t('pages.system.log.verifyTitle')"
        width="480px"
        align-center
      >
        <ElAlert
          :type="verifyResult.valid ? 'success' : 'error'"
          :title="verifyResult.valid ? verifyResult.message : $t('pages.system.log.tampered')"
          :closable="false"
          show-icon
        />
        <ElDescriptions v-if="!verifyResult.valid" :column="1" border class="verify-detail">
          <ElDescriptionsItem :label="$t('pages.system.log.tamperedId')">{{
            verifyResult.tamperedId
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.reason')">{{
            verifyResult.reason
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.verifiedBefore')">
            {{ $t('pages.system.log.verifiedCount', { count: verifyResult.verifiedBefore }) }}
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElDialog>

      <ElDialog
        v-model="detailVisible"
        :title="$t('pages.system.log.detailTitle')"
        width="640px"
        align-center
      >
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem :label="$t('pages.system.log.fieldTitle')">
            {{ current.title }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.fieldMethod')">
            {{ current.method }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.fieldRequest')">
            {{ current.requestMethod }} {{ current.requestUri }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.operator')">
            {{ current.operator }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="IP">{{ current.ip }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.fieldDuration')">
            {{ current.duration }} ms
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.status')">
            {{
              current.status === 1
                ? $t('pages.system.log.statusSuccess')
                : $t('pages.system.log.statusFail')
            }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.log.fieldParams')">
            <div class="log-params">{{ current.params }}</div>
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="current.errorMsg" :label="$t('pages.system.log.fieldError')">
            <div class="log-params">{{ current.errorMsg }}</div>
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchOperLogPage, fetchOperLogVerify } from '@/api/system-manage'
  import { formatTableTime } from '@/utils/date'
  import { ElMessage, ElTag } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'OperLog' })

  const { t } = useI18n()

  const detailVisible = ref(false)
  const current = ref<Record<string, any>>({})
  const verifyVisible = ref(false)
  const verifyLoading = ref(false)
  const verifyResult = ref<Record<string, any>>({})

  // ===== 查询栏 =====
  const searchForm = ref({
    title: '',
    operator: '',
    status: undefined as number | undefined,
    timeRange: undefined as string[] | undefined
  })
  const searchItems = computed(() => [
    {
      key: 'title',
      label: t('pages.system.log.searchModule'),
      type: 'input',
      props: { placeholder: t('pages.system.log.searchModulePlaceholder'), clearable: true }
    },
    {
      key: 'operator',
      label: t('pages.system.log.operator'),
      type: 'input',
      props: { placeholder: t('pages.system.log.searchOperatorPlaceholder'), clearable: true }
    },
    {
      key: 'status',
      label: t('pages.system.log.status'),
      type: 'select',
      props: {
        placeholder: t('pages.system.log.searchStatusPlaceholder'),
        clearable: true,
        options: [
          { label: t('pages.system.log.statusSuccess'), value: 1 },
          { label: t('pages.system.log.statusFail'), value: 0 }
        ]
      }
    },
    {
      key: 'timeRange',
      label: t('pages.system.log.searchTimeRange'),
      type: 'datetimerange',
      span: 8,
      props: {
        type: 'datetimerange',
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
        startPlaceholder: t('pages.system.log.startTime'),
        endPlaceholder: t('pages.system.log.endTime'),
        clearable: true
      }
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
      apiFn: fetchOperLogPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('table.column.index') },
        { prop: 'title', label: t('pages.system.log.colOperation'), minWidth: 140 },
        { prop: 'requestMethod', label: t('pages.system.log.colRequestMethod'), width: 100 },
        {
          prop: 'requestUri',
          label: t('pages.system.log.colRequestUri'),
          minWidth: 200,
          showOverflowTooltip: true
        },
        {
          prop: 'operator',
          label: t('pages.system.log.operator'),
          width: 120,
          // 后端富化 operatorName（昵称/用户名），历史/已删用户回退原 id
          formatter: (row: any) => row.operatorName || row.operator || '—'
        },
        { prop: 'duration', label: t('pages.system.log.colDuration'), width: 100 },
        {
          prop: 'status',
          label: t('pages.system.log.status'),
          width: 90,
          formatter: (row: any) =>
            row.status === 1
              ? h(ElTag, { type: 'success' }, () => t('pages.system.log.statusSuccess'))
              : h(ElTag, { type: 'danger' }, () => t('pages.system.log.statusFail'))
        },
        {
          // 与操作列右固定：窄视口默认可见完整时间
          prop: 'createTime',
          label: t('pages.system.log.colTime'),
          width: 170,
          fixed: 'right',
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.log.colOperation'),
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

  const showDetail = (row: Record<string, any>): void => {
    current.value = row
    detailVisible.value = true
  }

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    // 时间范围数组展开为 beginTime/endTime（后端 create_time 区间），其余条件原样透传
    const { timeRange, ...rest } = params
    const query: Record<string, any> = { ...rest, pageNum: 1, pageSize: 20 }
    if (Array.isArray(timeRange) && timeRange.length === 2) {
      query.beginTime = timeRange[0]
      query.endTime = timeRange[1]
    }
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams(query)
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      title: '',
      operator: '',
      status: undefined,
      timeRange: undefined
    }
    resetSearchParams()
    await fetchData()
  }

  /** 审计完整性验签：全量校验（不传 limit），检出篡改精确定位首个被篡改记录 */
  const verify = async (): Promise<void> => {
    verifyLoading.value = true
    try {
      verifyResult.value = (await fetchOperLogVerify()) ?? {}
      verifyVisible.value = true
      if (verifyResult.value.valid) {
        ElMessage.success(verifyResult.value.message || t('pages.system.log.verifyChainOk'))
      }
    } finally {
      verifyLoading.value = false
    }
  }
</script>

<style scoped>
  .log-params {
    max-height: 200px;
    overflow: auto;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .verify-detail {
    margin-top: 12px;
  }
</style>
