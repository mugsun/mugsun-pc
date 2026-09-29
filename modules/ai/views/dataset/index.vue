<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索问数智能体"
          style="width: 220px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">新建</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title">{{ row.name }}</div>
          <div class="meta">数据源 {{ row.datasourceName || row.datasourceId || '-' }}</div>
          <div class="desc">{{ row.description || '暂无描述' }}</div>
          <div class="ops">
            <ElButton link type="primary" @click="goConfig(row)">配置</ElButton>
            <ElButton link @click="goRun(row)">问数</ElButton>
            <ElButton link @click="goDash(row)">仪表盘</ElButton>
            <ElButton link @click="openEdit(row)">编辑</ElButton>
            <ElButton link @click="copy(row)">复制</ElButton>
            <ElButton link type="danger" @click="remove(row)">删除</ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" description="暂无问数智能体" />
      </div>
    </ElCard>
    <ElDialog v-model="visible" :title="form.id ? '编辑' : '新建问数智能体'" width="560px">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="名称" required><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="数据源 ID" required><ElInput v-model="form.datasourceId" /></ElFormItem>
        <ElFormItem label="描述"
          ><ElInput v-model="form.description" type="textarea" :rows="3"
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
    fetchAiDatasetPage,
    fetchCopyAiDataset,
    fetchRemoveAiDataset,
    fetchSaveAiDataset
  } from '../../api'
  defineOptions({ name: 'AiDataset' })
  const router = useRouter()
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiDatasetPage({
        pageNum: 1,
        pageSize: 50,
        name: keyword.value || undefined
      })
      records.value = res?.records ?? []
    } finally {
      loading.value = false
    }
  }
  function goConfig(row: any) {
    router.push(`/ai/dataset/config/${row.id}`)
  }
  function goRun(row: any) {
    router.push(`/ai/dataset/run/${row.id}`)
  }
  function goDash(row: any) {
    router.push(`/ai/dashboard/design/${row.id}`)
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : {})
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await fetchSaveAiDataset({ ...form })
      ElMessage.success('已保存')
      visible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }
  async function copy(row: any) {
    await fetchCopyAiDataset(row.id)
    ElMessage.success('已复制')
    await reload()
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除「${row.name}」？`, '确认')
    await fetchRemoveAiDataset(row.id)
    await reload()
  }
  onMounted(reload)
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

  .title {
    font-weight: 600;
  }

  .meta {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .desc {
    min-height: 36px;
    margin-top: 8px;
    font-size: 13px;
  }

  .ops {
    margin-top: 10px;
  }
</style>
