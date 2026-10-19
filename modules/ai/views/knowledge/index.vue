<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiKbList.searchPlaceholder')"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">{{ $t('aiKbList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiKbList.add') }}</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard
          v-for="row in records"
          :key="row.id"
          shadow="hover"
          class="kb-card"
          @click="goDetail(row)"
        >
          <div class="title">
            {{ row.name }}
            <ElTag :type="row.status === 1 ? 'success' : 'info'" size="small">{{
              row.status === 1 ? $t('aiKbList.enabled') : $t('aiKbList.disabled')
            }}</ElTag>
          </div>
          <div class="meta"
            >{{ $t('aiKbList.meta', { docs: row.docCount ?? 0, segs: row.segmentCount ?? 0 }) }}
            {{ modeLabel(row.retrievalMode) }}</div
          >
          <div class="desc">{{ row.description || $t('aiKbList.noDescription') }}</div>
          <div class="ops" @click.stop>
            <ElButton link type="primary" @click="openEdit(row)">{{
              $t('aiKbList.edit')
            }}</ElButton>
            <ElButton link @click="copy(row)">{{ $t('aiKbList.copy') }}</ElButton>
            <ElButton link @click="test(row)">{{ $t('aiKbList.test') }}</ElButton>
            <ElButton link type="danger" @click="remove(row)">{{ $t('aiKbList.delete') }}</ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" :description="emptyText" />
      </div>
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="form.id ? $t('aiForm.editKnowledge') : $t('aiForm.newKnowledge')"
      width="560px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.name')" prop="name" :rules="requiredRule($t('aiForm.name'))"
          ><ElInput v-model="form.name" :placeholder="$t('aiForm.phKnowledgeName')"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.description')"
          ><ElInput
            v-model="form.description"
            type="textarea"
            :rows="3"
            :placeholder="$t('aiForm.phKnowledgeDesc')"
        /></ElFormItem>
        <ElFormItem label="Embedding">
          <ElSelect
            v-model="form.embeddingModelId"
            clearable
            filterable
            :placeholder="$t('aiForm.phEmbeddingModel')"
            style="width: 100%"
          >
            <ElOption
              v-for="m in embedModels"
              :key="m.id"
              :label="m.modelName || m.name"
              :value="m.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.retrievalMode')">
          <ElSelect v-model="form.retrievalMode" style="width: 100%">
            <ElOption :label="$t('aiForm.optHybrid')" value="hybrid" />
            <ElOption :label="$t('aiForm.optVector')" value="vector" />
            <ElOption :label="$t('aiForm.optKeyword')" value="keyword" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="TopK"
          ><ElInputNumber v-model="form.topK" :min="1" :max="20"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.minScore')"
          ><ElInputNumber v-model="form.minScore" :min="0" :max="1" :step="0.05" :precision="2"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.status')"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="testVisible" :title="$t('aiForm.knowledgeHitTest')" width="720px">
      <div class="test-q">{{ $t('aiForm.questionPrefix') }}{{ testQuery }}</div>
      <ElTable :data="testHits" max-height="400" :empty-text="$t('aiForm.noHits')">
        <ElTableColumn :label="$t('aiForm.score')" width="100">
          <template #default="{ row }">{{ Number(row.score ?? 0).toFixed(3) }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="source"
          :label="$t('aiForm.source')"
          width="140"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="content"
          :label="$t('aiForm.content')"
          min-width="360"
          show-overflow-tooltip
        />
      </ElTable>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance } from 'element-plus'
  import { requiredRule } from '../shared/formRules'
  import { computed, onMounted, reactive, ref, nextTick } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiKnowledgePage,
    fetchAiModelPage,
    fetchCopyAiKnowledge,
    fetchRemoveAiKnowledge,
    fetchSaveAiKnowledge,
    fetchTestAiKnowledge
  } from '../../api'
  defineOptions({ name: 'AiKnowledge' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const router = useRouter()
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  const searching = ref(false)
  const emptyText = computed(() =>
    searching.value ? t('aiKbList.emptySearched') : t('aiKbList.empty')
  )
  function modeLabel(mode?: string) {
    if (mode === 'vector') return t('aiKbList.modeVector')
    if (mode === 'keyword') return t('aiKbList.modeKeyword')
    return t('aiKbList.modeHybrid')
  }
  const embedModels = ref<any[]>([])
  const testVisible = ref(false)
  const testQuery = ref('')
  const testHits = ref<any[]>([])

  async function loadEmbedModels() {
    try {
      const res = await fetchAiModelPage({ pageNum: 1, pageSize: 50, modelType: 'embedding' })
      embedModels.value = res?.records ?? []
    } catch {
      embedModels.value = []
    }
  }
  async function reload() {
    loading.value = true
    searching.value = !!keyword.value.trim()
    try {
      const res = await fetchAiKnowledgePage({
        pageNum: 1,
        pageSize: 50,
        name: keyword.value || undefined
      })
      records.value = res?.records ?? []
    } finally {
      loading.value = false
    }
  }
  function goDetail(row: any) {
    // 雪花 ID 必须按字符串传，避免 Number 精度丢失；用 name 导航绕开 keepAlive 列表页抢路由
    router.push({ name: 'AiKnowledgeDetail', params: { id: String(row.id) } })
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(
      form,
      row
        ? { ...row }
        : {
            status: 1,
            retrievalMode: 'hybrid',
            topK: 6,
            minScore: 0.35,
            embeddingModelId: embedModels.value[0]?.id
          }
    )
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      await fetchSaveAiKnowledge({ ...form })
      visible.value = false
      await reload()
    } catch {
      /* 失败文案由请求层弹出，弹窗留着方便改 */
    } finally {
      saving.value = false
    }
  }
  async function copy(row: any) {
    try {
      await fetchCopyAiKnowledge(row.id)
      await reload()
    } catch {
      /* 失败文案由请求层弹出 */
    }
  }
  async function test(row: any) {
    const { value } = await ElMessageBox.prompt(
      t('aiKbList.testPrompt'),
      t('aiKbList.testTitle', { name: row.name }),
      {
        inputValue: t('aiKbList.testDefault'),
        confirmButtonText: t('aiKbList.test')
      }
    ).catch(() => ({ value: '' }))
    if (!value) return
    const r = await fetchTestAiKnowledge({ id: row.id, query: value })
    testQuery.value = value
    testHits.value = Array.isArray(r?.hits) ? r.hits : []
    testVisible.value = true
    const message =
      r?.message || (testHits.value.length ? t('aiKbList.hits', { n: testHits.value.length }) : '')
    if (testHits.value.length) ElMessage.success(message)
    else ElMessage.warning(message || t('aiKbList.noHits'))
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      t('aiKbList.removeConfirm', { name: row.name }),
      t('aiKbList.confirmTitle')
    )
    await fetchRemoveAiKnowledge(row.id)
    await reload()
  }
  onMounted(async () => {
    await loadEmbedModels()
    await reload()
  })
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .kb-card {
    cursor: pointer;
  }

  .title {
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .meta {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .desc {
    min-height: 40px;
    margin-top: 8px;
    font-size: 13px;
  }

  .ops {
    margin-top: 10px;
  }

  .test-q {
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
</style>
