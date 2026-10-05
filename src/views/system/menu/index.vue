<!-- 菜单管理页面（树形 CRUD） -->
<template>
  <div class="menu-page art-full-height">
    <!-- 查询栏：菜单名称模糊 + 是否隐藏（sys_menu 无 status 字段，状态过滤对应隐藏位） -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <div class="menu-toolbar">
        <ElButton v-perm="'sys:menu:save'" @click="showDialog('add')" v-ripple>{{
          $t('pages.system.menu.addMenu')
        }}</ElButton>
        <ElButton v-perm="'sys:menu:remove'" type="danger" plain @click="deleteSelected">{{
          $t('pages.system.menu.deleteSelectedBtn')
        }}</ElButton>
      </div>

      <!-- 树表为自由增长内容：art-table-card 卡片体是 height:100%+overflow:hidden 裁剪，
           内部须自备滚动，否则矮视口下深层节点被切断且不可达（同 track/user 修法） -->
      <div v-loading="loading" class="menu-table-wrap">
        <ElTable
          :data="treeData"
          row-key="id"
          default-expand-all
          border
          @selection-change="onSelectionChange"
        >
          <template #empty>
            <span>{{ emptyText }}</span>
          </template>
          <ElTableColumn type="selection" width="48" />
          <ElTableColumn
            prop="menuName"
            :label="$t('pages.system.menu.fields.menuName')"
            min-width="140"
          />
          <ElTableColumn :label="$t('pages.system.menu.fields.icon')" width="56" align="center">
            <template #default="{ row }">
              <span v-if="row.icon" class="menu-icon" :data-icon="row.icon">
                <ArtSvgIcon :icon="row.icon" class="text-lg" />
              </span>
              <span v-else>—</span>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.menu.fields.type')" width="72">
            <template #default="{ row }">{{ TYPE_LABELS[row.menuType] ?? row.menuType }}</template>
          </ElTableColumn>
          <ElTableColumn prop="path" :label="$t('pages.system.menu.fields.path')" min-width="120" />
          <ElTableColumn
            prop="permission"
            :label="$t('pages.system.menu.fields.permission')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn prop="sort" :label="$t('pages.system.menu.fields.sort')" width="64" />
          <ElTableColumn :label="$t('pages.system.menu.fields.isHide')" width="64" align="center">
            <template #default="{ row }">
              <ElTag :type="row.isHide === 1 ? 'danger' : 'success'">
                {{
                  row.isHide === 1
                    ? $t('pages.system.menu.hideStatus.hide')
                    : $t('pages.system.menu.hideStatus.show')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.menu.fields.isKeepAlive')"
            width="64"
            align="center"
          >
            <template #default="{ row }">
              <ElTag :type="row.isKeepAlive === 1 ? 'success' : 'info'">
                {{
                  row.isKeepAlive === 1 ? $t('pages.system.menu.yes') : $t('pages.system.menu.no')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            :label="$t('pages.system.menu.fields.isExternal')"
            width="64"
            align="center"
          >
            <template #default="{ row }">
              <ElTag :type="row.isExternal === 1 ? 'warning' : 'info'">
                {{
                  row.isExternal === 1 ? $t('pages.system.menu.yes') : $t('pages.system.menu.no')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.menu.fields.operation')" width="188">
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:menu:save'"
                link
                type="primary"
                @click="showDialog('add', row)"
                >{{ $t('pages.system.menu.addChild') }}</ElButton
              >
              <ElButton
                v-perm="'sys:menu:save'"
                link
                type="primary"
                @click="showDialog('edit', row)"
                >{{ $t('pages.system.menu.edit') }}</ElButton
              >
              <ElButton v-perm="'sys:menu:remove'" link type="danger" @click="deleteRow(row)">{{
                $t('pages.system.menu.delete')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <MenuDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :menu-data="currentData"
        :menu-tree="treeData"
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
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { fetchMenuTree } from '@/api/menu'
  import { fetchSaveMenu, fetchRemoveMenu } from '@/api/system-manage'
  import MenuDialog from './modules/menu-dialog.vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'Menus' })

  const { t } = useI18n()

  const TYPE_LABELS: Record<string, string> = {
    M: t('pages.system.menu.type.directory'),
    C: t('pages.system.menu.type.menu'),
    F: t('pages.system.menu.type.button')
  }

  // ===== 查询栏 =====
  const searchForm = ref({
    menuName: '',
    isHide: undefined as number | undefined
  })
  const searchItems = computed(() => [
    {
      key: 'menuName',
      label: t('pages.system.menu.fields.menuName'),
      type: 'input',
      props: { placeholder: t('pages.system.menu.placeholder.menuName'), clearable: true }
    },
    {
      key: 'isHide',
      label: t('pages.system.menu.fields.isHideForm'),
      type: 'select',
      props: {
        placeholder: t('pages.system.menu.placeholder.isHide'),
        clearable: true,
        options: [
          { label: t('pages.system.menu.hideStatus.show'), value: 0 },
          { label: t('pages.system.menu.hideStatus.hide'), value: 1 }
        ]
      }
    }
  ])

  const treeData = ref<any[]>([])
  const loading = ref(false)
  const selectedRows = ref<any[]>([])
  const filtering = ref(false)
  const emptyText = computed(() =>
    filtering.value ? t('pages.system.menu.emptySearch') : t('pages.system.menu.emptyList')
  )
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentData = ref<Record<string, any>>({})
  const dialogSaving = ref(false)

  const loadData = async (): Promise<void> => {
    // 仅携带已填条件（空值不下发，后端按非空拼条件）
    const params: Record<string, any> = {}
    if (searchForm.value.menuName) params.menuName = searchForm.value.menuName
    if (searchForm.value.isHide !== undefined && searchForm.value.isHide !== null) {
      params.isHide = searchForm.value.isHide
    }
    loading.value = true
    try {
      treeData.value = (await fetchMenuTree(params)) || []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  const handleSearch = (): void => {
    filtering.value = !!(searchForm.value.menuName || searchForm.value.isHide !== undefined)
    loadData()
  }

  const handleResetSearch = (): void => {
    filtering.value = false
    searchForm.value = { menuName: '', isHide: undefined }
    loadData()
  }

  const onSelectionChange = (rows: any[]): void => {
    selectedRows.value = rows || []
  }

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = type === 'add' ? { parentId: row?.id ?? 0 } : { ...row }
    dialogVisible.value = true
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.menu.deleteConfirm', { name: row.menuName }),
      t('pages.system.menu.deleteMenu'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveMenu(row.id)
        ElMessage.success(t('pages.system.menu.deleteSuccess'))
        selectedRows.value = []
        loadData()
      })
      .catch(() => {})
  }

  const deleteSelected = (): void => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.menu.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.menu.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.menu.deleteMenu'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveMenu(selectedRows.value.map((row) => row.id))
        ElMessage.success(t('pages.system.menu.deleteSuccess'))
        selectedRows.value = []
        loadData()
      })
      .catch(() => {})
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveMenu(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.menu.saveSuccess'))
      loadData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>

<style scoped>
  /* 卡片体改为纵向 flex，树表滚动区占满剩余高度（滚动区见模板注释） */
  .menu-page :deep(.art-table-card > .el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .menu-toolbar {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    margin-bottom: 12px;
  }

  .menu-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
