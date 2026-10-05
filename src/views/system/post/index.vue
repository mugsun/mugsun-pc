<!-- 岗位管理页面 -->
<template>
  <div class="post-page art-full-height">
    <!-- 查询栏：条件实时生效、重置回默认 -->
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
          <ElButton v-perm="'sys:post:save'" @click="showDialog('add')" v-ripple>{{
            $t('pages.system.post.addPost')
          }}</ElButton>
          <ElButton v-perm="'sys:post:remove'" @click="deleteSelected" v-ripple>{{
            $t('pages.system.post.deleteSelectedBtn')
          }}</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        ref="tableRef"
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        :empty-text="emptyText"
        @selection-change="onSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <PostDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :post-data="currentData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, nextTick } from 'vue'
  import { useI18n } from 'vue-i18n'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetPostList, fetchSavePost, fetchRemovePost } from '@/api/system-manage'
  import PostDialog from './modules/post-dialog.vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { hasPerm } from '@/utils/permission'
  import { DialogType } from '@/types'

  defineOptions({ name: 'Post' })

  const { t } = useI18n()

  // ===== 查询栏 =====
  const tableRef = ref<{ elTableRef?: { clearSelection: () => void } }>()
  const selectedRows = ref<any[]>([])
  const searchForm = ref({
    postName: '',
    postCode: '',
    category: undefined as string | undefined
  })
  const categoryOptions = computed(() => [
    { label: t('pages.system.post.categoryManage'), value: 'manage' },
    { label: t('pages.system.post.categoryTech'), value: 'tech' },
    { label: t('pages.system.post.categoryBiz'), value: 'biz' }
  ])
  const searchItems = computed(() => [
    {
      key: 'postName',
      label: t('pages.system.post.fields.postName'),
      type: 'input',
      props: { placeholder: t('pages.system.post.placeholder.postName'), clearable: true }
    },
    {
      key: 'postCode',
      label: t('pages.system.post.fields.postCode'),
      type: 'input',
      props: { placeholder: t('pages.system.post.placeholder.postCode'), clearable: true }
    },
    {
      key: 'category',
      label: t('pages.system.post.fields.category'),
      type: 'select',
      props: {
        placeholder: t('pages.system.post.placeholder.category'),
        clearable: true,
        options: categoryOptions.value
      }
    }
  ])
  const searched = computed(
    () => !!searchForm.value.postName || !!searchForm.value.postCode || !!searchForm.value.category
  )
  const emptyText = computed(() =>
    searched.value ? t('pages.system.post.emptySearch') : t('pages.system.post.emptyList')
  )
  const categoryLabel = (value: string) =>
    categoryOptions.value.find((item) => item.value === value)?.label || '—'

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentData = ref<Record<string, any>>({})
  const dialogSaving = ref(false)

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
      apiFn: fetchGetPostList,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'selection', width: 48, fixed: 'left' },
        { type: 'index', width: 60, label: t('table.column.index') },
        { prop: 'postName', label: t('pages.system.post.fields.postName'), minWidth: 140 },
        { prop: 'postCode', label: t('pages.system.post.fields.postCode'), minWidth: 140 },
        {
          prop: 'category',
          label: t('pages.system.post.fields.category'),
          width: 100,
          formatter: (row: any) => categoryLabel(row.category)
        },
        { prop: 'sort', label: t('pages.system.post.fields.sort'), width: 100 },
        {
          prop: 'operation',
          label: t('pages.system.post.fields.operation'),
          width: 120,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', [
              hasPerm('sys:post:save')
                ? h(ArtButtonTable, { type: 'edit', onClick: () => showDialog('edit', row) })
                : null,
              hasPerm('sys:post:remove')
                ? h(ArtButtonTable, { type: 'delete', onClick: () => deleteRow(row) })
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

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      postName: '',
      postCode: '',
      category: undefined
    }
    resetSearchParams()
    await fetchData()
  }

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows || []
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(t('pages.system.post.deleteConfirm'), t('pages.system.post.deletePost'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }).then(async () => {
      await fetchRemovePost(row.id)
      ElMessage.success(t('pages.system.post.deleteSuccess'))
      selectedRows.value = []
      tableRef.value?.elTableRef?.clearSelection()
      refreshData()
    })
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.post.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.post.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.post.deletePost'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemovePost(selectedRows.value.map((row) => row.id))
      ElMessage.success(t('pages.system.post.deleteSuccess'))
      selectedRows.value = []
      tableRef.value?.elTableRef?.clearSelection()
      refreshData()
    })
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSavePost(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.post.saveSuccess'))
      refreshData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>
