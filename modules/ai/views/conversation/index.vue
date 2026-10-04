<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="标题/用户"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton @click="doExport">导出</ElButton>
      </div>
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        @pagination:size-change="
          (s: number) => {
            pageSize = s
            reload()
          }
        "
        @pagination:current-change="
          (p: number) => {
            pageNum = p
            reload()
          }
        "
      />
    </ElCard>
    <ElDrawer v-model="detailVisible" title="对话详情" size="480px">
      <div v-for="(m, i) in detailMsgs" :key="i" class="msg" :class="m.role">
        <strong>{{ m.role }}</strong>
        <pre>{{ m.content }}</pre>
      </div>
    </ElDrawer>
  </div>
</template>
<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, ref } from 'vue'
  import { ElButton } from 'element-plus'
  import {
    fetchAiConversationDetail,
    fetchAiConversationPage,
    fetchExportAiConversation
  } from '../../api'
  defineOptions({ name: 'AiConversation' })
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const detailVisible = ref(false)
  const detailMsgs = ref<any[]>([])
  const pager = computed(() => ({
    current: pageNum.value,
    size: pageSize.value,
    total: total.value
  }))
  const columns: ColumnOption[] = [
    { type: 'index', width: 60, label: '#' },
    { prop: 'title', label: '标题', minWidth: 160 },
    { prop: 'source', label: '来源', width: 100 },
    { prop: 'userName', label: '用户', width: 120 },
    { prop: 'modelName', label: '模型', width: 140 },
    { prop: 'totalTokens', label: 'Tokens', width: 100 },
    { prop: 'lastTime', label: '时间', width: 170 },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      fixed: 'right',
      formatter: (row: any) =>
        h(
          ElButton,
          { link: true, type: 'primary', size: 'small', onClick: () => openDetail(row) },
          () => '详情'
        )
    }
  ]
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiConversationPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined
      })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  async function openDetail(row: any) {
    const d = await fetchAiConversationDetail(row.id)
    detailMsgs.value = Array.isArray(d) ? d : d?.messages || d?.records || []
    detailVisible.value = true
  }
  async function doExport() {
    await fetchExportAiConversation({ keyword: keyword.value || undefined })
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .msg {
    padding: 8px;
    margin-bottom: 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .msg pre {
    margin: 6px 0 0;
    white-space: pre-wrap;
  }
</style>
