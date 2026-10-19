<template>
  <div class="ai-prompt-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="category" @tab-change="reload">
        <ElTabPane :label="$t('aiPromptList.tabAll')" name="" />
        <ElTabPane :label="$t('aiPromptList.catChat')" name="chat" />
        <ElTabPane :label="$t('aiPromptList.catContent')" name="content" />
        <ElTabPane :label="$t('aiPromptList.catAnalyze')" name="analyze" />
        <ElTabPane :label="$t('aiPromptList.catCreative')" name="creative" />
      </ElTabs>
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiPromptList.searchPlaceholder')"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">{{ $t('aiPromptList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiPromptList.add') }}</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title"
            >{{ row.name }}
            <ElTag size="small">{{ categoryLabel(row.category) }}</ElTag>
            <ElTag size="small" effect="plain">v{{ row.version || 1 }}</ElTag>
          </div>
          <div class="scene">{{ row.scene || '-' }}</div>
          <div class="summary"
            >{{ (row.content || '').slice(0, 80)
            }}{{ (row.content || '').length > 80 ? '…' : '' }}</div
          >
          <div class="ops">
            <ElButton link type="primary" @click="openEdit(row)">{{
              $t('aiPromptList.edit')
            }}</ElButton>
            <ElButton link @click="optimize(row)">{{ $t('aiPromptList.optimize') }}</ElButton>
            <ElButton link @click="copyContent(row)">{{ $t('aiPromptList.copyContent') }}</ElButton>
            <ElButton link type="danger" @click="remove(row)">{{
              $t('aiPromptList.delete')
            }}</ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" :description="emptyText" />
      </div>
      <ElPagination
        class="pager"
        v-model:current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="reload"
      />
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="form.id ? $t('aiForm.editPrompt') : $t('aiForm.addPrompt')"
      width="720px"
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.name')" prop="name" :rules="requiredRule($t('aiForm.name'))"
          ><ElInput v-model="form.name"
        /></ElFormItem>
        <ElFormItem
          :label="$t('aiForm.category')"
          prop="category"
          :rules="requiredRule($t('aiForm.category'), true)"
        >
          <ElSelect v-model="form.category" style="width: 100%">
            <ElOption :label="$t('aiForm.optCatChat')" value="chat" />
            <ElOption :label="$t('aiForm.optCatContent')" value="content" />
            <ElOption :label="$t('aiForm.optCatAnalyze')" value="analyze" />
            <ElOption :label="$t('aiForm.optCatCreative')" value="creative" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.scene')"><ElInput v-model="form.scene" /></ElFormItem>
        <ElFormItem
          :label="$t('aiForm.content')"
          prop="content"
          :rules="requiredRule($t('aiForm.content'))"
        >
          <ElInput
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="8000"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.status')"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.remark')"><ElInput v-model="form.remark" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="optVisible" :title="$t('aiForm.optimizePrompt')" width="800px">
      <div class="opt-grid">
        <div
          ><div class="lab">{{ $t('aiForm.original') }}</div
          ><ElInput :model-value="optOrigin" type="textarea" :rows="12" readonly
        /></div>
        <div
          ><div class="lab">{{ $t('aiForm.optimized') }}</div
          ><ElInput v-model="optResult" type="textarea" :rows="12"
        /></div>
      </div>
      <template #footer>
        <ElButton @click="optVisible = false">{{ $t('aiForm.close') }}</ElButton>
        <ElButton type="primary" :disabled="!optResult" @click="adoptOptimize">{{
          $t('aiForm.adoptAndSave')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance } from 'element-plus'
  import { requiredRule } from '../shared/formRules'
  import { computed, onMounted, reactive, ref, nextTick } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiPromptPage,
    fetchOptimizeAiPrompt,
    fetchRemoveAiPrompt,
    fetchSaveAiPrompt
  } from '../../api'
  defineOptions({ name: 'AiPrompt' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const category = ref('')
  const keyword = ref('')
  const searching = ref(false)
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(12)
  const total = ref(0)
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  const optVisible = ref(false)
  const optOrigin = ref('')
  const optResult = ref('')
  const optRow = ref<any>(null)

  const emptyText = computed(() =>
    searching.value ? t('aiPromptList.emptySearched') : t('aiPromptList.empty')
  )
  function categoryLabel(value: string) {
    return (
      (
        {
          chat: t('aiPromptList.catChat'),
          content: t('aiPromptList.catContent'),
          analyze: t('aiPromptList.catAnalyze'),
          creative: t('aiPromptList.catCreative')
        } as any
      )[value] || value
    )
  }
  async function reload() {
    loading.value = true
    searching.value = !!keyword.value.trim()
    try {
      const res = await fetchAiPromptPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: keyword.value.trim() || undefined,
        category: category.value || undefined
      })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { category: category.value || 'chat', status: 1 })
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      await fetchSaveAiPrompt({ ...form })
      visible.value = false
      await reload()
    } catch {
      /* 失败提示由请求层展示，弹窗留着方便改完再存 */
    } finally {
      saving.value = false
    }
  }
  async function optimize(row: any) {
    optRow.value = row
    optOrigin.value = row.content || ''
    optResult.value = ''
    optVisible.value = true
    const r = await fetchOptimizeAiPrompt({ id: row.id, content: row.content })
    optResult.value = r?.content || r?.result || (typeof r === 'string' ? r : '')
  }
  async function adoptOptimize() {
    if (!optRow.value) return
    await fetchSaveAiPrompt({ id: optRow.value.id, content: optResult.value })
    optVisible.value = false
    await reload()
  }
  async function copyContent(row: any) {
    await navigator.clipboard.writeText(row.content || '')
    ElMessage.success(t('aiPromptList.copied'))
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      t('aiPromptList.removeConfirm', { name: row.name }),
      t('aiPromptList.confirmTitle')
    )
    await fetchRemoveAiPrompt(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 12px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    min-height: 160px;
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .scene {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .summary {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-regular);
  }

  .ops {
    margin-top: 10px;
  }

  .pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .opt-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .lab {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
  }
</style>
