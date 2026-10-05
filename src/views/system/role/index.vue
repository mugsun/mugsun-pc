<!-- 角色管理页面 -->
<template>
  <div class="role-page art-full-height">
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
          <ElButton v-perm="'sys:role:save'" @click="showDialog('add')" v-ripple>{{
            $t('pages.system.role.addRole')
          }}</ElButton>
          <ElButton v-perm="'sys:role:remove'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.role.deleteSelectedBtn')
          }}</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
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

      <RoleDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :role-data="currentData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />

      <RolePermissionDialog
        v-model:visible="permissionVisible"
        :role-data="currentPermRole"
        @success="refreshData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, nextTick, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchRolePage, saveRole, removeRole } from '@/api/role'
  import RoleDialog from './modules/role-dialog.vue'
  import RolePermissionDialog from './modules/role-permission-dialog.vue'
  import { ElButton, ElMessageBox, ElMessage } from 'element-plus'
  import { hasPerm } from '@/utils/permission'
  import { DialogType } from '@/types'

  defineOptions({ name: 'Role' })

  const { t } = useI18n()

  // ===== 查询栏 =====
  const searchForm = ref({
    roleName: '',
    roleCode: ''
  })
  const searchItems = [
    {
      key: 'roleName',
      label: t('pages.system.role.fields.roleName'),
      type: 'input',
      props: { placeholder: t('pages.system.role.placeholder.roleName'), clearable: true }
    },
    {
      key: 'roleCode',
      label: t('pages.system.role.fields.roleCode'),
      type: 'input',
      props: { placeholder: t('pages.system.role.placeholder.roleCode'), clearable: true }
    }
  ]

  const SCOPE_LABELS: Record<number, string> = {
    1: t('pages.system.role.scope.all'),
    2: t('pages.system.role.scope.dept'),
    3: t('pages.system.role.scope.deptAndChildren'),
    4: t('pages.system.role.scope.self'),
    5: t('pages.system.role.scope.custom')
  }

  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const emptyText = computed(() =>
    filtering.value ? t('pages.system.role.emptySearch') : t('pages.system.role.emptyList')
  )

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentData = ref<Record<string, any>>({})
  const dialogSaving = ref(false)
  const permissionVisible = ref(false)
  const currentPermRole = ref<Record<string, any>>({})

  const showPermission = (row: Record<string, any>): void => {
    currentPermRole.value = row
    permissionVisible.value = true
  }

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
      apiFn: fetchRolePage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'selection', width: 48, fixed: 'left' },
        { type: 'index', width: 60, label: t('table.column.index') },
        { prop: 'roleName', label: t('pages.system.role.fields.roleName'), minWidth: 140 },
        { prop: 'roleCode', label: t('pages.system.role.fields.roleCode'), minWidth: 140 },
        {
          prop: 'dataScope',
          label: t('pages.system.role.fields.dataScope'),
          minWidth: 140,
          formatter: (row: any) => SCOPE_LABELS[row.dataScope as number] ?? '-'
        },
        { prop: 'sort', label: t('pages.system.role.fields.sort'), width: 100 },
        {
          prop: 'operation',
          label: t('pages.system.role.fields.operation'),
          width: 180,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', [
              hasPerm('sys:role:save')
                ? h(ArtButtonTable, { type: 'edit', onClick: () => showDialog('edit', row) })
                : null,
              hasPerm('sys:role:remove')
                ? h(ArtButtonTable, { type: 'delete', onClick: () => deleteRow(row) })
                : null,
              hasPerm('sys:role:grant')
                ? h(
                    ElButton,
                    {
                      link: true,
                      type: 'primary',
                      size: 'small',
                      style: 'margin-left:8px',
                      onClick: () => showPermission(row)
                    },
                    () => t('pages.system.role.grant')
                  )
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
    filtering.value = !!(params.roleName || params.roleCode)
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    filtering.value = false
    searchForm.value = {
      roleName: '',
      roleCode: ''
    }
    resetSearchParams()
    await fetchData()
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows || []
  }

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.role.deleteConfirm', { name: row.roleName }),
      t('pages.system.role.deleteRole'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await removeRole([row.id])
        ElMessage.success(t('pages.system.role.deleteSuccess'))
        selectedRows.value = []
        refreshData()
      })
      .catch(() => {})
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.role.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.role.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.role.deleteRole'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await removeRole(selectedRows.value.map((row) => row.id))
        ElMessage.success(t('pages.system.role.deleteSuccess'))
        selectedRows.value = []
        refreshData()
      })
      .catch(() => {})
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await saveRole(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.role.saveSuccess'))
      refreshData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>
