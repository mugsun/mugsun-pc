<!-- 用户管理页面 -->
<template>
  <div class="user-page art-full-height">
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
          <ElButton v-perm="'sys:user:add'" @click="showDialog('add')" v-ripple>{{
            $t('pages.system.user.addUser')
          }}</ElButton>
          <ElButton v-perm="'sys:user:remove'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.user.deleteSelected')
          }}</ElButton>
          <ElButton :loading="exporting" @click="handleExport" v-ripple>{{
            $t('pages.system.user.export')
          }}</ElButton>
          <ElButton v-perm="'sys:user:add'" @click="importVisible = true" v-ripple>{{
            $t('pages.system.user.import')
          }}</ElButton>
          <ElButton @click="handleResetColumns" v-ripple>{{
            $t('pages.system.user.resetColumns')
          }}</ElButton>
          <ElButton v-perm="'sys:user:edit'" @click="openLocks" v-ripple>{{
            $t('pages.system.user.lockList')
          }}</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :error-message="error?.message"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        :empty-text="emptyText"
        border
        @selection-change="onSelectionChange"
        @header-dragend="onHeaderDragend"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />

      <UserRoleDialog v-model:visible="userRoleVisible" :user-data="currentRoleUser" />

      <UserImportDialog v-model:visible="importVisible" @success="refreshData" />

      <ElDialog v-model="lockVisible" :title="$t('pages.system.user.lockTitle')" width="440px">
        <ElForm label-width="88px">
          <ElFormItem :label="$t('pages.system.user.fields.username')">
            <ElInput :model-value="lockForm.username" disabled />
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.user.lockReason')">
            <ElInput
              v-model="lockForm.reason"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              :placeholder="$t('pages.system.user.lockReasonPlaceholder')"
            />
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.user.lockMinutes')">
            <ElInputNumber
              v-model="lockForm.minutes"
              :min="1"
              :max="43200"
              :placeholder="$t('pages.system.user.lockMinutesPlaceholder')"
              controls-position="right"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="lockVisible = false">{{ $t('common.cancel') }}</ElButton>
          <ElButton type="primary" :loading="lockSaving" @click="submitLock">{{
            $t('common.confirm')
          }}</ElButton>
        </template>
      </ElDialog>

      <ElDrawer v-model="locksVisible" :title="$t('pages.system.user.lockList')" size="520px">
        <ElTable :data="lockRows" border>
          <ElTableColumn
            prop="username"
            :label="$t('pages.system.user.fields.username')"
            width="140"
          />
          <ElTableColumn
            prop="reason"
            :label="$t('pages.system.user.lockReason')"
            min-width="160"
          />
          <ElTableColumn :label="$t('pages.system.user.lockRemain')" width="120">
            <template #default="{ row }">
              {{ row.permanent ? $t('pages.system.user.lockUntilUnlock') : row.remainMinutes }}
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.user.fields.operation')" width="80">
            <template #default="{ row }">
              <ElButton link type="primary" @click="unlockRow(row)">{{
                $t('pages.system.user.unlock')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </ElDrawer>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, nextTick } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictTag from '@/components/core/base/art-dict-tag/index.vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useTableColumnPersist } from '@/hooks/core/useTableColumnPersist'
  import {
    fetchUserPage,
    saveUser,
    removeUser,
    exportUser,
    resetUserPassword,
    setUserLeader,
    lockUser,
    unlockUser,
    fetchUserLocks
  } from '@/api/user'
  import { fetchDeptOptions } from '@/api/system-manage'
  import UserDialog from './modules/user-dialog.vue'
  import UserRoleDialog from './modules/user-role-dialog.vue'
  import UserImportDialog from './modules/user-import-dialog.vue'
  import { ElButton, ElMessageBox, ElMessage } from 'element-plus'
  import { DICT_CODE } from '@/utils/constants'
  import { hasPerm } from '@/utils/permission'
  import { useUserStore } from '@/store/modules/user'
  import { formatTableTime } from '@/utils/date'
  import { DialogType } from '@/types'
  import type { ColumnOption } from '@/types/component'

  defineOptions({ name: 'User' })

  const { t } = useI18n()
  const router = useRouter()
  const userStore = useUserStore()
  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const emptyText = computed(() =>
    filtering.value ? t('pages.system.user.emptySearch') : t('pages.system.user.emptyList')
  )
  const selfId = computed(() => String(userStore.getUserInfo?.userId ?? ''))

  // ===== 查询栏 =====
  const searchForm = ref({
    username: '',
    nickname: '',
    phone: '',
    status: undefined as number | undefined,
    deptId: undefined as number | undefined
  })
  const deptTreeData = ref<any[]>([])
  const searchItems = computed(() => [
    {
      key: 'username',
      label: t('pages.system.user.fields.username'),
      type: 'input',
      props: { placeholder: t('pages.system.user.placeholder.username'), clearable: true }
    },
    {
      key: 'nickname',
      label: t('pages.system.user.fields.nickname'),
      type: 'input',
      props: { placeholder: t('pages.system.user.placeholder.nickname'), clearable: true }
    },
    {
      key: 'phone',
      label: t('pages.system.user.fields.phone'),
      type: 'input',
      props: { placeholder: t('pages.system.user.placeholder.phone'), clearable: true }
    },
    {
      key: 'status',
      label: t('pages.system.user.fields.status'),
      type: 'select',
      props: {
        placeholder: t('pages.system.user.placeholder.status'),
        clearable: true,
        options: [
          { label: t('pages.system.user.status.enabled'), value: 1 },
          { label: t('pages.system.user.status.disabled'), value: 0 }
        ]
      }
    },
    {
      key: 'deptId',
      label: t('pages.system.user.fields.dept'),
      type: 'treeselect',
      props: {
        data: deptTreeData.value,
        props: { value: 'id', label: 'deptName', children: 'children' },
        checkStrictly: true,
        clearable: true,
        placeholder: t('pages.system.user.placeholder.dept')
      }
    }
  ])

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Record<string, any>>({})
  const dialogSaving = ref(false)
  const importVisible = ref(false)
  const userRoleVisible = ref(false)
  const currentRoleUser = ref<Record<string, any>>({})

  const showUserRole = (row: Record<string, any>): void => {
    currentRoleUser.value = row
    userRoleVisible.value = true
  }

  const resetPwd = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.user.resetPwdConfirm', { name: row.username }),
      t('pages.system.user.resetPassword'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await resetUserPassword([row.id])
      ElMessage.success(t('pages.system.user.resetPwdSuccess'))
    })
  }

  const toggleLeader = (row: any): void => {
    const isLeader = row.isLeader === 1
    ElMessageBox.confirm(
      t(isLeader ? 'pages.system.user.unsetLeaderConfirm' : 'pages.system.user.setLeaderConfirm', {
        name: row.realName || row.nickname || row.username
      }),
      t(isLeader ? 'pages.system.user.unsetLeader' : 'pages.system.user.setLeader'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await setUserLeader(row.id)
      ElMessage.success(
        t(isLeader ? 'pages.system.user.unsetLeaderSuccess' : 'pages.system.user.setLeaderSuccess')
      )
      refreshData()
    })
  }

  // 导出用户：按当前生效的查询条件导出（剔除分页参数；空值由后端忽略）
  const exporting = ref(false)
  const handleExport = async (): Promise<void> => {
    exporting.value = true
    try {
      const conditions = { ...(searchParams as Record<string, any>) }
      delete conditions.pageNum
      delete conditions.pageSize
      await exportUser(conditions)
    } finally {
      exporting.value = false
    }
  }

  // 表格列工厂（与列持久化共用同一份出厂默认）
  const columnsFactory = (): ColumnOption[] => [
    {
      type: 'selection',
      width: 48,
      fixed: 'left',
      selectable: (row: any) => String(row.id) !== selfId.value
    },
    { type: 'index', width: 60, label: t('table.column.index') },
    { prop: 'username', label: t('pages.system.user.fields.username'), minWidth: 120 },
    { prop: 'realName', label: t('pages.system.user.fields.realName'), minWidth: 110 },
    { prop: 'nickname', label: t('pages.system.user.fields.nickname'), minWidth: 110 },
    { prop: 'code', label: t('pages.system.user.fields.code'), minWidth: 100 },
    {
      prop: 'sex',
      label: t('pages.system.user.fields.sex'),
      width: 80,
      formatter: (row: any) => h(ArtDictTag, { code: DICT_CODE.USER_SEX, value: row.sex })
    },
    {
      prop: 'deptName',
      label: t('pages.system.user.fields.dept'),
      minWidth: 120,
      showOverflowTooltip: true
    },
    {
      prop: 'postName',
      label: t('pages.system.user.fields.post'),
      minWidth: 110,
      showOverflowTooltip: true
    },
    {
      prop: 'leaderName',
      label: t('pages.system.user.fields.leader'),
      minWidth: 110,
      showOverflowTooltip: true
    },
    {
      prop: 'isLeader',
      label: t('pages.system.user.fields.isLeader'),
      width: 80,
      formatter: (row: any) => (Number(row.isLeader) === 1 ? '✓' : '—')
    },
    {
      prop: 'roleNames',
      label: t('pages.system.user.fields.role'),
      minWidth: 140,
      showOverflowTooltip: true
    },
    { prop: 'phone', label: t('pages.system.user.fields.phone'), minWidth: 130 },
    {
      prop: 'status',
      label: t('pages.system.user.fields.status'),
      width: 100,
      // 字典运行时驱动：改用 ArtDictTag，不再硬编码 h(ElSwitch)/手写 options（状态切换归编辑弹窗）
      formatter: (row: any) => h(ArtDictTag, { code: DICT_CODE.USER_STATUS, value: row.status })
    },
    {
      prop: 'createTime',
      label: t('pages.system.user.fields.createTime'),
      minWidth: 180,
      formatter: (row: any) => formatTableTime(row.createTime)
    },
    {
      prop: 'operation',
      label: t('pages.system.user.fields.operation'),
      width: 400,
      fixed: 'right',
      // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
      formatter: (row: any) =>
        h('div', [
          hasPerm('sys:user:edit')
            ? h(ArtButtonTable, { type: 'edit', onClick: () => showDialog('edit', row) })
            : null,
          hasPerm('sys:user:remove') && String(row.id) !== selfId.value
            ? h(ArtButtonTable, { type: 'delete', onClick: () => deleteUser(row) })
            : null,
          hasPerm('sys:user:grant')
            ? h(
                ElButton,
                {
                  link: true,
                  type: 'primary',
                  size: 'small',
                  style: 'margin-left:8px',
                  onClick: () => showUserRole(row)
                },
                () => t('pages.system.user.grant')
              )
            : null,
          hasPerm('sys:user:reset')
            ? h(
                ElButton,
                { link: true, type: 'warning', size: 'small', onClick: () => resetPwd(row) },
                () => t('pages.system.user.resetPassword')
              )
            : null,
          hasPerm('sys:user:edit')
            ? h(
                ElButton,
                { link: true, type: 'danger', size: 'small', onClick: () => openLock(row) },
                () => t('pages.system.user.lock')
              )
            : null,
          hasPerm('sys:user:edit')
            ? h(
                ElButton,
                {
                  link: true,
                  type: row.isLeader === 1 ? 'info' : 'success',
                  size: 'small',
                  onClick: () => toggleLeader(row)
                },
                () =>
                  t(
                    row.isLeader === 1
                      ? 'pages.system.user.unsetLeader'
                      : 'pages.system.user.setLeader'
                  )
              )
            : null,
          hasPerm('sys:login-log:list')
            ? h(
                ElButton,
                {
                  link: true,
                  type: 'primary',
                  size: 'small',
                  onClick: () =>
                    router.push({
                      path: '/system/login-log',
                      query: { username: row.username, exact: '1' }
                    })
                },
                () => t('pages.system.user.authLog')
              )
            : null
        ])
    }
  ]

  const {
    columns,
    columnChecks,
    data,
    loading,
    error,
    pagination,
    searchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    setColumns,
    resetColumns,
    fetchData,
    replaceSearchParams,
    resetSearchParams
  } = useTable({
    core: {
      apiFn: fetchUserPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 后端分页参数为 pageNum/pageSize
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory
    },
    transform: {
      // 适配后端 mybatis-flex Page：records + totalRow
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 20
      })
    }
  })

  // 列配置持久化：每用户 + 本表（system-user）
  const { resetToDefault, onHeaderDragend } = useTableColumnPersist({
    tableKey: 'system-user',
    columnChecks,
    columnsFactory,
    setColumns: setColumns!,
    resetColumns: resetColumns!
  })

  // 恢复默认列
  const handleResetColumns = async (): Promise<void> => {
    await resetToDefault()
    ElMessage.success(t('pages.system.user.columnsRestored'))
  }

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    filtering.value = !!(
      params.username ||
      params.nickname ||
      params.phone ||
      (params.status !== undefined && params.status !== '') ||
      params.deptId
    )
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    filtering.value = false
    searchForm.value = {
      username: '',
      nickname: '',
      phone: '',
      status: undefined,
      deptId: undefined
    }
    resetSearchParams()
    await fetchData()
  }

  onMounted(async () => {
    deptTreeData.value = (await fetchDeptOptions()) || []
  })

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentUserData.value = row ? { ...row } : {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const lockVisible = ref(false)
  const lockSaving = ref(false)
  const locksVisible = ref(false)
  const lockRows = ref<any[]>([])
  const lockForm = ref<{ id: string; username: string; reason: string; minutes?: number }>({
    id: '',
    username: '',
    reason: ''
  })

  const openLock = (row: any): void => {
    lockForm.value = { id: String(row.id), username: row.username, reason: '' }
    lockVisible.value = true
  }

  const submitLock = async (): Promise<void> => {
    if (!lockForm.value.reason.trim()) {
      ElMessage.warning(t('pages.system.user.lockReasonRequired'))
      return
    }
    lockSaving.value = true
    try {
      await lockUser({
        id: lockForm.value.id,
        reason: lockForm.value.reason.trim(),
        minutes: lockForm.value.minutes
      })
      lockVisible.value = false
      ElMessage.success(t('pages.system.user.lockSuccess'))
    } finally {
      lockSaving.value = false
    }
  }

  const openLocks = async (): Promise<void> => {
    lockRows.value = (await fetchUserLocks()) || []
    locksVisible.value = true
  }

  const unlockRow = async (row: any): Promise<void> => {
    await unlockUser({ lockKey: row.lockKey })
    ElMessage.success(t('pages.system.user.unlockSuccess'))
    lockRows.value = (await fetchUserLocks()) || []
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows || []
  }

  const deleteUser = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.user.deleteConfirm', { name: row.username }),
      t('pages.system.user.deleteUser'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await removeUser([row.id])
        selectedRows.value = []
        refreshData()
      })
      .catch(() => {})
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.user.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.user.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.user.deleteUser'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await removeUser(selectedRows.value.map((row) => row.id))
        selectedRows.value = []
        refreshData()
      })
      .catch(() => {})
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await saveUser(form)
      dialogVisible.value = false
      refreshData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>
