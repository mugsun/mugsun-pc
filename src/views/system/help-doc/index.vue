<!-- 帮助文档管理：目录树 + 文档(富文本) + 页面绑定 -->
<template>
  <div class="help-doc-page art-full-height">
    <ElRow :gutter="12">
      <!-- 左：目录树 -->
      <ElCol :span="8">
        <ElCard class="art-table-card" shadow="never">
          <div class="panel-toolbar">
            <span class="panel-title">{{ $t('pages.system.helpDoc.catalogTitle') }}</span>
            <ElButton v-perm="'sys:help:manage'" size="small" @click="showCatalogDialog('add')">{{
              $t('pages.system.helpDoc.addCatalog')
            }}</ElButton>
          </div>
          <ElTable
            v-loading="catalogLoading"
            :data="catalogTree"
            row-key="id"
            default-expand-all
            border
            highlight-current-row
            @current-change="onCatalogSelect"
          >
            <ElTableColumn
              prop="name"
              :label="$t('pages.system.helpDoc.catalogName')"
              min-width="130"
            />
            <ElTableColumn prop="sort" :label="$t('pages.system.helpDoc.sort')" width="60" />
            <ElTableColumn :label="$t('pages.system.helpDoc.colOperation')" width="140">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:help:manage'"
                  link
                  type="primary"
                  size="small"
                  @click.stop="showCatalogDialog('add', row)"
                >
                  {{ $t('pages.system.helpDoc.addChild') }}
                </ElButton>
                <ElButton
                  v-perm="'sys:help:manage'"
                  link
                  type="primary"
                  size="small"
                  @click.stop="showCatalogDialog('edit', row)"
                >
                  {{ $t('pages.system.helpDoc.edit') }}
                </ElButton>
                <ElButton
                  v-perm="'sys:help:manage'"
                  link
                  type="danger"
                  size="small"
                  @click.stop="removeCatalog(row)"
                >
                  {{ $t('pages.system.helpDoc.remove') }}
                </ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
      </ElCol>

      <!-- 右：文档 -->
      <ElCol :span="16">
        <ElCard class="art-table-card" shadow="never">
          <div class="panel-toolbar">
            <span class="panel-title">
              {{
                selectedCatalog
                  ? $t('pages.system.helpDoc.docListTitle', { name: selectedCatalog.name })
                  : $t('pages.system.helpDoc.docListEmpty')
              }}
            </span>
            <ElButton
              v-perm="'sys:help:manage'"
              size="small"
              type="primary"
              :disabled="!selectedCatalog"
              @click="showDocDialog('add')"
            >
              {{ $t('pages.system.helpDoc.addDoc') }}
            </ElButton>
          </div>
          <ElTable v-loading="docLoading" :data="docList" border>
            <ElTableColumn prop="title" :label="$t('pages.system.helpDoc.title')" min-width="200" />
            <ElTableColumn
              prop="viewCount"
              :label="$t('pages.system.helpDoc.viewCount')"
              width="90"
            />
            <ElTableColumn prop="sort" :label="$t('pages.system.helpDoc.sort')" width="70" />
            <ElTableColumn :label="$t('pages.system.helpDoc.colOperation')" width="210">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:help:manage'"
                  link
                  type="primary"
                  size="small"
                  @click="showDocDialog('edit', row)"
                  >{{ $t('pages.system.helpDoc.edit') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:help:manage'"
                  link
                  type="primary"
                  size="small"
                  @click="showBindingDialog(row)"
                  >{{ $t('pages.system.helpDoc.bindPage') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:help:manage'"
                  link
                  type="danger"
                  size="small"
                  @click="removeDoc(row)"
                  >{{ $t('pages.system.helpDoc.remove') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
      </ElCol>
    </ElRow>

    <!-- 目录弹窗 -->
    <ElDialog
      v-model="catalogDialog"
      :title="
        catalogForm.id
          ? $t('pages.system.helpDoc.editCatalog')
          : $t('pages.system.helpDoc.addCatalog')
      "
      width="460px"
      destroy-on-close
    >
      <ElForm :model="catalogForm" label-width="90px">
        <ElFormItem :label="$t('pages.system.helpDoc.catalogName')" required>
          <ElInput
            v-model="catalogForm.name"
            :placeholder="$t('pages.system.helpDoc.catalogNamePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.helpDoc.sort')">
          <ElInputNumber v-model="catalogForm.sort" :min="0" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="catalogDialog = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitCatalog">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 文档弹窗 -->
    <ElDialog
      v-model="docDialog"
      :title="docForm.id ? $t('pages.system.helpDoc.editDoc') : $t('pages.system.helpDoc.addDoc')"
      width="780px"
      top="6vh"
      class="help-doc-dialog"
      destroy-on-close
    >
      <ElForm :model="docForm" label-width="70px">
        <ElFormItem :label="$t('pages.system.helpDoc.title')" required>
          <ElInput
            v-model="docForm.title"
            :placeholder="$t('pages.system.helpDoc.docTitlePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.helpDoc.sort')">
          <ElInputNumber v-model="docForm.sort" :min="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.helpDoc.content')">
          <ArtWangEditor v-model="docForm.content" height="320px" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="docDialog = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitDoc">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 绑定弹窗 -->
    <ElDialog
      v-model="bindingDialog"
      :title="$t('pages.system.helpDoc.bindPage')"
      width="560px"
      class="help-doc-dialog"
      destroy-on-close
    >
      <div class="binding-add">
        <ElInput
          v-model="newRoutePath"
          :placeholder="$t('pages.system.helpDoc.routePathPlaceholder')"
          style="width: 74%"
        />
        <ElButton type="primary" :loading="submitting" @click="addBinding">{{
          $t('pages.system.helpDoc.addBinding')
        }}</ElButton>
      </div>
      <ElTable :data="bindingList" border style="margin-top: 12px">
        <ElTableColumn prop="routePath" :label="$t('pages.system.helpDoc.routePath')" />
        <ElTableColumn :label="$t('pages.system.helpDoc.colOperation')" width="90">
          <template #default="{ row }">
            <ElButton link type="danger" size="small" @click="removeBinding(row)">{{
              $t('pages.system.helpDoc.remove')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onDeactivated, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import ArtWangEditor from '@/components/core/forms/art-wang-editor/index.vue'
  import {
    fetchHelpCatalogTree,
    fetchSaveHelpCatalog,
    fetchRemoveHelpCatalog,
    fetchHelpDocPage,
    fetchHelpDocDetail,
    fetchSaveHelpDoc,
    fetchRemoveHelpDoc,
    fetchHelpBindingList,
    fetchSaveHelpBinding,
    fetchRemoveHelpBinding
  } from '@/api/help-doc'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'HelpDoc' })

  const { t } = useI18n()

  // ---------------- 目录 ----------------
  const catalogTree = ref<any[]>([])
  const catalogLoading = ref(false)
  const selectedCatalog = ref<any>(null)
  /** 三弹窗互斥，共用一个提交态防重复提交 */
  const submitting = ref(false)

  const loadCatalogTree = async () => {
    catalogLoading.value = true
    try {
      catalogTree.value = (await fetchHelpCatalogTree()) || []
    } finally {
      catalogLoading.value = false
    }
  }

  const onCatalogSelect = (row: any) => {
    if (!row) return
    selectedCatalog.value = row
    loadDocs()
  }

  const catalogDialog = ref(false)
  const catalogForm = reactive<any>({ id: undefined, parentId: 0, name: '', sort: 0 })

  const closeDialogs = (): void => {
    catalogDialog.value = false
    docDialog.value = false
    bindingDialog.value = false
  }

  const showCatalogDialog = (type: 'add' | 'edit', row?: any) => {
    docDialog.value = false
    bindingDialog.value = false
    if (type === 'add') {
      Object.assign(catalogForm, { id: undefined, parentId: row?.id ?? 0, name: '', sort: 0 })
    } else {
      Object.assign(catalogForm, {
        id: row.id,
        parentId: row.parentId,
        name: row.name,
        sort: row.sort
      })
    }
    catalogDialog.value = true
  }

  const submitCatalog = async () => {
    if (!catalogForm.name?.trim())
      return ElMessage.warning(t('pages.system.helpDoc.catalogNamePlaceholder'))
    submitting.value = true
    try {
      await fetchSaveHelpCatalog({ ...catalogForm })
      ElMessage.success(t('pages.system.helpDoc.saveSuccess'))
      catalogDialog.value = false
      loadCatalogTree()
    } finally {
      submitting.value = false
    }
  }

  const removeCatalog = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.helpDoc.removeCatalogConfirm', { name: row.name }),
      t('pages.system.helpDoc.removeTitle'),
      { type: 'warning' }
    )
      .then(async () => {
        await fetchRemoveHelpCatalog(row.id)
        ElMessage.success(t('pages.system.helpDoc.removeSuccess'))
        if (selectedCatalog.value?.id === row.id) {
          selectedCatalog.value = null
          docList.value = []
        }
        loadCatalogTree()
      })
      .catch(() => {})
  }

  // ---------------- 文档 ----------------
  const docList = ref<any[]>([])
  const docLoading = ref(false)

  const loadDocs = async () => {
    if (!selectedCatalog.value) return
    docLoading.value = true
    try {
      const page = await fetchHelpDocPage({
        catalogId: selectedCatalog.value.id,
        pageNum: 1,
        pageSize: 100
      })
      docList.value = page?.records || []
    } finally {
      docLoading.value = false
    }
  }

  const docDialog = ref(false)
  const docForm = reactive<any>({
    id: undefined,
    catalogId: undefined,
    title: '',
    content: '',
    sort: 0
  })

  const showDocDialog = async (type: 'add' | 'edit', row?: any) => {
    catalogDialog.value = false
    bindingDialog.value = false
    if (type === 'add') {
      Object.assign(docForm, {
        id: undefined,
        catalogId: selectedCatalog.value.id,
        title: '',
        content: '',
        sort: 0
      })
    } else {
      // 列表不含 content，编辑需拉详情
      const detail = await fetchHelpDocDetail(row.id)
      Object.assign(docForm, {
        id: detail.id,
        catalogId: detail.catalogId,
        title: detail.title,
        content: detail.content || '',
        sort: detail.sort
      })
    }
    docDialog.value = true
  }

  const submitDoc = async () => {
    if (!docForm.title?.trim())
      return ElMessage.warning(t('pages.system.helpDoc.docTitlePlaceholder'))
    submitting.value = true
    try {
      await fetchSaveHelpDoc({ ...docForm })
      ElMessage.success(t('pages.system.helpDoc.saveSuccess'))
      docDialog.value = false
      loadDocs()
    } finally {
      submitting.value = false
    }
  }

  const removeDoc = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.helpDoc.removeDocConfirm', { title: row.title }),
      t('pages.system.helpDoc.removeTitle'),
      { type: 'warning' }
    )
      .then(async () => {
        await fetchRemoveHelpDoc([row.id])
        ElMessage.success(t('pages.system.helpDoc.removeSuccess'))
        loadDocs()
      })
      .catch(() => {})
  }

  // ---------------- 页面绑定 ----------------
  const bindingDialog = ref(false)
  const bindingDocId = ref<any>(null)
  const bindingList = ref<any[]>([])
  const newRoutePath = ref('')

  const loadBindings = async () => {
    bindingList.value = (await fetchHelpBindingList(bindingDocId.value)) || []
  }

  const showBindingDialog = async (row: any) => {
    catalogDialog.value = false
    docDialog.value = false
    bindingDocId.value = row.id
    newRoutePath.value = ''
    await loadBindings()
    bindingDialog.value = true
  }

  const addBinding = async () => {
    const path = newRoutePath.value.trim()
    if (!path) return ElMessage.warning(t('pages.system.helpDoc.routePathRequired'))
    submitting.value = true
    try {
      await fetchSaveHelpBinding({ docId: bindingDocId.value, routePath: path, sort: 0 })
      ElMessage.success(t('pages.system.helpDoc.bindSuccess'))
      newRoutePath.value = ''
      loadBindings()
    } finally {
      submitting.value = false
    }
  }

  const removeBinding = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.helpDoc.unbindConfirm', { path: row.routePath }),
      t('pages.system.helpDoc.unbindTitle'),
      {
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveHelpBinding(row.id)
        ElMessage.success(t('pages.system.helpDoc.unbindSuccess'))
        loadBindings()
      })
      .catch(() => {})
  }

  onDeactivated(() => {
    ElMessageBox.close()
    closeDialogs()
  })

  onMounted(loadCatalogTree)
</script>

<style lang="scss" scoped>
  .help-doc-page {
    .panel-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      .panel-title {
        font-weight: 500;
      }
    }

    .binding-add {
      display: flex;
      gap: 10px;
    }
  }
</style>

<!-- 弹窗内容 teleport 到 body，富文本/绑定列表叠加超高时需非 scoped 类限定滚动（同 notice-dialog 范式），防矮视口下操作按钮挤出视口 -->
<style>
  .help-doc-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
