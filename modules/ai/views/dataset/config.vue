<template>
  <div class="art-full-height">
    <AiNotFound
      v-if="notFound"
      :what="$t('aiDatasetConfig.what')"
      :id="datasetId"
      back-path="/ai/dataset"
      :back-text="$t('aiDatasetConfig.backToList')"
    />
    <ElCard v-else class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.back()">{{ $t('aiDatasetConfig.back') }}</ElButton>
        <h3>{{ $t('aiDatasetConfig.title', { id: datasetId }) }}</h3>
        <ElButton type="primary" :loading="saving" @click="saveTables">{{
          $t('aiDatasetConfig.saveTables')
        }}</ElButton>
      </div>
      <ElTabs v-model="tab">
        <ElTabPane :label="$t('aiDatasetConfig.tabTables')" name="tables">
          <ElForm label-width="88px">
            <ElFormItem :label="$t('aiDatasetConfig.datasource')" required>
              <ElSelect
                v-model="datasourceId"
                filterable
                clearable
                :placeholder="$t('aiDatasetConfig.tablePlaceholder')"
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
            :titles="[$t('aiDatasetConfig.available'), $t('aiDatasetConfig.selected')]"
          />
          <ElForm style="margin-top: 16px" label-width="88px">
            <ElFormItem :label="$t('aiDatasetConfig.semantics')">
              <ElInput
                v-model="bizDesc"
                type="textarea"
                :rows="4"
                :placeholder="$t('aiDatasetConfig.semanticsPlaceholder')"
              />
            </ElFormItem>
          </ElForm>
        </ElTabPane>
        <ElTabPane :label="$t('aiDatasetConfig.tabTerms')" name="terms">
          <div class="toolbar">
            <ElButton type="primary" @click="openTerm()">{{
              $t('aiDatasetConfig.addTerm')
            }}</ElButton>
            <ElButton @click="loadTerms">{{ $t('aiDatasetConfig.refresh') }}</ElButton>
          </div>
          <ArtTable :loading="termLoading" :data="terms" :columns="termCols" />
        </ElTabPane>
      </ElTabs>
    </ElCard>
    <ElDialog v-model="termVisible" :title="$t('aiDatasetConfig.term')" width="480px">
      <ElForm :model="termForm" label-width="auto">
        <ElFormItem :label="$t('aiDatasetConfig.term')" required
          ><ElInput v-model="termForm.name"
        /></ElFormItem>
        <ElFormItem :label="$t('aiDatasetConfig.definition')" required
          ><ElInput v-model="termForm.content" type="textarea" :rows="3"
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="termVisible = false">{{ $t('aiDatasetConfig.cancel') }}</ElButton>
        <ElButton type="primary" @click="saveTerm">{{ $t('aiDatasetConfig.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref } from 'vue'
  import AiNotFound from '../shared/AiNotFound.vue'
  import { useRoute } from 'vue-router'
  import { ElButton, ElMessageBox } from 'element-plus'
  import {
    fetchAiDatasourcePage,
    fetchAiDatasourceTables,
    fetchAiTerminologyPage,
    fetchDatasetTables,
    fetchRemoveAiTerminology,
    fetchSaveAiTerminology,
    fetchSaveDatasetTables,
    aiDatasetExists
  } from '../../api'
  defineOptions({ name: 'AiDatasetConfig' })
  const { t } = useI18n()
  /** id 不存在或已删除时只显示占位与返回入口（UX-105） */
  const notFound = ref(false)
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
  const termCols = computed<ColumnOption[]>(() => [
    { prop: 'name', label: t('aiDatasetConfig.term'), minWidth: 120 },
    { prop: 'content', label: t('aiDatasetConfig.definition'), minWidth: 200 },
    {
      prop: 'operation',
      label: t('aiDatasetConfig.colActions'),
      width: 140,
      formatter: (row: any) =>
        h('div', [
          h(ElButton, { link: true, size: 'small', onClick: () => openTerm(row) }, () =>
            t('aiDatasetConfig.edit')
          ),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => rmTerm(row) },
            () => t('aiDatasetConfig.delete')
          )
        ])
    }
  ])
  async function loadDatasources() {
    const res = await fetchAiDatasourcePage({ pageNum: 1, pageSize: 100 })
    datasources.value = res?.records ?? []
  }
  async function loadSchema() {
    tableOptions.value = []
    if (!datasourceId.value) return
    try {
      const schema: any = await fetchAiDatasourceTables(datasourceId.value)
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
        t('aiDatasetConfig.removeConfirm', { name: row.name || '' }),
        t('aiDatasetConfig.confirmTitle')
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
    if (!(await aiDatasetExists(datasetId.value))) {
      notFound.value = true
      return
    }
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
