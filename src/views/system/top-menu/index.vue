<template>
  <div class="top-menu-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="load"
      @reset="resetSearch"
    />
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElButton v-perm="'sys:top-menu:save'" type="primary" @click="openEdit()">{{
          $t('pages.system.topMenu.add')
        }}</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" border>
        <ElTableColumn type="index" width="60" :label="$t('table.column.index')" />
        <ElTableColumn prop="name" :label="$t('pages.system.topMenu.name')" min-width="140" />
        <ElTableColumn prop="code" :label="$t('pages.system.topMenu.code')" min-width="120" />
        <ElTableColumn prop="path" :label="$t('pages.system.topMenu.path')" min-width="160">
          <template #default="{ row }">{{ row.path || '—' }}</template>
        </ElTableColumn>
        <ElTableColumn prop="sort" :label="$t('pages.system.topMenu.sort')" width="80" />
        <ElTableColumn :label="$t('pages.system.topMenu.home')" width="90">
          <template #default="{ row }">
            <ElSwitch
              :model-value="row.isMain === 1"
              :disabled="!canSave"
              :before-change="() => setHome(row)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('table.column.operation')" width="200" fixed="right">
          <template #default="{ row }">
            <ElButton v-perm="'sys:top-menu:grant'" link type="primary" @click="openGrant(row)">{{
              $t('pages.system.topMenu.grant')
            }}</ElButton>
            <ElButton v-perm="'sys:top-menu:save'" link type="primary" @click="openEdit(row)">{{
              $t('common.edit')
            }}</ElButton>
            <ElButton v-perm="'sys:top-menu:remove'" link type="danger" @click="removeRow(row)">{{
              $t('pages.system.topMenu.delete')
            }}</ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <span>{{ $t('pages.system.topMenu.empty') }}</span>
        </template>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="editVisible"
      :title="form.id ? $t('pages.system.topMenu.edit') : $t('pages.system.topMenu.add')"
      width="480px"
      align-center
    >
      <ElForm label-width="88px">
        <ElFormItem :label="$t('pages.system.topMenu.name')">
          <ElInput
            v-model="form.name"
            maxlength="64"
            show-word-limit
            :placeholder="$t('pages.system.topMenu.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.topMenu.code')">
          <ElInput
            v-model="form.code"
            maxlength="64"
            :placeholder="$t('pages.system.topMenu.codePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.topMenu.icon')">
          <ElInput v-model="form.icon" :placeholder="$t('pages.system.topMenu.iconPlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.topMenu.path')">
          <ElInput v-model="form.path" :placeholder="$t('pages.system.topMenu.pathPlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.topMenu.sort')">
          <ElInputNumber v-model="form.sort" :min="0" :max="9999" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="grantVisible" :title="grantTitle" width="480px" align-center>
      <div class="grant-tools">
        <ElSwitch v-model="linkNodes" :active-text="$t('pages.system.topMenu.linkNodes')" />
        <span>
          <ElButton size="small" @click="checkAll">{{
            $t('pages.system.topMenu.selectAll')
          }}</ElButton>
          <ElButton size="small" @click="clearChecked">{{
            $t('pages.system.topMenu.clearChecked')
          }}</ElButton>
        </span>
      </div>
      <p class="grant-hint">{{ $t('pages.system.topMenu.linkHint') }}</p>
      <ElTree
        ref="treeRef"
        class="grant-tree"
        :data="tree"
        node-key="id"
        show-checkbox
        default-expand-all
        :check-strictly="!linkNodes"
        :props="{ label: 'menuName', children: 'children' }"
      />
      <template #footer>
        <ElButton @click="grantVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitGrant">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchGrantTopMenu,
    fetchRemoveTopMenu,
    fetchSaveTopMenu,
    fetchTopMenuGrant,
    fetchTopMenuHome,
    fetchTopMenuPage
  } from '@/api/top-menu'
  import { useTopMenuStore } from '@/store/modules/topMenu'
  import { hasPerm } from '@/utils/permission'

  defineOptions({ name: 'TopMenu' })

  const { t } = useI18n()
  const topMenuStore = useTopMenuStore()
  const canSave = computed(() => hasPerm('sys:top-menu:save'))
  const loading = ref(false)
  const saving = ref(false)
  const rows = ref<any[]>([])
  const searchForm = ref({ name: '' })
  const searchItems = computed(() => [
    {
      key: 'name',
      label: t('pages.system.topMenu.searchName'),
      type: 'input',
      props: { clearable: true, placeholder: t('pages.system.topMenu.namePlaceholder') }
    }
  ])

  const editVisible = ref(false)
  const form = reactive({ id: '', name: '', code: '', icon: '', path: '', sort: 0 })
  const grantVisible = ref(false)
  const grantId = ref('')
  const grantName = ref('')
  const tree = ref<any[]>([])
  const linkNodes = ref(false)
  const treeRef = ref<any>()
  const grantTitle = computed(() => t('pages.system.topMenu.grantTitle', { name: grantName.value }))

  const load = async () => {
    loading.value = true
    try {
      const page = await fetchTopMenuPage({
        pageNum: 1,
        pageSize: 50,
        name: searchForm.value.name || undefined
      })
      rows.value = page?.records || []
    } finally {
      loading.value = false
    }
  }

  const resetSearch = () => {
    searchForm.value.name = ''
    load()
  }

  const openEdit = (row?: any) => {
    form.id = row?.id ? String(row.id) : ''
    form.name = row?.name || ''
    form.code = row?.code || ''
    form.icon = row?.icon || ''
    form.path = row?.path || ''
    form.sort = row?.sort ?? 0
    editVisible.value = true
  }

  const submit = async () => {
    if (!form.name.trim()) {
      ElMessage.warning(t('pages.system.topMenu.nameRequired'))
      return
    }
    if (!form.code.trim()) {
      ElMessage.warning(t('pages.system.topMenu.codeRequired'))
      return
    }
    saving.value = true
    try {
      await fetchSaveTopMenu({
        id: form.id || undefined,
        name: form.name.trim(),
        code: form.code.trim(),
        icon: form.icon.trim(),
        path: form.path.trim(),
        sort: form.sort
      })
      editVisible.value = false
      await load()
      await topMenuStore.load()
    } finally {
      saving.value = false
    }
  }

  const setHome = async (row: any) => {
    if (row.isMain === 1) {
      ElMessage.info(t('pages.system.topMenu.homeHint'))
      return false
    }
    await fetchTopMenuHome(String(row.id))
    await load()
    await topMenuStore.load()
    return true
  }

  const removeRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.topMenu.deleteConfirm', { name: row.name }),
      t('common.tips'),
      { type: 'warning' }
    )
    await fetchRemoveTopMenu([String(row.id)])
    await load()
    await topMenuStore.load()
  }

  const openGrant = async (row: any) => {
    grantId.value = String(row.id)
    grantName.value = row.name
    linkNodes.value = false
    const data = await fetchTopMenuGrant(grantId.value)
    tree.value = data?.tree || []
    grantVisible.value = true
    await nextTick()
    treeRef.value?.setCheckedKeys(data?.checked || [], false)
  }

  const collectIds = (nodes: any[], bucket: string[]) => {
    for (const node of nodes || []) {
      if (node.id != null) bucket.push(String(node.id))
      if (node.children?.length) collectIds(node.children, bucket)
    }
  }

  const checkAll = () => {
    const ids: string[] = []
    collectIds(tree.value, ids)
    treeRef.value?.setCheckedKeys(ids, false)
  }

  const clearChecked = () => {
    treeRef.value?.setCheckedKeys([], false)
  }

  const submitGrant = async () => {
    const checked = (treeRef.value?.getCheckedKeys(false) || []).map((id: string | number) =>
      String(id)
    )
    const half = linkNodes.value
      ? (treeRef.value?.getHalfCheckedKeys() || []).map((id: string | number) => String(id))
      : []
    saving.value = true
    try {
      await fetchGrantTopMenu(grantId.value, [...checked, ...half])
      grantVisible.value = false
      await topMenuStore.load()
    } finally {
      saving.value = false
    }
  }

  load()
</script>

<style scoped>
  .toolbar {
    margin-bottom: 12px;
  }

  .grant-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .grant-hint {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .grant-tree {
    max-height: 360px;
    overflow: auto;
  }
</style>
