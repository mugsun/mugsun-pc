<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="appType" @tab-change="reload">
        <ElTabPane label="全部" name="" />
        <ElTabPane label="工作流" name="workflow" />
        <ElTabPane label="文本生成" name="text" />
        <ElTabPane label="对话助手" name="chat" />
        <ElTabPane label="对话流程" name="chatflow" />
      </ElTabs>
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索应用"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">新建应用</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title"
            >{{ row.name }}
            <ElTag size="small">{{ typeLabel(row.appType) }}</ElTag>
          </div>
          <div class="desc">{{ row.description || '暂无描述' }}</div>
          <div class="ops">
            <ElButton link type="primary" @click="design(row)">编排</ElButton>
            <ElButton link @click="openEdit(row)">编辑</ElButton>
            <ElButton link @click="copy(row)">复制</ElButton>
            <ElButton link @click="doExport(row)">导出</ElButton>
            <ElButton link type="danger" @click="remove(row)">删除</ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" description="暂无应用" />
      </div>
    </ElCard>
    <ElDialog v-model="visible" :title="form.id ? '编辑应用' : '新建应用'" width="560px">
      <ElForm :model="form" label-width="88px">
        <ElFormItem label="名称" required><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="类型" required>
          <ElSelect v-model="form.appType" style="width: 100%">
            <ElOption label="工作流" value="workflow" /><ElOption label="文本生成" value="text" />
            <ElOption label="对话助手" value="chat" /><ElOption label="对话流程" value="chatflow" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="描述"
          ><ElInput
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiAppPage,
    fetchCopyAiApp,
    fetchExportAiApp,
    fetchRemoveAiApp,
    fetchSaveAiApp
  } from '../../api'
  defineOptions({ name: 'AiApp' })
  const router = useRouter()
  const appType = ref('')
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  function typeLabel(t: string) {
    return (
      ({ workflow: '工作流', text: '文本生成', chat: '对话助手', chatflow: '对话流程' } as any)[
        t
      ] || t
    )
  }
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiAppPage({
        pageNum: 1,
        pageSize: 50,
        appType: appType.value || undefined,
        name: keyword.value || undefined
      })
      records.value = res?.records ?? []
    } finally {
      loading.value = false
    }
  }
  function design(row: any) {
    router.push(`/ai/app/design/${row.id}`)
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { appType: appType.value || 'workflow' })
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await fetchSaveAiApp({ ...form })
      ElMessage.success('已保存')
      visible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }
  async function copy(row: any) {
    await fetchCopyAiApp(row.id)
    ElMessage.success('已复制')
    await reload()
  }
  async function doExport(row: any) {
    await fetchExportAiApp(row.id)
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除应用「${row.name}」？`, '确认')
    await fetchRemoveAiApp(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    gap: 8px;
    margin: 8px 0 12px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .title {
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .desc {
    min-height: 40px;
    margin-top: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .ops {
    margin-top: 10px;
  }
</style>
