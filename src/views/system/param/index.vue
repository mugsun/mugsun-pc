<!-- 参数管理页面（useCrud 组合式收敛：列表+弹窗+删除+保存一体，见 hooks/core/useCrud） -->
<template>
  <div class="param-page art-full-height">
    <!-- 查询栏：条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <div class="param-toolbar">
        <ElButton v-perm="'sys:param:save'" @click="showDialog('add')" v-ripple>{{
          $t('pages.system.param.addParam')
        }}</ElButton>
        <ElButton v-perm="'sys:param:remove'" @click="deleteSelected" v-ripple>{{
          $t('pages.system.param.deleteSelectedBtn')
        }}</ElButton>
      </div>

      <ArtTable
        ref="tableRef"
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        :empty-text="emptyText"
        border
        @selection-change="onSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <ParamDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :param-data="currentRow"
        :saving="dialogSaving"
        @submit="onDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useCrud } from '@/hooks/core/useCrud'
  import { fetchParamPage, fetchSaveParam, fetchRemoveParam } from '@/api/system-manage'
  import ParamDialog from './modules/param-dialog.vue'
  import { ElButton } from 'element-plus'
  import { hasPerm } from '@/utils/permission'
  import type { ColumnOption } from '@/types/component'

  defineOptions({ name: 'SysParam' })

  const { t } = useI18n()
  const dialogSaving = ref(false)

  // ===== 查询栏 =====
  const tableRef = ref()
  const selectedRows = ref<any[]>([])
  const searchForm = ref({
    paramName: '',
    paramKey: '',
    paramValue: ''
  })
  const searchItems = computed(() => [
    {
      key: 'paramName',
      label: t('pages.system.param.fields.paramName'),
      type: 'input',
      props: { placeholder: t('pages.system.param.placeholder.paramName'), clearable: true }
    },
    {
      key: 'paramKey',
      label: t('pages.system.param.fields.paramKey'),
      type: 'input',
      props: { placeholder: t('pages.system.param.placeholder.paramKey'), clearable: true }
    },
    {
      key: 'paramValue',
      label: t('pages.system.param.fields.paramValue'),
      type: 'input',
      props: { placeholder: t('pages.system.param.placeholder.paramValue'), clearable: true }
    }
  ])
  const searched = computed(
    () =>
      !!searchForm.value.paramName || !!searchForm.value.paramKey || !!searchForm.value.paramValue
  )
  const emptyText = computed(() =>
    searched.value ? t('pages.system.param.emptySearch') : t('pages.system.param.emptyList')
  )

  const columnsFactory = (): ColumnOption[] => [
    { type: 'selection', width: 48 },
    { type: 'index', width: 60, label: t('table.column.index') },
    { prop: 'paramName', label: t('pages.system.param.fields.paramName'), minWidth: 160 },
    { prop: 'paramKey', label: t('pages.system.param.fields.paramKey'), minWidth: 180 },
    {
      prop: 'paramValue',
      label: t('pages.system.param.fields.paramValue'),
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row: any) =>
        row.sensitive ? t('pages.system.param.hiddenValue') : row.paramValue || '—'
    },
    {
      prop: 'remark',
      label: t('pages.system.param.fields.remark'),
      minWidth: 160,
      showOverflowTooltip: true
    },
    {
      prop: 'operation',
      label: t('pages.system.param.fields.operation'),
      width: 160,
      fixed: 'right',
      // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
      formatter: (row: any) =>
        h('div', [
          hasPerm('sys:param:save')
            ? h(
                ElButton,
                {
                  link: true,
                  type: 'primary',
                  size: 'small',
                  onClick: () => showDialog('edit', row)
                },
                () => t('pages.system.param.edit')
              )
            : null,
          hasPerm('sys:param:remove')
            ? h(
                ElButton,
                { link: true, type: 'danger', size: 'small', onClick: () => deleteRow(row) },
                () => t('pages.system.param.delete')
              )
            : null
        ])
    }
  ]

  // 列表+弹窗+删除+保存 全由 useCrud 收敛（删后页码自动回退复用 useTable.refreshRemove）
  const {
    columns,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    dialogVisible,
    dialogType,
    currentRow,
    showDialog,
    fetchData,
    refreshRemove,
    refreshCreate,
    refreshUpdate,
    replaceSearchParams,
    resetSearchParams
  } = useCrud({
    listApi: fetchParamPage,
    saveApi: fetchSaveParam,
    removeApi: fetchRemoveParam,
    columnsFactory,
    label: t('pages.system.param.label'),
    rowName: (row) => row.paramName
  })

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      paramName: '',
      paramKey: '',
      paramValue: ''
    }
    resetSearchParams()
    await fetchData()
  }

  const onDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveParam(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.param.saveSuccess'))
      await (dialogType.value === 'add' ? refreshCreate() : refreshUpdate())
    } finally {
      dialogSaving.value = false
    }
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.param.deleteConfirm', { name: row.paramName }),
      t('pages.system.param.label'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveParam(row.id)
      ElMessage.success(t('pages.system.param.deleteSuccess'))
      selectedRows.value = []
      tableRef.value?.elTableRef?.clearSelection()
      await refreshRemove()
    })
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.param.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.param.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.param.label'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveParam(selectedRows.value.map((row) => row.id))
      ElMessage.success(t('pages.system.param.deleteSuccess'))
      selectedRows.value = []
      tableRef.value?.elTableRef?.clearSelection()
      await refreshRemove()
    })
  }
</script>

<style scoped>
  .param-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
</style>
