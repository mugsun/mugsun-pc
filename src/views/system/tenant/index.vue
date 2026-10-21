<!-- 租户管理页面 -->
<template>
  <div class="tenant-page art-full-height">
    <!-- 查询栏：条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      label-width="auto"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <div class="tenant-toolbar">
        <ElButton v-perm="'sys:tenant:save'" type="primary" @click="openCreate" v-ripple>{{
          $t('pages.system.tenant.create')
        }}</ElButton>
        <ElButton v-perm="'sys:tenant:remove'" @click="deleteSelected">{{
          $t('pages.system.tenant.deleteSelected')
        }}</ElButton>
      </div>

      <!-- 表格为自由增长内容：art-table-card 卡片体是 height:100%+overflow:hidden 裁剪，
           内部须自备滚动，否则矮视口下底部行被切断且不可达（同 track/user 修法） -->
      <div v-loading="loading" class="tenant-table-wrap">
        <ElTable
          :data="tableData"
          border
          class="tenant-table"
          @selection-change="onSelectionChange"
        >
          <template #empty>
            <span>{{ emptyText }}</span>
          </template>
          <ElTableColumn type="selection" width="44" :selectable="canSelect" />
          <ElTableColumn type="index" :label="$t('table.column.index')" width="54" />
          <ElTableColumn
            prop="tenantCode"
            :label="$t('pages.system.tenant.tenantCode')"
            min-width="104"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="tenantName"
            :label="$t('pages.system.tenant.tenantName')"
            min-width="112"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.tenant.package')" min-width="146">
            <template #default="{ row }">
              <ElTag v-if="row.packageId" type="success">{{ packageName(row.packageId) }}</ElTag>
              <ElTag v-else type="info">{{ $t('pages.system.tenant.noLimitFeature') }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.tenant.contactUser')"
            min-width="76"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.contactUser || '—' }}</template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.tenant.contactPhone')"
            min-width="118"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.contactPhone || '—' }}</template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.tenant.accountLimit')"
            min-width="112"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              {{
                row.accountCount == null || row.accountCount < 0
                  ? $t('pages.system.tenant.unlimited')
                  : row.accountCount
              }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.tenant.status')"
            min-width="84"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <ElTag v-if="row.status === 0" type="danger">{{
                $t('pages.system.tenant.disabled')
              }}</ElTag>
              <ElTag v-else type="success">{{ $t('pages.system.tenant.normal') }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.tenant.expireTime')"
            min-width="164"
            class-name="tenant-expire-col"
          >
            <template #default="{ row }">
              {{
                row.expireTime
                  ? formatTableTime(row.expireTime)
                  : $t('pages.system.tenant.neverExpire')
              }}
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.tenant.actions')" width="180" fixed="right">
            <template #default="{ row }">
              <ElButton v-perm="'sys:tenant:save'" link type="primary" @click="openEdit(row)">{{
                $t('pages.system.tenant.edit')
              }}</ElButton>
              <ElButton
                v-perm="'sys:tenant:save'"
                link
                type="primary"
                data-testid="tenant-captcha"
                @click="openCaptcha(row)"
                >{{ $t('pages.system.tenant.captcha') }}</ElButton
              >
              <ElButton
                v-if="row.tenantCode !== '000000'"
                v-perm="'sys:tenant:remove'"
                link
                type="danger"
                @click="deleteRow(row)"
                >{{ $t('pages.system.tenant.delete') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <TenantDialog
        v-model:visible="dialogVisible"
        :row="current"
        :packages="packages"
        :saving="dialogSaving"
        @submit="handleSubmit"
      />
      <TenantCaptchaDialog v-model:visible="captchaVisible" :row="captchaRow" @saved="loadData()" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onDeactivated, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import {
    fetchTenantList,
    fetchCreateTenant,
    fetchUpdateTenant,
    fetchRemoveTenant,
    fetchTenantPackageList
  } from '@/api/system-manage'
  import TenantDialog from './modules/tenant-dialog.vue'
  import TenantCaptchaDialog from './modules/tenant-captcha-dialog.vue'
  import { formatTableTime } from '@/utils/date'
  import { ElMessageBox, ElMessage } from 'element-plus'

  defineOptions({ name: 'Tenant' })

  const { t } = useI18n()

  // ===== 查询栏 =====
  const searchForm = ref({
    tenantName: '',
    tenantCode: '',
    status: undefined as number | undefined
  })
  const searchItems = computed(() => [
    {
      key: 'tenantName',
      label: t('pages.system.tenant.tenantName'),
      type: 'input',
      props: { placeholder: t('pages.system.tenant.namePlaceholder'), clearable: true }
    },
    {
      key: 'tenantCode',
      label: t('pages.system.tenant.tenantCode'),
      type: 'input',
      props: { placeholder: t('pages.system.tenant.codePlaceholder'), clearable: true }
    },
    {
      key: 'status',
      label: t('pages.system.tenant.status'),
      type: 'select',
      props: {
        placeholder: t('pages.system.tenant.statusPlaceholder'),
        clearable: true,
        options: [
          { label: t('pages.system.tenant.normal'), value: 1 },
          { label: t('pages.system.tenant.disabled'), value: 0 }
        ]
      }
    }
  ])

  const tableData = ref<any[]>([])
  const selectedRows = ref<any[]>([])
  const filtering = ref(false)
  const packages = ref<any[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const current = ref<Record<string, any> | null>(null)

  const emptyText = computed(() =>
    filtering.value ? t('pages.system.tenant.emptySearch') : t('pages.system.tenant.empty')
  )

  const canSelect = (row: { tenantCode?: string }): boolean => row.tenantCode !== '000000'

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows
  }

  const packageName = (id: number | string): string =>
    packages.value.find((p) => String(p.id) === String(id))?.name ?? '—'

  // 查询条件以 searchForm 为唯一事实源（v-model 已同步），CRUD 刷新后过滤仍生效
  const currentParams = (): Record<string, any> => ({
    tenantName: searchForm.value.tenantName || undefined,
    tenantCode: searchForm.value.tenantCode || undefined,
    status: searchForm.value.status
  })

  const loadData = async (): Promise<void> => {
    loading.value = true
    filtering.value = Boolean(
      searchForm.value.tenantName ||
        searchForm.value.tenantCode ||
        searchForm.value.status !== undefined
    )
    try {
      tableData.value = (await fetchTenantList(currentParams())) || []
      selectedRows.value = []
    } finally {
      loading.value = false
    }
  }

  const loadPackages = async (): Promise<void> => {
    packages.value = (await fetchTenantPackageList()) || []
  }

  onMounted(() => {
    loadData()
    loadPackages()
  })

  // ===== 查询栏联动 =====
  const handleSearch = async (): Promise<void> => {
    await loadData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      tenantName: '',
      tenantCode: '',
      status: undefined
    }
    await loadData()
  }

  const openDialog = async (row: Record<string, any> | null): Promise<void> => {
    await loadPackages()
    current.value = row
    dialogVisible.value = true
  }

  const openCreate = (): void => {
    void openDialog(null)
  }

  const openEdit = (row: any): void => {
    void openDialog({ ...row })
  }

  const captchaVisible = ref(false)
  const captchaRow = ref<Record<string, any> | null>(null)
  const openCaptcha = (row: any): void => {
    captchaRow.value = { ...row }
    captchaVisible.value = true
  }

  const handleSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      if (form.id) {
        await fetchUpdateTenant(form)
        ElMessage.success(t('pages.system.tenant.msgUpdated'))
      } else {
        const code = await fetchCreateTenant(form)
        ElMessage.success(t('pages.system.tenant.msgCreated', { code }))
      }
      dialogVisible.value = false
      loadData()
    } finally {
      dialogSaving.value = false
    }
  }

  const confirmRemove = (message: string, ids: (number | string)[]): void => {
    ElMessageBox.confirm(message, t('pages.system.tenant.deleteTitle'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
      .then(async () => {
        await fetchRemoveTenant(ids)
        ElMessage.success(t('pages.system.tenant.msgDeleted'))
        loadData()
      })
      .catch(() => {
        /* cancel or request error toast */
      })
  }

  const deleteRow = (row: any): void => {
    confirmRemove(t('pages.system.tenant.confirmDelete', { name: row.tenantName }), [row.id])
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.tenant.selectFirst'))
      return
    }
    confirmRemove(
      t('pages.system.tenant.confirmDeleteSelected', { count: selectedRows.value.length }),
      selectedRows.value.map((row) => row.id)
    )
  }

  const closeOverlays = (): void => {
    dialogVisible.value = false
    ElMessageBox.close()
  }

  onDeactivated(closeOverlays)
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
  onBeforeUnmount(closeOverlays)
</script>

<style scoped>
  /* 表头不折行：列宽已按英文表头留足 min-width，窄屏横向滚动 */
  .tenant-table :deep(.el-table__header .cell) {
    white-space: nowrap;
  }

  /* 列多：表头与单元格左右内边距统一 8px；英文 1440 下到期时间完整显示放不下时表格横滚 */
  .tenant-table :deep(.el-table__cell .cell) {
    padding: 0 8px;
  }

  /* 到期时间完整显示，不截断 */
  .tenant-table :deep(.tenant-expire-col .cell) {
    white-space: nowrap;
  }

  /* 卡片体改为纵向 flex，表格滚动区占满剩余高度（滚动区见模板注释） */
  .tenant-page :deep(.art-table-card > .el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .tenant-toolbar {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .tenant-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
