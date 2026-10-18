<template>
  <div class="ai-mcp-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="category" @tab-change="reload">
        <ElTabPane :label="$t('aiMcpList.tabAll')" name="" />
        <ElTabPane :label="$t('aiMcpList.tabMap')" name="map" />
        <ElTabPane :label="$t('aiMcpList.tabChat')" name="chat" />
        <ElTabPane :label="$t('aiMcpList.tabBrowser')" name="browser" />
        <ElTabPane :label="$t('aiMcpList.tabFile')" name="file" />
        <ElTabPane :label="$t('aiMcpList.tabCustom')" name="custom" />
      </ElTabs>
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiMcpList.searchPlaceholder')"
          style="width: 200px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">{{ $t('aiMcpList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiMcpList.add') }}</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title"
            >{{ row.name }}
            <ElTag size="small">{{ row.protocolType }}</ElTag>
            <ElTag v-if="row.defaultFlag === 1" size="small" type="success">{{
              $t('aiMcpList.default')
            }}</ElTag>
            <ElTag v-if="row.lockFlag === 1" size="small" type="warning">{{
              $t('aiMcpList.lock')
            }}</ElTag>
          </div>
          <div class="meta">
            {{ $t('aiMcpList.toolCount', { n: toolCount(row) }) }} · {{ row.description }}
          </div>
          <div class="ops">
            <ElButton link type="primary" :disabled="row.lockFlag === 1" @click="openEdit(row)">{{
              $t('aiMcpList.edit')
            }}</ElButton>
            <ElButton link @click="debug(row)">{{ $t('aiMcpList.debug') }}</ElButton>
            <ElButton link @click="setDefault(row)">{{ $t('aiMcpList.setDefault') }}</ElButton>
            <ElButton link @click="toggleLock(row)">{{
              row.lockFlag === 1 ? $t('aiMcpList.unlock') : $t('aiMcpList.lock')
            }}</ElButton>
            <ElButton link type="danger" :disabled="row.lockFlag === 1" @click="remove(row)">{{
              $t('aiMcpList.delete')
            }}</ElButton>
          </div>
        </ElCard>
        <ElEmpty
          v-if="!loading && !records.length"
          :description="searched ? $t('aiMcpList.emptySearched') : $t('aiMcpList.empty')"
        />
      </div>
    </ElCard>

    <ElDialog
      v-model="visible"
      class="ai-mcp-dialog"
      :title="form.id ? $t('aiForm.editMcp') : $t('aiForm.addMcp')"
      width="640px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem
          :label="$t('aiForm.protocolName')"
          prop="name"
          :rules="requiredRule($t('aiForm.protocolName'))"
        >
          <ElInput
            v-model="form.name"
            maxlength="64"
            show-word-limit
            :placeholder="$t('aiForm.phListName')"
          />
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.protocolDesc')"
          prop="description"
          :rules="requiredRule($t('aiForm.protocolDesc'))"
        >
          <ElInput
            v-model="form.description"
            maxlength="255"
            show-word-limit
            :placeholder="$t('aiForm.phProtocolDesc')"
          />
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.category')"
          prop="category"
          :rules="requiredRule($t('aiForm.category'), true)"
        >
          <ElSelect v-model="form.category" style="width: 100%">
            <ElOption :label="$t('aiForm.optMapTool')" value="map" /><ElOption
              :label="$t('aiForm.optChatTool')"
              value="chat"
            />
            <ElOption :label="$t('aiForm.optBrowserTool')" value="browser" /><ElOption
              :label="$t('aiForm.optFileTool')"
              value="file"
            />
            <ElOption :label="$t('aiForm.optCustom')" value="custom" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.protocolType')"
          prop="protocolType"
          :rules="requiredRule($t('aiForm.protocolType'), true)"
        >
          <ElRadioGroup v-model="form.protocolType">
            <ElRadio label="SSE">SSE</ElRadio>
            <ElRadio label="STDIO">STDIO</ElRadio>
            <ElRadio label="HTTP">Streamable HTTP</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem
          v-if="form.protocolType !== 'STDIO'"
          :label="$t('aiForm.sseUrl')"
          prop="sseUrl"
          :rules="requiredRule($t('aiForm.sseUrl'))"
        >
          <ElInput v-model="form.sseUrl" placeholder="https://" />
        </ElFormItem>
        <ElFormItem
          v-if="form.protocolType === 'STDIO'"
          :label="$t('aiForm.command')"
          prop="command"
          :rules="requiredRule($t('aiForm.command'))"
        >
          <ElInput v-model="form.command" type="textarea" :rows="3" />
        </ElFormItem>
        <ElFormItem label="API Key"
          ><ElInput v-model="form.apiKey" type="password" show-password
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.envVars')"
          ><ElInput
            v-model="form.envJson"
            type="textarea"
            :rows="2"
            :placeholder="$t('aiForm.phEnvVars')"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.status')"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
        <ElFormItem>
          <ElButton @click="parseTools">{{ $t('aiForm.parseTools') }}</ElButton>
        </ElFormItem>
        <ElFormItem v-if="parsedTools.length" :label="$t('aiForm.toolList')">
          <ElTable :data="parsedTools" size="small" max-height="200">
            <ElTableColumn prop="name" :label="$t('aiForm.name')" />
            <ElTableColumn prop="description" :label="$t('aiForm.description')" />
          </ElTable>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="debugVisible" :title="$t('aiForm.mcpDebug')" width="640px">
      <ElForm label-width="auto">
        <ElFormItem :label="$t('aiForm.testPrompt')"
          ><ElInput v-model="debugPrompt" type="textarea" :rows="4"
        /></ElFormItem>
      </ElForm>
      <ElButton type="primary" :loading="debugging" @click="runDebug">{{
        $t('aiForm.debug')
      }}</ElButton>
      <pre class="debug-out">{{ debugResult }}</pre>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance } from 'element-plus'
  import { requiredRule } from '../shared/formRules'
  import { onMounted, reactive, ref, nextTick } from 'vue'
  import { ElButton, ElMessage, ElMessageBox, ElSwitch } from 'element-plus'
  import {
    fetchAiMcpPage,
    fetchDebugAiMcp,
    fetchDefaultAiMcp,
    fetchLockAiMcp,
    fetchParseAiMcp,
    fetchRemoveAiMcp,
    fetchSaveAiMcp
  } from '../../api'
  defineOptions({ name: 'AiMcp' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
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

  async function reload() {
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
    nextTick(() => formRef.value?.clearValidate())
  }
  async function parseTools() {
    if (!form.id) {
      ElMessage.error(t('aiMcpList.saveFirst'))
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
    if (!(await formRef.value?.validate().catch(() => false))) return
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
      debugResult.value = r?.message || t('aiMcpList.debugEcho')
    } catch (e: any) {
      debugResult.value = e?.message || t('aiMcpList.debugFailed')
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
    await ElMessageBox.confirm(
      t('aiMcpList.removeConfirm', { name: row.name }),
      t('aiMcpList.confirmTitle')
    )
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
