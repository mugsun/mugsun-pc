<!-- 部门管理页面（树形 CRUD） -->
<template>
  <div class="dept-page art-full-height">
    <!-- 查询栏：按名称过滤（命中节点及其祖先保留），重置回全树 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <div class="dept-toolbar">
        <ElButton v-perm="'sys:dept:save'" @click="showDialog('add')" v-ripple>{{
          $t('pages.system.dept.addDept')
        }}</ElButton>
        <ElButton v-perm="'sys:dept:remove'" @click="deleteSelected" v-ripple>{{
          $t('pages.system.dept.deleteSelectedBtn')
        }}</ElButton>
      </div>

      <!-- 树表为自由增长内容：art-table-card 卡片体是 height:100%+overflow:hidden 裁剪，
           内部须自备滚动，否则矮视口下深层节点被切断且不可达（同 track/user 修法） -->
      <div v-loading="loading" class="dept-table-wrap">
        <ElTable
          ref="tableRef"
          :data="treeData"
          row-key="id"
          default-expand-all
          border
          :empty-text="emptyText"
          @selection-change="onSelectionChange"
        >
          <ElTableColumn type="selection" width="48" />
          <ElTableColumn
            prop="deptName"
            :label="$t('pages.system.dept.fields.deptName')"
            min-width="180"
          />
          <ElTableColumn
            prop="fullName"
            :label="$t('pages.system.dept.fields.fullName')"
            min-width="160"
          />
          <ElTableColumn :label="$t('pages.system.dept.fields.category')" width="100">
            <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.dept.fields.leader')" min-width="120">
            <template #default="{ row }">{{ row.leaderName || '—' }}</template>
          </ElTableColumn>
          <ElTableColumn prop="sort" :label="$t('pages.system.dept.fields.sort')" width="80" />
          <ElTableColumn
            prop="createTime"
            :label="$t('pages.system.dept.fields.createTime')"
            min-width="180"
          >
            <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.dept.fields.operation')" width="240">
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:dept:save'"
                link
                type="primary"
                @click="showDialog('add', row)"
                >{{ $t('pages.system.dept.addChild') }}</ElButton
              >
              <ElButton
                v-perm="'sys:dept:save'"
                link
                type="primary"
                @click="showDialog('edit', row)"
                >{{ $t('pages.system.dept.edit') }}</ElButton
              >
              <ElButton v-perm="'sys:dept:remove'" link type="danger" @click="deleteRow(row)">{{
                $t('pages.system.dept.delete')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <DeptDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :dept-data="currentData"
        :dept-options="deptOptions"
        :leader-options="leaderOptions"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import {
    fetchDeptTree,
    fetchDeptSelect,
    fetchDeptLeaders,
    fetchSaveDept,
    fetchRemoveDept
  } from '@/api/system-manage'
  import DeptDialog from './modules/dept-dialog.vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'
  import { formatTableTime } from '@/utils/date'

  defineOptions({ name: 'Dept' })

  const { t } = useI18n()

  // ===== 查询栏 =====
  const tableRef = ref()
  const selectedRows = ref<any[]>([])
  const searchForm = ref({
    deptName: '',
    fullName: ''
  })
  const categoryOptions = computed(() => [
    { label: t('pages.system.dept.categoryCompany'), value: 'company' },
    { label: t('pages.system.dept.categoryDept'), value: 'dept' },
    { label: t('pages.system.dept.categoryTeam'), value: 'team' }
  ])
  const searchItems = computed(() => [
    {
      key: 'deptName',
      label: t('pages.system.dept.fields.deptName'),
      type: 'input',
      props: { placeholder: t('pages.system.dept.placeholder.deptName'), clearable: true }
    },
    {
      key: 'fullName',
      label: t('pages.system.dept.fields.fullName'),
      type: 'input',
      props: { placeholder: t('pages.system.dept.placeholder.fullName'), clearable: true }
    }
  ])
  const searched = computed(() => !!searchForm.value.deptName || !!searchForm.value.fullName)
  const emptyText = computed(() =>
    searched.value ? t('pages.system.dept.emptySearch') : t('pages.system.dept.emptyList')
  )
  const categoryLabel = (value: string) =>
    categoryOptions.value.find((item) => item.value === value)?.label || '—'

  const treeData = ref<any[]>([])
  const deptOptions = ref<Array<{ label: string; value: string }>>([])
  const leaderOptions = ref<Array<{ label: string; value: string }>>([])
  const loading = ref(false)
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentData = ref<Record<string, any>>({})
  const dialogSaving = ref(false)

  // 查询条件以 searchForm 为唯一事实源（v-model 已同步），CRUD 刷新后过滤仍生效
  const currentParams = (): Record<string, any> | undefined => {
    const params: Record<string, any> = {}
    if (searchForm.value.deptName) params.deptName = searchForm.value.deptName
    if (searchForm.value.fullName) params.fullName = searchForm.value.fullName
    return Object.keys(params).length ? params : undefined
  }

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      treeData.value = (await fetchDeptTree(currentParams())) || []
      deptOptions.value = (await fetchDeptSelect()) || []
      leaderOptions.value = (await fetchDeptLeaders().catch(() => [])) || []
      selectedRows.value = []
      tableRef.value?.clearSelection?.()
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  // ===== 查询栏联动 =====
  const handleSearch = async (): Promise<void> => {
    // 后端过滤命中节点及其祖先后重新建树
    await loadData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      deptName: '',
      fullName: ''
    }
    await loadData()
  }

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = type === 'add' ? { parentId: row?.id ?? 0 } : { ...row }
    dialogVisible.value = true
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(t('pages.system.dept.deleteConfirm'), t('pages.system.dept.deleteDept'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }).then(async () => {
      await fetchRemoveDept(row.id)
      ElMessage.success(t('pages.system.dept.deleteSuccess'))
      loadData()
    })
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.dept.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.dept.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.dept.deleteDept'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveDept(selectedRows.value.map((row) => row.id))
      ElMessage.success(t('pages.system.dept.deleteSuccess'))
      loadData()
    })
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveDept(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.dept.saveSuccess'))
      loadData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>

<style scoped>
  /* 卡片体改为纵向 flex，树表滚动区占满剩余高度（滚动区见模板注释） */
  .dept-page :deep(.art-table-card > .el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .dept-toolbar {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    margin-bottom: 12px;
  }

  .dept-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
