<!-- 错误日志：全局未捕获异常流水，栈顶四元组定位 + 认领处理闭环（已处理/已忽略） -->
<template>
  <div class="error-log-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElRadioGroup v-model="statusFilter" size="small" @change="onStatusFilterChange">
            <ElRadioButton :value="undefined">{{
              $t('pages.system.errorLog.filterAll')
            }}</ElRadioButton>
            <ElRadioButton :value="0">{{
              $t('pages.system.errorLog.statusPending')
            }}</ElRadioButton>
            <ElRadioButton :value="1">{{
              $t('pages.system.errorLog.statusHandled')
            }}</ElRadioButton>
            <ElRadioButton :value="2">{{
              $t('pages.system.errorLog.statusIgnored')
            }}</ElRadioButton>
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
        :title="$t('pages.system.errorLog.detailTitle')"
        width="720px"
        align-center
        destroy-on-close
      >
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.traceId')">
            {{ current.traceId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.exceptionClass')">
            {{ current.exceptionClass }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.message')">
            {{ current.message }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.request')">
            {{ current.requestMethod }} {{ current.requestUri }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.operator')">
            {{ current.operator || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.location')">
            {{ current.locationClass }}.{{ current.locationMethod }}({{ current.locationFile }}:{{
              current.locationLine
            }})
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.errorLog.stacktrace')">
            <div class="error-log-stack">{{ current.stacktrace }}</div>
          </ElDescriptionsItem>
          <ElDescriptionsItem
            v-if="current.handleUser"
            :label="$t('pages.system.errorLog.handleInfo')"
          >
            {{
              $t('pages.system.errorLog.handleDetail', {
                user: current.handleUser,
                time: current.handleTime,
                note: current.handleNote || '-'
              })
            }}
          </ElDescriptionsItem>
        </ElDescriptions>
      </ElDialog>

      <ElDialog
        v-model="handleVisible"
        :title="$t('pages.system.errorLog.handleTitle')"
        width="480px"
        align-center
        destroy-on-close
      >
        <ElForm label-width="80px">
          <ElFormItem :label="$t('pages.system.errorLog.handleStatus')">
            <ElRadioGroup v-model="handleForm.status">
              <ElRadio :value="1">{{ $t('pages.system.errorLog.statusHandled') }}</ElRadio>
              <ElRadio :value="2">{{ $t('pages.system.errorLog.statusIgnored') }}</ElRadio>
            </ElRadioGroup>
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.errorLog.handleNote')">
            <ElInput
              v-model="handleForm.note"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              :placeholder="$t('pages.system.errorLog.handleNotePlaceholder')"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="handleVisible = false">{{ $t('common.cancel') }}</ElButton>
          <ElButton type="primary" :loading="handleLoading" @click="submitHandle">{{
            $t('common.confirm')
          }}</ElButton>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, onDeactivated, reactive, ref } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictTag from '@/components/core/base/art-dict-tag/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchErrorLogPage, fetchHandleErrorLog, fetchRemoveErrorLog } from '@/api/system-manage'
  import { formatTableTime } from '@/utils/date'
  import { hasPerm } from '@/utils/permission'
  import { DICT_CODE } from '@/utils/constants'
  import { ElMessage, ElMessageBox, ElRadio, ElRadioButton, ElRadioGroup } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'ErrorLog' })

  const { t } = useI18n()

  const detailVisible = ref(false)
  const current = ref<Record<string, any>>({})
  const statusFilter = ref<number | undefined>(undefined)

  const handleVisible = ref(false)
  const handleLoading = ref(false)
  const handleForm = reactive({ id: '' as string | number, status: 1, note: '' })

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
    refreshData,
    refreshUpdate,
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchErrorLogPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('table.column.index') },
        {
          prop: 'exceptionClass',
          label: t('pages.system.errorLog.colException'),
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: any) => shortClass(row.exceptionClass)
        },
        {
          prop: 'requestUri',
          label: t('pages.system.errorLog.colRequestUri'),
          minWidth: 180,
          showOverflowTooltip: true
        },
        {
          prop: 'message',
          label: t('pages.system.errorLog.message'),
          minWidth: 200,
          showOverflowTooltip: true
        },
        { prop: 'operator', label: t('pages.system.errorLog.operator'), width: 100 },
        {
          prop: 'status',
          label: t('pages.system.errorLog.colStatus'),
          width: 90,
          // 字典运行时驱动：改用 ArtDictTag，不再手写 STATUS_META
          formatter: (row: any) =>
            h(ArtDictTag, { code: DICT_CODE.ERROR_LOG_STATUS, value: row.status })
        },
        {
          prop: 'createTime',
          label: t('pages.system.errorLog.colTime'),
          minWidth: 170,
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.errorLog.colOperation'),
          width: 190,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', [
              h(ArtButtonTable, { type: 'view', onClick: () => showDetail(row) }),
              hasPerm('sys:error-log:handle') && row.status === 0
                ? h(ArtButtonTable, { type: 'edit', onClick: () => showHandle(row) })
                : null,
              hasPerm('sys:error-log:remove')
                ? h(ArtButtonTable, { type: 'delete', onClick: () => removeRow(row) })
                : null
            ])
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

  const shortClass = (cls: string): string => (cls ? cls.substring(cls.lastIndexOf('.') + 1) : '-')

  const onStatusFilterChange = (): void => {
    const params = searchParams as Record<string, unknown>
    if (statusFilter.value === undefined) {
      delete params.status
    } else {
      params.status = statusFilter.value
    }
    // 筛选变化回到第一页，避免停留在超出结果范围的页码而看到空表
    getData()
  }

  const closeDialogs = (): void => {
    detailVisible.value = false
    handleVisible.value = false
    current.value = {}
  }

  const showDetail = (row: Record<string, any>): void => {
    handleVisible.value = false
    current.value = row
    detailVisible.value = true
  }

  const showHandle = (row: Record<string, any>): void => {
    detailVisible.value = false
    handleForm.id = row.id
    handleForm.status = 1
    handleForm.note = ''
    handleVisible.value = true
  }

  const submitHandle = async (): Promise<void> => {
    handleLoading.value = true
    try {
      await fetchHandleErrorLog({
        id: handleForm.id,
        status: handleForm.status,
        note: handleForm.note
      })
      ElMessage.success(t('pages.system.errorLog.handleSuccess'))
      handleVisible.value = false
      refreshUpdate()
    } finally {
      handleLoading.value = false
    }
  }

  const removeRow = (row: Record<string, any>): void => {
    ElMessageBox.confirm(
      t('pages.system.errorLog.removeConfirm'),
      t('pages.system.errorLog.removeTitle'),
      { type: 'warning' }
    )
      .then(async () => {
        await fetchRemoveErrorLog(row.id)
        ElMessage.success(t('pages.system.errorLog.removed'))
        refreshRemove()
      })
      .catch(() => {})
  }

  onDeactivated(() => {
    ElMessageBox.close()
    closeDialogs()
  })
</script>

<style scoped>
  .error-log-stack {
    max-height: 240px;
    overflow: auto;
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
    white-space: pre-wrap;
  }
</style>
