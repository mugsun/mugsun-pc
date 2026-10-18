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
        <ElTabPane :label="$t('aiMcpList.tabServer')" name="server" />
      </ElTabs>
      <template v-if="category !== 'server'">
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
        <div v-loading="loading && !loadError" class="card-grid">
          <ElCard v-for="row in records" :key="row.id" shadow="hover" data-test="mcp-card">
            <div class="title"
              >{{ row.name }}
              <ElTag size="small">{{ row.protocolType }}</ElTag>
              <ElTag v-if="row.defaultFlag === 1" size="small" type="success">{{
                $t('aiMcpList.default')
              }}</ElTag>
              <ElTag v-if="row.lockFlag === 1" size="small" type="warning">{{
                $t('aiMcpList.locked')
              }}</ElTag>
            </div>
            <div v-if="cardMetaOf(row, t)" class="meta" data-test="mcp-card-meta">
              {{ cardMetaOf(row, t) }}
            </div>
            <div v-if="row.lockFlag === 1" class="locked-hint" data-test="mcp-locked-hint">
              {{ $t('aiMcpList.lockedHint') }}
            </div>
            <div class="ops">
              <ElButton v-if="row.lockFlag !== 1" link type="primary" @click="openEdit(row)">{{
                $t('aiMcpList.edit')
              }}</ElButton>
              <ElButton link @click="debug(row)">{{ $t('aiMcpList.debug') }}</ElButton>
              <ElButton link @click="setDefault(row)">{{ $t('aiMcpList.setDefault') }}</ElButton>
              <ElButton link @click="toggleLock(row)">{{
                row.lockFlag === 1 ? $t('aiMcpList.unlock') : $t('aiMcpList.lock')
              }}</ElButton>
              <ElButton v-if="row.lockFlag !== 1" link type="danger" @click="remove(row)">{{
                $t('aiMcpList.delete')
              }}</ElButton>
            </div>
          </ElCard>
          <!-- 加载失败：沿用空态的位置和尺寸，换错误图标；后端原文只进 console -->
          <ElEmpty v-if="loadError" class="mcp-load-error" data-test="mcp-load-error">
            <template #image>
              <ElIcon class="mcp-load-error__icon"><CircleCloseFilled /></ElIcon>
            </template>
            <template #description>
              <p data-test="mcp-load-error-text">
                {{ loadErrorLead
                }}<span class="mcp-load-error__id" data-test="mcp-load-error-id">{{
                  loadErrorIdPart
                }}</span>
              </p>
            </template>
            <ElButton :loading="loading" data-test="mcp-retry" @click="reload">{{
              $t('aiMcpList.retry')
            }}</ElButton>
          </ElEmpty>
          <ElEmpty
            v-else-if="!loading && !records.length"
            :description="filtered ? $t('aiMcpList.emptySearched') : $t('aiMcpList.empty')"
          />
        </div>
        <!-- 读屏：错误出现时 polite 读一次（不用 role=alert） -->
        <div class="visually-hidden" aria-live="polite" data-test="mcp-live">{{ liveText }}</div>
      </template>
      <template v-else>
        <ArtTable
          v-if="serverLoading || servers.length"
          :loading="serverLoading"
          :data="servers"
          :columns="serverColumns"
        />
        <ElEmpty v-else :description="$t('aiMcpList.emptyServer')" />
      </template>
    </ElCard>

    <ElDialog
      v-model="visible"
      class="ai-mcp-dialog"
      :title="form.id ? $t('aiForm.editMcp') : $t('aiForm.addMcp')"
      width="640px"
      :top="narrowDialog ? '12px' : '15vh'"
    >
      <!-- 768 以下标签放上面，输入框占满宽度；≤640 时弹窗宽度由全局样式改为 100% - 24px -->
      <ElForm
        ref="formRef"
        :model="form"
        :label-position="narrowForm ? 'top' : 'right'"
        label-width="auto"
      >
        <ElFormItem
          :label="$t('aiForm.protocolName')"
          prop="name"
          :rules="mcpRequired('aiMcpList.requiredName')"
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
          :rules="mcpRequired('aiMcpList.requiredDesc')"
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
          :rules="mcpRequired('aiMcpList.requiredSseUrl')"
        >
          <ElInput v-model="form.sseUrl" placeholder="https://" />
        </ElFormItem>
        <ElFormItem
          v-if="form.protocolType === 'STDIO'"
          :label="$t('aiForm.command')"
          prop="command"
          :rules="mcpRequired('aiMcpList.requiredCommand')"
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
  import type { ColumnOption } from '@/types/component'
  import { h, onMounted, reactive, ref, nextTick } from 'vue'
  import { ElButton, ElMessage, ElMessageBox, ElSwitch } from 'element-plus'
  import { CircleCloseFilled } from '@element-plus/icons-vue'
  import { useMcpList } from './useMcpList'
  import { cardMetaOf, mcpRequired } from './mcpCard'
  import { useWindowSize } from '@vueuse/core'
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
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const category = ref('')
  const keyword = ref('')
  const {
    records,
    loading,
    loadError,
    loadErrorLead,
    loadErrorIdPart,
    liveText,
    filtered,
    reload: reloadList,
    invalidate: invalidateList
  } = useMcpList({
    fetchPage: fetchAiMcpPage,
    category,
    keyword,
    t
  })

  const { width: viewportWidth } = useWindowSize()
  /** 768 以下添加 / 编辑弹窗的标签放到输入框上方 */
  const narrowForm = computed(() => viewportWidth.value < 768)
  /** ≤640：弹窗贴近顶部（12px），高度限制在视口内，只让弹窗内容区滚动 */
  const narrowDialog = computed(() => viewportWidth.value <= 640)
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
  const serverColumns = computed<ColumnOption[]>(() => [
    { prop: 'name', label: t('aiMcpList.colTool'), minWidth: 160 },
    { prop: 'description', label: t('aiMcpList.colDescription'), minWidth: 200 },
    {
      prop: 'enabled',
      label: t('aiMcpList.colEnabled'),
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
  ])

  async function reload() {
    if (category.value === 'server') {
      invalidateList()
      serverLoading.value = true
      try {
        servers.value = (await fetchAiMcpServerList()) || []
      } finally {
        serverLoading.value = false
      }
      return
    }
    return reloadList()
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

  .locked-hint {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .mcp-load-error__icon {
    font-size: 64px;
    color: var(--el-color-danger);
  }

  /* ElEmpty 给 .el-empty__image svg 设了灰色，这里让错误图标保持红色 */
  .mcp-load-error__icon :deep(svg) {
    color: var(--el-color-danger);
  }

  /*
   * 编号段是一个 inline-block：在父行里不可拆，放不下就整段换到下一行；
   * 宽度按内容收缩（最多 100%），整段放得进一行时内部不断开。
   * 不用 white-space: nowrap：错误态在卡片网格的一列里，641–1440 宽时列宽可低到 280px 左右，
   * 32 位编号整段放不进时 nowrap 会横向溢出；这里放不进才在段内折行（overflow-wrap 兜底）。
   */
  .mcp-load-error__id {
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* 窄屏下「添加 MCP 工具」换行后不留左侧缩进，与搜索框左对齐（间距由 gap 负责） */
  @media (width <= 640px) {
    .toolbar .el-button + .el-button {
      margin-left: 0;
    }
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

  /*
   * 窄屏：默认 margin-top 15vh 加上 max-height，弹窗底部会超出视口，外层遮罩也跟着滚，变成双层滚动。
   * 这里配合 top="12px" 把弹窗限制在视口内（上下各 12px），头部和页脚固定，只有内容区一层滚动。
   */
  @media (width <= 640px) {
    .ai-mcp-dialog.el-dialog {
      max-height: calc(100vh - 24px);
      margin-bottom: 0;
    }
  }
</style>
