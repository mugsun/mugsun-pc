<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.back()">返回</ElButton>
        <h3>问数配置 #{{ datasetId }}</h3>
        <ElButton type="primary" :loading="saving" @click="saveTables">保存表配置</ElButton>
      </div>
      <ElTabs v-model="tab">
        <ElTabPane label="数据表" name="tables">
          <ElTransfer
            v-model="selectedTables"
            :data="tableOptions"
            filterable
            :titles="['可选表', '已选表']"
          />
          <ElForm style="margin-top: 16px" label-width="88px">
            <ElFormItem label="业务语义">
              <ElInput
                v-model="bizDesc"
                type="textarea"
                :rows="4"
                placeholder="描述业务口径、指标定义"
              />
            </ElFormItem>
          </ElForm>
        </ElTabPane>
        <ElTabPane label="术语库" name="terms">
          <div class="toolbar">
            <ElButton type="primary" @click="openTerm()">新增术语</ElButton>
            <ElButton @click="loadTerms">刷新</ElButton>
          </div>
          <ArtTable :loading="termLoading" :data="terms" :columns="termCols" />
        </ElTabPane>
      </ElTabs>
    </ElCard>
    <ElDialog v-model="termVisible" title="术语" width="480px">
      <ElForm :model="termForm" label-width="80px">
        <ElFormItem label="术语" required><ElInput v-model="termForm.term" /></ElFormItem>
        <ElFormItem label="释义" required
          ><ElInput v-model="termForm.definition" type="textarea" :rows="3"
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="termVisible = false">取消</ElButton>
        <ElButton type="primary" @click="saveTerm">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiTerminologyPage,
    fetchDatasetSchema,
    fetchDatasetTables,
    fetchRemoveAiTerminology,
    fetchSaveAiTerminology,
    fetchSaveDatasetTables
  } from '../../api'
  defineOptions({ name: 'AiDatasetConfig' })
  const route = useRoute()
  const datasetId = computed(() => route.params.id as string)
  const tab = ref('tables')
  const saving = ref(false)
  const selectedTables = ref<string[]>([])
  const tableOptions = ref<{ key: string; label: string }[]>([])
  const bizDesc = ref('')
  const termLoading = ref(false)
  const terms = ref<any[]>([])
  const termVisible = ref(false)
  const termForm = reactive<Record<string, any>>({})
  const termCols: ColumnOption[] = [
    { prop: 'term', label: '术语', minWidth: 120 },
    { prop: 'definition', label: '释义', minWidth: 200 },
    {
      prop: 'operation',
      label: '操作',
      width: 140,
      formatter: (row: any) =>
        h('div', [
          h(ElButton, { link: true, size: 'small', onClick: () => openTerm(row) }, () => '编辑'),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => rmTerm(row) },
            () => '删除'
          )
        ])
    }
  ]
  async function load() {
    const cfg = await fetchDatasetTables(datasetId.value)
    selectedTables.value = cfg?.tables || cfg?.selected || []
    bizDesc.value = cfg?.bizDesc || ''
    const dsId = cfg?.datasourceId
    if (dsId) {
      const schema = await fetchDatasetSchema(dsId)
      const tables = schema?.tables || schema || []
      tableOptions.value = (tables as any[]).map((t) => ({
        key: typeof t === 'string' ? t : t.name,
        label: typeof t === 'string' ? t : t.comment ? `${t.name}（${t.comment}）` : t.name
      }))
    }
  }
  async function saveTables() {
    saving.value = true
    try {
      await fetchSaveDatasetTables({
        id: datasetId.value,
        tables: selectedTables.value,
        bizDesc: bizDesc.value
      })
      ElMessage.success('已保存')
    } finally {
      saving.value = false
    }
  }
  async function loadTerms() {
    termLoading.value = true
    try {
      const res = await fetchAiTerminologyPage({
        pageNum: 1,
        pageSize: 100,
        datasetId: datasetId.value
      })
      terms.value = res?.records ?? []
    } finally {
      termLoading.value = false
    }
  }
  function openTerm(row?: any) {
    Object.keys(termForm).forEach((k) => delete termForm[k])
    Object.assign(termForm, row ? { ...row } : { datasetId: datasetId.value })
    termVisible.value = true
  }
  async function saveTerm() {
    await fetchSaveAiTerminology({ ...termForm, datasetId: datasetId.value })
    termVisible.value = false
    await loadTerms()
  }
  async function rmTerm(row: any) {
    await ElMessageBox.confirm('删除该术语？', '确认')
    await fetchRemoveAiTerminology(row.id)
    await loadTerms()
  }
  onMounted(async () => {
    await load()
    await loadTerms()
  })
</script>
<style scoped>
  .hd {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }

  .hd h3 {
    flex: 1;
    margin: 0;
    font-size: 16px;
  }

  .toolbar {
    margin-bottom: 12px;
  }
</style>
