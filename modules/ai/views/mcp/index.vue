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
            placeholder="搜索 MCP"
            style="width: 200px"
            @keyup.enter="reload"
            @clear="reload"
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
            <div class="meta">工具数 {{ toolCount(row) }} · {{ row.description }}</div>
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
          <ElEmpty
            v-if="!loading && !records.length"
            :description="
              searched ? '没有符合条件的 MCP。换个名称再查' : '还没有 MCP。点添加 MCP 工具开始配置'
            "
          />
        </div>
      </template>
      <template v-else>
        <ArtTable
          v-if="serverLoading || servers.length"
          :loading="serverLoading"
          :data="servers"
          :columns="serverColumns"
        />
        <ElEmpty v-else description="还没有对外暴露的工具。添加 HTTP 或 SSE 并启用后会出现在这里" />
      </template>
    </ElCard>

    <ElDialog
      v-model="visible"
      class="ai-mcp-dialog"
      :title="form.id ? '编辑 MCP' : '添加 MCP'"
      width="640px"
    >
      <ElForm :model="form" label-width="110px">
        <ElFormItem label="协议名称" required>
          <ElInput
            v-model="form.name"
            maxlength="64"
            show-word-limit
            placeholder="用来在列表里区分"
          />
        </ElFormItem>
        <ElFormItem label="协议描述" required>
          <ElInput
            v-model="form.description"
            maxlength="255"
            show-word-limit
            placeholder="用来说明这个工具做什么"
          />
        </ElFormItem>
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
          ><ElInput
            v-model="form.envJson"
            type="textarea"
            :rows="2"
            placeholder="JSON，留空表示不额外传"
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
  const searched = ref(false)
  const loading = ref(false)
  const records = ref<any[]>([])

  const toolCount = (row: any): string | number => {
    if (row.toolCount != null) {
      return row.toolCount
    }
    if (!row.toolsJson) {
      return '-'
    }
    try {
      const parsed = JSON.parse(row.toolsJson)
      return Array.isArray(parsed) ? parsed.length : '-'
    } catch {
      return '-'
    }
  }
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
          modelValue: row.status === 1,
          'onUpdate:modelValue': async (v: string | number | boolean) => {
            try {
              await fetchToggleAiMcpServer({ id: row.id, status: v ? 1 : 0 })
              row.status = v ? 1 : 0
              await reload()
            } catch {
              /* 失败时开关保持原样 */
            }
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
    searched.value = !!keyword.value.trim()
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
    if (!form.id) {
      ElMessage.error('请先保存这个工具，再解析清单')
      return
    }
    try {
      const r = await fetchParseAiMcp({ id: form.id })
      const raw = r?.toolsJson
      parsedTools.value = Array.isArray(raw) ? raw : []
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw)
          parsedTools.value = Array.isArray(parsed) ? parsed : []
        } catch {
          parsedTools.value = []
        }
      }
    } catch {
      parsedTools.value = []
    }
  }
  async function save() {
    saving.value = true
    try {
      const payload: Record<string, any> = {
        id: form.id,
        name: form.name,
        description: form.description,
        category: form.category,
        protocolType: form.protocolType,
        sseUrl: form.sseUrl,
        command: form.command,
        envJson: form.envJson,
        status: form.status
      }
      if (form.apiKey) payload.apiKey = form.apiKey
      await fetchSaveAiMcp(payload)
      visible.value = false
      await reload()
    } catch {
      /* 失败时弹窗留着，方便改完再保存 */
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
      debugResult.value = r?.message || '已回显。这是本地调试，没有调用外部工具'
    } catch (e: any) {
      debugResult.value = e?.message || '这次没有调通。请检查地址能不能从本机访问，再试一次'
    } finally {
      debugging.value = false
    }
  }
  async function setDefault(row: any) {
    await fetchDefaultAiMcp(row.id)
    await reload()
  }
  async function toggleLock(row: any) {
    await fetchLockAiMcp({ id: row.id, lockFlag: row.lockFlag === 1 ? 0 : 1 })
    await reload()
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除「${row.name}」后，列表里不会再出现，也不能再调试`, '确认')
    await fetchRemoveAiMcp(row.id)
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

  .meta {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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
<style>
  .ai-mcp-dialog.el-dialog {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 32px);
  }

  .ai-mcp-dialog .el-dialog__body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
