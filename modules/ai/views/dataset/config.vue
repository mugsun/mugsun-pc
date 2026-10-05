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
          <ElForm label-width="88px">
            <ElFormItem label="数据源" required>
              <ElSelect
                v-model="datasourceId"
                filterable
                clearable
                placeholder="先选数据源，再选表"
                style="width: 360px"
                @change="loadSchema"
              >
                <ElOption
                  v-for="item in datasources"
                  :key="item.id"
                  :label="item.name"
                  :value="String(item.id)"
                />
              </ElSelect>
            </ElFormItem>
          </ElForm>
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
        <ElFormItem label="术语" required><ElInput v-model="termForm.name" /></ElFormItem>
        <ElFormItem label="释义" required
          ><ElInput v-model="termForm.content" type="textarea" :rows="3"
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
  import { ElButton, ElMessageBox } from 'element-plus'
  import {
    fetchAiDatasourcePage,
    fetchAiDatasourceTables,
    fetchAiTerminologyPage,
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
  const datasources = ref<any[]>([])
  const datasourceId = ref('')
  const bizDesc = ref('')
  const termLoading = ref(false)
  const terms = ref<any[]>([])
  const termVisible = ref(false)
  const termForm = reactive<Record<string, any>>({})
  const termCols: ColumnOption[] = [
    { prop: 'name', label: '术语', minWidth: 120 },
    { prop: 'content', label: '释义', minWidth: 200 },
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
  async function loadDatasources() {
    const res = await fetchAiDatasourcePage({ pageNum: 1, pageSize: 100 })
    datasources.value = res?.records ?? []
  }
  async function loadSchema() {
    tableOptions.value = []
    if (!datasourceId.value) return
    try {
      const schema = await fetchAiDatasourceTables(datasourceId.value)
      const tables = Array.isArray(schema) ? schema : schema?.tables || []
      tableOptions.value = (tables as any[]).map((t) => ({
        key: typeof t === 'string' ? t : t.name || t.tableName,
        label:
          typeof t === 'string'
            ? t
            : t.comment
              ? `${t.name || t.tableName}（${t.comment}）`
              : t.name || t.tableName
      }))
    } catch {
      tableOptions.value = []
    }
  }
  async function load() {
    const cfg = await fetchDatasetTables(datasetId.value)
    selectedTables.value = cfg?.tables || cfg?.selected || []
    bizDesc.value = cfg?.bizDesc || ''
    datasourceId.value = cfg?.datasourceId ? String(cfg.datasourceId) : ''
    await loadSchema()
  }
  async function saveTables() {
    saving.value = true
    try {
      await fetchSaveDatasetTables({
        id: datasetId.value,
        datasourceId: datasourceId.value || undefined,
        tables: selectedTables.value,
        bizDesc: bizDesc.value
      })
    } finally {
      saving.value = false
    }
  }
  async function loadTerms() {
    termLoading.value = true
    try {
      const res = await fetchAiTerminologyPage({ datasetId: datasetId.value })
      terms.value = Array.isArray(res) ? res : []
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
    try {
      await fetchSaveAiTerminology({ ...termForm, datasetId: datasetId.value })
    } catch {
      return
    }
    termVisible.value = false
    await loadTerms()
  }
  async function rmTerm(row: any) {
    try {
      await ElMessageBox.confirm(
        `确定删除术语「${row.name || ''}」吗？问数时不会再带上它。`,
        '确认'
      )
    } catch {
      return
    }
    try {
      await fetchRemoveAiTerminology(datasetId.value, row.id)
    } catch {
      return
    }
    await loadTerms()
  }
  onMounted(async () => {
    await loadDatasources()
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
