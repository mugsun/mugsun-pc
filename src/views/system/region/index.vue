<!-- 行政区划页（懒加载树 + 导入导出，对接 /system/region） -->
<template>
  <div class="region-page art-full-height">
    <ElCard class="art-table-card">
      <div class="region-toolbar">
        <ElButton v-perm="'sys:region:save'" type="primary" @click="showDialog(null)">{{
          $t('pages.system.region.addProvince')
        }}</ElButton>
        <ElButton :loading="exporting" @click="doExport">{{
          $t('pages.system.region.export')
        }}</ElButton>
        <ElButton v-perm="'sys:region:import'" :loading="importing" @click="triggerImport">{{
          $t('pages.system.region.import')
        }}</ElButton>
        <input ref="fileInput" type="file" accept=".xlsx" style="display: none" @change="onFile" />
      </div>

      <ElTable
        v-loading="loading"
        :key="tableKey"
        :data="tableData"
        row-key="code"
        border
        lazy
        :load="loadChildren"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      >
        <ElTableColumn prop="name" :label="$t('pages.system.region.fields.name')" min-width="220" />
        <ElTableColumn prop="code" :label="$t('pages.system.region.fields.code')" min-width="140" />
        <ElTableColumn :label="$t('pages.system.region.fields.level')" width="100">
          <template #default="{ row }">{{ levelText(row.level) }}</template>
        </ElTableColumn>
        <ElTableColumn
          :label="$t('pages.system.region.fields.operation')"
          width="200"
          fixed="right"
        >
          <template #default="{ row }">
            <ElButton
              v-if="row.level < 3"
              v-perm="'sys:region:save'"
              link
              type="primary"
              @click="showDialog(row)"
            >
              {{ $t('pages.system.region.addChild') }}
            </ElButton>
            <ElButton v-perm="'sys:region:remove'" link type="danger" @click="remove(row)">{{
              $t('pages.system.region.delete')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog
      v-if="dialogVisible"
      v-model="dialogVisible"
      :title="$t('pages.system.region.addRegion')"
      width="460px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.region.fields.parent')">
          <ElInput :model-value="parentName" disabled />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.region.fields.name')" prop="name">
          <ElInput v-model="form.name" :placeholder="$t('pages.system.region.placeholder.name')" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.region.fields.code')" prop="code">
          <ElInput v-model="form.code" :placeholder="$t('pages.system.region.placeholder.code')" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="dialogSaving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" :disabled="dialogSaving" @click="submit">{{
          $t('table.form.submit')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onDeactivated } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    fetchRegionLazyTree,
    fetchSaveRegion,
    fetchRemoveRegion,
    exportRegion,
    importRegion
  } from '@/api/system-manage'
  import { ElMessage, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'Region' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const tableKey = ref(0)
  const loading = ref(false)
  const importing = ref(false)
  const exporting = ref(false)
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const parentName = ref(t('pages.system.region.topLevel'))
  const formRef = ref<FormInstance>()
  const fileInput = ref<HTMLInputElement>()
  const parentRow = ref<any>(null)

  const form = reactive<Record<string, any>>({ name: '', code: '', parentCode: '0', level: 1 })

  const rules = computed<FormRules>(() => ({
    name: [{ required: true, message: t('pages.system.region.placeholder.name'), trigger: 'blur' }],
    code: [{ required: true, message: t('pages.system.region.placeholder.code'), trigger: 'blur' }]
  }))

  const levelText = (l: number): string =>
    ({
      1: t('pages.system.region.levels.province'),
      2: t('pages.system.region.levels.city'),
      3: t('pages.system.region.levels.district')
    })[l] || String(l)

  const mapNodes = (list: any[]): any[] => list.map((r) => ({ ...r, hasChildren: !r.leaf }))

  const loadRoot = async (): Promise<void> => {
    loading.value = true
    try {
      tableData.value = mapNodes((await fetchRegionLazyTree('0')) || [])
      tableKey.value++
    } finally {
      loading.value = false
    }
  }

  const loadChildren = async (
    row: any,
    _node: any,
    resolve: (data: any[]) => void
  ): Promise<void> => {
    const children = mapNodes((await fetchRegionLazyTree(row.code)) || [])
    resolve(children)
  }

  onMounted(loadRoot)

  onDeactivated(() => {
    dialogVisible.value = false
    ElMessageBox.close()
  })

  const showDialog = (row: any): void => {
    parentRow.value = row
    parentName.value = row ? row.name : t('pages.system.region.topLevel')
    Object.assign(form, {
      name: '',
      code: '',
      parentCode: row ? row.code : '0',
      level: row ? row.level + 1 : 1
    })
    dialogVisible.value = true
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value || dialogSaving.value) return
    try {
      await formRef.value.validate()
    } catch {
      return
    }
    dialogSaving.value = true
    try {
      await fetchSaveRegion({ ...form })
      dialogVisible.value = false
      ElMessage.success(t('pages.system.region.saveSuccess'))
      await loadRoot()
    } finally {
      dialogSaving.value = false
    }
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.region.deleteConfirm', { name: row.name }),
      t('pages.system.region.deleteRegion'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveRegion(row.id)
        ElMessage.success(t('pages.system.region.deleteSuccess'))
        loadRoot()
      })
      .catch(() => {})
  }

  const doExport = async (): Promise<void> => {
    exporting.value = true
    try {
      await exportRegion()
      ElMessage.success(t('pages.system.region.exportSuccess'))
    } finally {
      exporting.value = false
    }
  }

  const triggerImport = (): void => fileInput.value?.click()

  const onFile = async (e: Event): Promise<void> => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    importing.value = true
    try {
      const count = await importRegion(file)
      ElMessage.success(t('pages.system.region.importSuccess', { count }))
      loadRoot()
    } finally {
      importing.value = false
      // 无论成败都清空选择，导入失败后重选同一文件才能再次触发 change
      input.value = ''
    }
  }
</script>

<style scoped>
  /* 懒加载树为自由增长内容：art-full-height 定高 + art-table-card 卡体 overflow:hidden 裁剪，
     卡片取消 flex 拉伸随内容增高、页面自备纵向滚动（track/funnel 同款范式），矮视口下行不被切断 */
  .region-page {
    overflow-y: auto;
  }

  .region-page .art-table-card {
    flex: none;
  }

  .region-toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }
</style>
