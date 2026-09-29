<template>
  <div class="ai-mcp-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="category" @tab-change="reload">
        <ElTabPane label="全部" name="" />
        <ElTabPane label="地图工具" name="map" />
        <ElTabPane label="聊天工具" name="chat" />
        <ElTabPane label="浏览器工具" name="browser" />
        <ElTabPane label="文件工具" name="file" />
        <ElTabPane label="自定义" name="custom" />
        <ElTabPane label="对外暴露" name="server" />
      </ElTabs>
      <template v-if="category !== 'server'">
        <div class="toolbar">
          <ElInput
            v-model="keyword"
            clearable
            placeholder="搜索"
            style="width: 200px"
            @keyup.enter="reload"
          />
          <ElButton @click="reload">搜索</ElButton>
          <ElButton type="primary" @click="openEdit()">添加 MCP 工具</ElButton>
        </div>
        <div v-loading="loading" class="card-grid">
          <ElCard v-for="row in records" :key="row.id" shadow="hover">
            <div class="title"
              >{{ row.name }}
              <ElTag size="small">{{ row.protocolType }}</ElTag>
              <ElTag v-if="row.defaultFlag === 1" size="small" type="success">默认</ElTag>
              <ElTag v-if="row.lockFlag === 1" size="small" type="warning">锁定</ElTag>
            </div>
            <div class="meta">工具数 {{ row.toolCount ?? '-' }} · {{ row.description }}</div>
            <div class="ops">
              <ElButton link type="primary" :disabled="row.lockFlag === 1" @click="openEdit(row)"
                >编辑</ElButton
              >
              <ElButton link @click="debug(row)">调试</ElButton>
              <ElButton link @click="setDefault(row)">设为默认</ElButton>
              <ElButton link @click="toggleLock(row)">{{
                row.lockFlag === 1 ? '解锁' : '锁定'
              }}</ElButton>
              <ElButton link type="danger" :disabled="row.lockFlag === 1" @click="remove(row)"
                >删除</ElButton
              >
            </div>
          </ElCard>
          <ElEmpty v-if="!loading && !records.length" description="暂无 MCP" />
        </div>
      </template>
      <template v-else>
        <ArtTable :loading="serverLoading" :data="servers" :columns="serverColumns" />
      </template>
    </ElCard>

    <ElDialog v-model="visible" :title="form.id ? '编辑 MCP' : '添加 MCP'" width="640px">
      <ElForm :model="form" label-width="110px">
        <ElFormItem label="协议名称" required><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="协议描述" required><ElInput v-model="form.description" /></ElFormItem>
        <ElFormItem label="分类" required>
          <ElSelect v-model="form.category" style="width: 100%">
            <ElOption label="地图工具" value="map" /><ElOption label="聊天工具" value="chat" />
            <ElOption label="浏览器工具" value="browser" /><ElOption
              label="文件工具"
              value="file"
            />
            <ElOption label="自定义" value="custom" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="协议类型" required>
          <ElRadioGroup v-model="form.protocolType">
            <ElRadio label="SSE">SSE</ElRadio>
            <ElRadio label="STDIO">STDIO</ElRadio>
            <ElRadio label="HTTP">Streamable HTTP</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem v-if="form.protocolType !== 'STDIO'" label="SSE 地址" required>
          <ElInput v-model="form.sseUrl" placeholder="https://" />
        </ElFormItem>
        <ElFormItem v-if="form.protocolType === 'STDIO'" label="命令行" required>
          <ElInput v-model="form.command" type="textarea" :rows="3" />
        </ElFormItem>
        <ElFormItem label="API Key"
          ><ElInput v-model="form.apiKey" type="password" show-password
        /></ElFormItem>
        <ElFormItem label="环境变量"
          ><ElInput v-model="form.envJson" type="textarea" :rows="3" placeholder="JSON"
        /></ElFormItem>
        <ElFormItem label="状态"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
        <ElFormItem>
          <ElButton @click="parseTools">解析工具清单</ElButton>
        </ElFormItem>
        <ElFormItem v-if="parsedTools.length" label="工具清单">
          <ElTable :data="parsedTools" size="small" max-height="200">
            <ElTableColumn prop="name" label="名称" />
            <ElTableColumn prop="description" label="描述" />
          </ElTable>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="debugVisible" title="MCP 调试" width="640px">
      <ElForm label-width="88px">
        <ElFormItem label="测试提示词"
          ><ElInput v-model="debugPrompt" type="textarea" :rows="4"
        /></ElFormItem>
      </ElForm>
      <ElButton type="primary" :loading="debugging" @click="runDebug">调试</ElButton>
      <pre class="debug-out">{{ debugResult }}</pre>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { h, onMounted, reactive, ref } from 'vue'
  import { ElButton, ElMessage, ElMessageBox, ElSwitch } from 'element-plus'
  import {
    fetchAiMcpPage,
    fetchAiMcpServerList,
    fetchDebugAiMcp,
    fetchDefaultAiMcp,
    fetchLockAiMcp,
    fetchParseAiMcp,
    fetchRemoveAiMcp,
    fetchSaveAiMcp,
    fetchToggleAiMcpServer
  } from '../../api'
  defineOptions({ name: 'AiMcp' })
  const category = ref('')
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  const parsedTools = ref<any[]>([])
  const debugVisible = ref(false)
  const debugPrompt = ref('')
  const debugResult = ref('')
  const debugging = ref(false)
  const debugRow = ref<any>(null)
  const serverLoading = ref(false)
  const servers = ref<any[]>([])
  const serverColumns: ColumnOption[] = [
    { prop: 'name', label: '工具', minWidth: 160 },
    { prop: 'description', label: '说明', minWidth: 200 },
    {
      prop: 'enabled',
      label: '启用',
      width: 100,
      formatter: (row: any) =>
        h(ElSwitch, {
          modelValue: row.enabled === 1,
          'onUpdate:modelValue': async (v: string | number | boolean) => {
            await fetchToggleAiMcpServer({ name: row.name, enabled: v ? 1 : 0 })
            row.enabled = v ? 1 : 0 // coerce
            ElMessage.success('已更新')
          }
        })
    }
  ]

  async function reload() {
    if (category.value === 'server') {
      serverLoading.value = true
      try {
        servers.value = (await fetchAiMcpServerList()) || []
      } finally {
        serverLoading.value = false
      }
      return
    }
    loading.value = true
    try {
      const res = await fetchAiMcpPage({
        pageNum: 1,
        pageSize: 50,
        name: keyword.value || undefined,
        category: category.value || undefined
      })
      records.value = res?.records ?? []
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(
      form,
      row ? { ...row, apiKey: '' } : { protocolType: 'SSE', category: 'custom', status: 1 }
    )
    parsedTools.value = []
    visible.value = true
  }
  async function parseTools() {
    const r = await fetchParseAiMcp({ ...form })
    parsedTools.value = r?.tools || r || []
    ElMessage.success('解析完成')
  }
  async function save() {
    saving.value = true
    try {
      const payload = { ...form }
      if (!payload.apiKey) delete payload.apiKey
      await fetchSaveAiMcp(payload)
      ElMessage.success('已保存')
      visible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }
  function debug(row: any) {
    debugRow.value = row
    debugPrompt.value = ''
    debugResult.value = ''
    debugVisible.value = true
  }
  async function runDebug() {
    debugging.value = true
    try {
      const r = await fetchDebugAiMcp({ id: debugRow.value.id, prompt: debugPrompt.value })
      debugResult.value = typeof r === 'string' ? r : JSON.stringify(r, null, 2)
    } finally {
      debugging.value = false
    }
  }
  async function setDefault(row: any) {
    await fetchDefaultAiMcp(row.id)
    ElMessage.success('已设为默认')
    await reload()
  }
  async function toggleLock(row: any) {
    await fetchLockAiMcp({ id: row.id, lockFlag: row.lockFlag === 1 ? 0 : 1 })
    ElMessage.success('已更新')
    await reload()
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除「${row.name}」？`, '确认')
    await fetchRemoveAiMcp(row.id)
    ElMessage.success('已删除')
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
    min-height: 160px;
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .meta {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ops {
    margin-top: 10px;
  }

  .debug-out {
    max-height: 240px;
    padding: 8px;
    margin-top: 12px;
    overflow: auto;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }
</style>
