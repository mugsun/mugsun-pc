<!-- 租户套餐管理（对接 /system/tenant-package）：绑定该套餐可用功能菜单 -->
<template>
  <div class="tpkg-page art-full-height">
    <!-- 查询栏：条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <div class="tpkg-toolbar">
        <ElButton v-perm="'sys:tenant-package:save'" type="primary" @click="showCreate">{{
          $t('pages.system.tenantPackage.create')
        }}</ElButton>
      </div>

      <!-- 表格为自由增长内容：art-table-card 卡片体是 height:100%+overflow:hidden 裁剪，
           内部须自备滚动，否则矮视口下底部行被切断且不可达（同 track/user 修法） -->
      <div v-loading="loading" class="tpkg-table-wrap">
        <ElTable :data="tableData" border>
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn
            prop="name"
            :label="$t('pages.system.tenantPackage.name')"
            min-width="150"
          />
          <ElTableColumn :label="$t('pages.system.tenantPackage.menuCount')" width="110">
            <template #default="{ row }">{{ keyCount(row.menuKeys) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.tenantPackage.status')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.tenantPackage.enabled')
                    : $t('pages.system.tenantPackage.disabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="remark"
            :label="$t('pages.system.tenantPackage.remark')"
            min-width="160"
            show-overflow-tooltip
          />
          <ElTableColumn
            :label="$t('pages.system.tenantPackage.actions')"
            width="150"
            fixed="right"
          >
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:tenant-package:save'"
                link
                type="primary"
                @click="showEdit(row)"
                >{{ $t('pages.system.tenantPackage.edit') }}</ElButton
              >
              <ElButton
                v-perm="'sys:tenant-package:remove'"
                link
                type="danger"
                @click="remove(row)"
                >{{ $t('pages.system.tenantPackage.delete') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="
        form.id
          ? $t('pages.system.tenantPackage.editTitle')
          : $t('pages.system.tenantPackage.create')
      "
      width="600px"
      align-center
      destroy-on-close
      class="tpkg-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.tenantPackage.name')" prop="name">
          <ElInput
            v-model="form.name"
            :placeholder="$t('pages.system.tenantPackage.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantPackage.status')">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantPackage.menuLabel')">
          <ElTree
            ref="treeRef"
            :data="menuTree"
            show-checkbox
            node-key="value"
            :default-expand-all="true"
            :props="{ label: 'label', children: 'children' }"
            class="tpkg-tree"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantPackage.remark')">
          <ElInput
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('pages.system.tenantPackage.remarkPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('pages.system.tenantPackage.save')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, nextTick, onDeactivated, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import {
    fetchTenantPackagePage,
    fetchSubmitTenantPackage,
    fetchRemoveTenantPackage
  } from '@/api/system-manage'
  import { asyncRoutes } from '@/router/routes/asyncRoutes'
  import { formatMenuTitle } from '@/utils'
  import type { AppRouteRecord } from '@/types/router'

  defineOptions({ name: 'TenantPackage' })

  const { t } = useI18n()

  // ===== 查询栏 =====
  const searchForm = ref({
    name: '',
    status: undefined as number | undefined
  })
  const searchItems = computed(() => [
    {
      key: 'name',
      label: t('pages.system.tenantPackage.name'),
      type: 'input',
      props: { placeholder: t('pages.system.tenantPackage.namePlaceholder'), clearable: true }
    },
    {
      key: 'status',
      label: t('pages.system.tenantPackage.status'),
      type: 'select',
      props: {
        placeholder: t('pages.system.tenantPackage.statusPlaceholder'),
        clearable: true,
        options: [
          { label: t('pages.system.tenantPackage.enabled'), value: 1 },
          { label: t('pages.system.tenantPackage.disabled'), value: 0 }
        ]
      }
    }
  ])

  interface TreeNode {
    value: string
    label: string
    children?: TreeNode[]
  }

  // 由前端路由构建可绑定菜单树（以路由 name 为键）
  const buildTree = (routes: AppRouteRecord[]): TreeNode[] =>
    routes
      .filter((r) => r.name && r.meta?.title)
      .map((r) => {
        const node: TreeNode = { value: String(r.name), label: formatMenuTitle(r.meta!.title) }
        const children = r.children?.length ? buildTree(r.children) : []
        if (children.length) node.children = children
        return node
      })

  const menuTree = buildTree(asyncRoutes)

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const formRef = ref<FormInstance>()
  const treeRef = ref<any>()

  const form = reactive<Record<string, any>>({ id: null, name: '', status: 1, remark: '' })

  const rules: FormRules = {
    name: [
      { required: true, message: t('pages.system.tenantPackage.namePlaceholder'), trigger: 'blur' }
    ]
  }

  const keyCount = (keys: string): number => (keys ? keys.split(',').filter(Boolean).length : 0)

  // 查询条件以 searchForm 为唯一事实源（v-model 已同步），CRUD 刷新后过滤仍生效
  const currentParams = (): Record<string, any> => ({
    name: searchForm.value.name || undefined,
    status: searchForm.value.status
  })

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchTenantPackagePage({ pageNum: 1, pageSize: 50, ...currentParams() })
      tableData.value = resp?.records ?? []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  // ===== 查询栏联动 =====
  const handleSearch = async (): Promise<void> => {
    await loadData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      name: '',
      status: undefined
    }
    await loadData()
  }

  const showCreate = (): void => {
    Object.assign(form, { id: null, name: '', status: 1, remark: '' })
    dialogVisible.value = true
    nextTick(() => treeRef.value?.setCheckedKeys([]))
  }

  const showEdit = (row: any): void => {
    Object.assign(form, { id: row.id, name: row.name, status: row.status, remark: row.remark })
    dialogVisible.value = true
    const keys = (row.menuKeys || '').split(',').filter(Boolean)
    nextTick(() => treeRef.value?.setCheckedKeys(keys))
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      dialogSaving.value = true
      try {
        // 仅收集叶子（勾选）节点名作为菜单标识
        const keys: string[] = treeRef.value?.getCheckedKeys(true) ?? []
        await fetchSubmitTenantPackage({ ...form, menuKeys: keys.join(',') })
        ElMessage.success(t('pages.system.tenantPackage.msgSaved'))
        dialogVisible.value = false
        loadData()
      } finally {
        dialogSaving.value = false
      }
    })
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.tenantPackage.confirmDelete', { name: row.name }),
      t('pages.system.tenantPackage.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveTenantPackage(row.id)
        ElMessage.success(t('pages.system.tenantPackage.msgDeleted'))
        loadData()
      })
      .catch(() => {
        /* cancel */
      })
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
  /* 卡片体改为纵向 flex，表格滚动区占满剩余高度（滚动区见模板注释） */
  .tpkg-page :deep(.art-table-card > .el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .tpkg-toolbar {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .tpkg-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .tpkg-tree {
    width: 100%;
    max-height: 300px;
    padding: 8px;
    overflow-y: auto;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
  }
</style>

<!-- 弹窗内容 teleport 到 body：菜单树+表单项叠加超高时需非 scoped 类限定内部滚动（同 notice-dialog 范式），防矮视口下保存按钮挤出视口 -->
<style>
  .tpkg-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
