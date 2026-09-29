<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索知识库"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">新建知识库</ElButton>
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
              row.status === 1 ? '启用' : '停用'
            }}</ElTag>
          </div>
          <div class="meta"
            >文档 {{ row.docCount ?? 0 }} · 分段 {{ row.segmentCount ?? 0 }} ·
            {{ row.retrievalMode || 'hybrid' }}</div
          >
          <div class="desc">{{ row.description || '暂无描述' }}</div>
          <div class="ops" @click.stop>
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link @click="copy(row)">复制</ElButton>
            <ElButton link @click="test(row)">测试</ElButton>
            <ElButton link type="danger" @click="remove(row)">删除</ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" description="暂无知识库" />
      </div>
    </ElCard>

    <ElDialog v-model="visible" :title="form.id ? '编辑知识库' : '新建知识库'" width="560px">
      <ElForm :model="form" label-width="110px">
        <ElFormItem label="名称" required
          ><ElInput v-model="form.name" placeholder="如：客户支持知识库"
        /></ElFormItem>
        <ElFormItem label="描述"
          ><ElInput
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="用途说明，便于团队识别"
        /></ElFormItem>
        <ElFormItem label="Embedding">
          <ElSelect
            v-model="form.embeddingModelId"
            clearable
            filterable
            placeholder="选择向量模型"
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
        <ElFormItem label="检索模式">
          <ElSelect v-model="form.retrievalMode" style="width: 100%">
            <ElOption label="混合检索 (hybrid)" value="hybrid" />
            <ElOption label="向量检索 (vector)" value="vector" />
            <ElOption label="关键词 (keyword)" value="keyword" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="TopK"
          ><ElInputNumber v-model="form.topK" :min="1" :max="20"
        /></ElFormItem>
        <ElFormItem label="最低分"
          ><ElInputNumber v-model="form.minScore" :min="0" :max="1" :step="0.05" :precision="2"
        /></ElFormItem>
        <ElFormItem label="状态"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="testVisible" title="知识库命中测试" width="720px">
      <div class="test-q">问题：{{ testQuery }}</div>
      <ElTable :data="testHits" max-height="400" empty-text="未命中">
        <ElTableColumn label="分数" width="100">
          <template #default="{ row }">{{ Number(row.score ?? 0).toFixed(3) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="source" label="来源" width="140" show-overflow-tooltip />
        <ElTableColumn prop="content" label="内容" min-width="360" show-overflow-tooltip />
      </ElTable>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
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
  const router = useRouter()
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
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
  }
  async function save() {
    if (!form.name?.trim()) {
      ElMessage.warning('请填写名称')
      return
    }
    saving.value = true
    try {
      await fetchSaveAiKnowledge({ ...form })
      ElMessage.success('已保存')
      visible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }
  async function copy(row: any) {
    const r = await fetchCopyAiKnowledge(row.id)
    ElMessage.success(`已复制为「${r?.name || '副本'}」`)
    await reload()
  }
  async function test(row: any) {
    const { value } = await ElMessageBox.prompt('输入测试问题', `测试 · ${row.name}`, {
      inputValue: '如何创建知识库？',
      confirmButtonText: '测试'
    }).catch(() => ({ value: '' }))
    if (!value) return
    const r = await fetchTestAiKnowledge({ id: row.id, query: value })
    testQuery.value = value
    testHits.value = Array.isArray(r?.hits) ? r.hits : []
    testVisible.value = true
    ElMessage.success(r?.message || `命中 ${testHits.value.length} 条`)
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除知识库「${row.name}」？相关资料与向量将一并清除。`, '确认')
    await fetchRemoveAiKnowledge(row.id)
    ElMessage.success('已删除')
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
