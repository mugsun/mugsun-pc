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
      </div>

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        border
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
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useCrud } from '@/hooks/core/useCrud'
  import { fetchParamList, fetchSaveParam, fetchRemoveParam } from '@/api/system-manage'
  import ParamDialog from './modules/param-dialog.vue'
  import { ElButton } from 'element-plus'
  import { hasPerm } from '@/utils/permission'
  import type { ColumnOption } from '@/types/component'

  defineOptions({ name: 'SysParam' })

  const { t } = useI18n()
  const dialogSaving = ref(false)

  // ===== 查询栏 =====
  const searchForm = ref({
    paramName: '',
    paramKey: ''
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
    }
  ])

  const columnsFactory = (): ColumnOption[] => [
    { type: 'index', width: 60, label: t('table.column.index') },
    { prop: 'paramName', label: t('pages.system.param.fields.paramName'), minWidth: 160 },
    { prop: 'paramKey', label: t('pages.system.param.fields.paramKey'), minWidth: 180 },
    {
      prop: 'paramValue',
      label: t('pages.system.param.fields.paramValue'),
      minWidth: 160,
      showOverflowTooltip: true
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
                { link: true, type: 'danger', size: 'small', onClick: () => handleDelete(row) },
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
    handleDelete,
    fetchData,
    refreshCreate,
    refreshUpdate,
    replaceSearchParams,
    resetSearchParams
  } = useCrud({
    listApi: fetchParamList,
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
      paramKey: ''
    }
    resetSearchParams()
    await fetchData()
  }

  const onDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveParam(form)
      dialogVisible.value = false
      ElMessage.success(t('common.saveSuccess'))
      await (dialogType.value === 'add' ? refreshCreate() : refreshUpdate())
    } finally {
      dialogSaving.value = false
    }
  }
</script>

<style scoped>
  .param-toolbar {
    margin-bottom: 12px;
  }
</style>
