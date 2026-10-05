<template>
  <div class="ai-prompt-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="category" @tab-change="reload">
        <ElTabPane label="全部" name="" />
        <ElTabPane label="对话类" name="chat" />
        <ElTabPane label="内容生成类" name="content" />
        <ElTabPane label="分析处理类" name="analyze" />
        <ElTabPane label="创意设计类" name="creative" />
      </ElTabs>
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="按名称搜索"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">添加提示词</ElButton>
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
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link @click="optimize(row)">优化</ElButton>
            <ElButton link @click="copyContent(row)">复制内容</ElButton>
            <ElButton link type="danger" @click="remove(row)">删除</ElButton>
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
      :title="form.id ? '编辑提示词' : '添加提示词'"
      width="720px"
      destroy-on-close
    >
      <ElForm :model="form" label-width="88px">
        <ElFormItem label="名称" required><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="分类" required>
          <ElSelect v-model="form.category" style="width: 100%">
            <ElOption label="对话类" value="chat" />
            <ElOption label="内容生成类" value="content" />
            <ElOption label="分析处理类" value="analyze" />
            <ElOption label="创意设计类" value="creative" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="场景"><ElInput v-model="form.scene" /></ElFormItem>
        <ElFormItem label="内容" required>
          <ElInput
            v-model="form.content"
            type="textarea"
            :rows="6"
            maxlength="8000"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="状态"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="optVisible" title="优化提示词" width="800px">
      <div class="opt-grid">
        <div
          ><div class="lab">原文</div
          ><ElInput :model-value="optOrigin" type="textarea" :rows="12" readonly
        /></div>
        <div
          ><div class="lab">优化结果</div><ElInput v-model="optResult" type="textarea" :rows="12"
        /></div>
      </div>
      <template #footer>
        <ElButton @click="optVisible = false">关闭</ElButton>
        <ElButton type="primary" :disabled="!optResult" @click="adoptOptimize">采纳并保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiPromptPage,
    fetchOptimizeAiPrompt,
    fetchRemoveAiPrompt,
    fetchSaveAiPrompt
  } from '../../api'
  defineOptions({ name: 'AiPrompt' })
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
    searching.value ? '没有符合条件的提示词。换个名称再查' : '还没有提示词。点添加提示词开始写'
  )
  function categoryLabel(value: string) {
    return (
      (
        {
          chat: '对话类',
          content: '内容生成类',
          analyze: '分析处理类',
          creative: '创意设计类'
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
  }
  async function save() {
    saving.value = true
    try {
      await fetchSaveAiPrompt({ ...form })
      visible.value = false
      await reload()
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
    ElMessage.success('已复制')
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除「${row.name}」后，列表里不会再出现。正文也会一起清掉`, '确认')
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
