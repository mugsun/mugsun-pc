<template>
  <div class="art-full-height design">
    <div class="toolbar">
      <ElButton @click="$router.back()">{{ $t('aiAppDesign.back') }}</ElButton>
      <h3
        >{{ app?.name || $t('aiAppDesign.titleFallback') }}
        <ElTag size="small">{{ app?.appType }}</ElTag></h3
      >
      <ElButton @click="exportDsl">{{ $t('aiAppDesign.exportDsl') }}</ElButton>
      <ElButton @click="share">{{ $t('aiAppDesign.share') }}</ElButton>
      <ElButton :loading="running" @click="run">{{ $t('aiAppDesign.run') }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="save">{{
        $t('aiAppDesign.save')
      }}</ElButton>
    </div>

    <!-- 对话助手形态 -->
    <div v-if="app?.appType === 'chat'" class="chat-mode">
      <ElForm :model="chat" label-width="auto" class="chat-form">
        <ElFormItem :label="$t('aiAppDesign.temperature')"
          ><ElSlider v-model="chat.temperature" :min="0" :max="2" :step="0.1" show-input
        /></ElFormItem>
        <ElFormItem :label="$t('aiAppDesign.maxTokens')"
          ><ElInputNumber v-model="chat.maxTokens" :min="1" :max="128000"
        /></ElFormItem>
        <ElFormItem label="Top P"
          ><ElSlider v-model="chat.topP" :min="0" :max="1" :step="0.05" show-input
        /></ElFormItem>
        <ElFormItem :label="$t('aiAppDesign.frequencyPenalty')"
          ><ElSlider v-model="chat.frequencyPenalty" :min="-2" :max="2" :step="0.1" show-input
        /></ElFormItem>
        <ElFormItem :label="$t('aiAppDesign.systemPrompt')"
          ><ElInput v-model="chat.systemPrompt" type="textarea" :rows="4"
        /></ElFormItem>
        <ElFormItem :label="$t('aiAppDesign.greeting')"
          ><ElInput v-model="chat.greeting" type="textarea" :rows="2"
        /></ElFormItem>
        <ElFormItem :label="$t('aiAppDesign.presets')">
          <ElSelect
            v-model="chat.presets"
            multiple
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          />
        </ElFormItem>
      </ElForm>
    </div>

    <!-- 工作流 / 文本 / 对话流程 -->
    <div v-else class="flow-layout">
      <aside class="palette">
        <div v-for="g in groups" :key="g.name" class="group">
          <div class="g-title">{{ g.name }}</div>
          <div
            v-for="n in g.nodes"
            :key="n.type"
            class="palette-item"
            draggable="true"
            @dragstart="onDragStart($event, n)"
            >{{ n.label }}</div
          >
        </div>
      </aside>
      <div class="canvas" @drop="onDrop" @dragover.prevent>
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          fit-view-on-init
          :default-viewport="{ zoom: 0.9 }"
          @node-click="onNodeClick"
          @connect="onConnect"
          @pane-click="selected = null"
        >
          <template #node-custom="{ data, id }">
            <div class="flow-node" :class="{ active: selected?.id === id }">
              <Handle type="target" :position="Position.Left" />
              <div class="n-type">{{ data.type }}</div>
              <div class="n-label">{{ data.label }}</div>
              <Handle type="source" :position="Position.Right" />
            </div>
          </template>
        </VueFlow>
      </div>
      <aside class="props">
        <template v-if="selected">
          <h4>{{ $t('aiAppDesign.nodeProps') }}</h4>
          <ElForm label-width="auto" size="small">
            <ElFormItem :label="$t('aiAppDesign.type')"
              ><ElInput :model-value="selected.data.type" disabled
            /></ElFormItem>
            <ElFormItem :label="$t('aiAppDesign.name')"
              ><ElInput v-model="selected.data.label"
            /></ElFormItem>
            <ElFormItem v-if="hasField('prompt')" :label="$t('aiAppDesign.prompt')">
              <ElInput v-model="selected.data.prompt" type="textarea" :rows="4" />
            </ElFormItem>
            <ElFormItem v-if="hasField('text')" :label="$t('aiAppDesign.template')">
              <ElInput v-model="selected.data.text" type="textarea" :rows="4" />
            </ElFormItem>
            <ElFormItem v-if="hasField('url')" label="URL">
              <ElInput v-model="selected.data.url" />
            </ElFormItem>
            <ElFormItem v-if="hasField('sql')" label="SQL">
              <ElInput
                v-model="selected.data.sql"
                type="textarea"
                :rows="4"
                :placeholder="$t('aiAppDesign.sqlPlaceholder')"
              />
            </ElFormItem>
            <ElFormItem v-if="hasField('knowledgeId')" :label="$t('aiAppDesign.knowledge')">
              <ElInput
                v-model="selected.data.knowledgeId"
                :placeholder="$t('aiAppDesign.knowledgeIdPlaceholder')"
              />
            </ElFormItem>
            <ElFormItem v-if="hasField('expression')" :label="$t('aiAppDesign.expression')">
              <ElInput v-model="selected.data.expression" />
            </ElFormItem>
            <ElFormItem v-if="hasField('value')" :label="$t('aiAppDesign.expected')">
              <ElInput v-model="selected.data.value" />
            </ElFormItem>
            <ElFormItem :label="$t('aiAppDesign.outputVar')">
              <ElInput
                v-model="selected.data.outputVar"
                :placeholder="$t('aiAppDesign.optional')"
              />
            </ElFormItem>
            <ElButton type="danger" link @click="removeSelected">{{
              $t('aiAppDesign.removeNode')
            }}</ElButton>
          </ElForm>
        </template>
        <ElEmpty v-else :description="$t('aiAppDesign.selectNodeHint')" :image-size="64" />
      </aside>
    </div>

    <pre v-if="runResult" class="result">{{ runResult }}</pre>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    VueFlow,
    Handle,
    Position,
    MarkerType,
    type Connection,
    type Edge,
    type Node
  } from '@vue-flow/core'
  import '@vue-flow/core/dist/style.css'
  import '@vue-flow/core/dist/theme-default.css'
  import { fetchAiAppDetail, fetchRunAiApp, fetchSaveAiAppDsl, fetchShareAiApp } from '../../api'

  defineOptions({ name: 'AiAppDesign' })
  const { t } = useI18n()

  const route = useRoute()
  const appId = computed(() => route.params.id as string)
  const app = ref<any>(null)
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const selected = ref<Node | null>(null)
  const saving = ref(false)
  const running = ref(false)
  const runResult = ref('')
  const chat = reactive({
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
    frequencyPenalty: 0,
    systemPrompt: '',
    greeting: '',
    presets: [] as string[]
  })

  const groups = computed(() => [
    {
      name: t('aiAppDesign.groupFlow'),
      nodes: [
        { type: 'start', label: t('aiAppDesign.nodeStart') },
        { type: 'end', label: t('aiAppDesign.nodeEnd') },
        { type: 'switch', label: t('aiAppDesign.nodeSwitch') }
      ]
    },
    {
      name: t('aiAppDesign.groupAi'),
      nodes: [
        { type: 'llm', label: t('aiAppDesign.nodeLlm') },
        { type: 'rag', label: t('aiAppDesign.knowledge') },
        { type: 'question', label: t('aiAppDesign.nodeQuestion') },
        { type: 'extract', label: t('aiAppDesign.nodeExtract') },
        { type: 'optimize', label: t('aiAppDesign.nodeOptimize') }
      ]
    },
    {
      name: t('aiAppDesign.groupData'),
      nodes: [
        { type: 'db', label: t('aiAppDesign.nodeDb') },
        { type: 'code', label: t('aiAppDesign.nodeCode') },
        { type: 'text', label: t('aiAppDesign.nodeText') },
        { type: 'updateVar', label: t('aiAppDesign.nodeUpdateVar') }
      ]
    },
    {
      name: t('aiAppDesign.groupTools'),
      nodes: [
        { type: 'http', label: 'HTTP' },
        { type: 'mcp', label: 'MCP' }
      ]
    },
    {
      name: t('aiAppDesign.groupNotice'),
      nodes: [{ type: 'notice', label: t('aiAppDesign.nodeNotice') }]
    }
  ])

  const fieldMap: Record<string, string[]> = {
    llm: ['prompt'],
    text: ['text'],
    http: ['url'],
    db: ['sql'],
    rag: ['knowledgeId'],
    switch: ['expression', 'value'],
    optimize: ['prompt'],
    extract: ['prompt']
  }

  function hasField(f: string) {
    const type = selected.value?.data?.type
    return !!type && (fieldMap[type] || []).includes(f)
  }

  function onDragStart(e: DragEvent, n: { type: string; label: string }) {
    e.dataTransfer?.setData('application/vueflow', JSON.stringify(n))
  }

  function onDrop(e: DragEvent) {
    const raw = e.dataTransfer?.getData('application/vueflow')
    if (!raw) return
    const n = JSON.parse(raw) as { type: string; label: string }
    // 开始 / 结束只能各有一个（UX-106）
    if (
      (n.type === 'start' || n.type === 'end') &&
      nodes.value.some((x) => x.data?.type === n.type)
    ) {
      ElMessage.warning(t('aiAppDesign.onlyOne', { label: n.label }))
      return
    }
    const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const id = `${n.type}_${Date.now()}`
    nodes.value.push({
      id,
      type: 'custom',
      position: { x: e.clientX - bounds.left - 60, y: e.clientY - bounds.top - 20 },
      data: {
        type: n.type,
        label: n.label,
        prompt: '',
        text: '',
        url: '',
        sql: '',
        knowledgeId: '',
        expression: '',
        value: 'true',
        outputVar: ''
      }
    })
  }

  /**
   * 连线（UX-107）：VueFlow 只发 connect 事件、不自动加边，之前没有处理所以拖了也连不上。
   * 去掉自连和重复边。
   */
  function onConnect(c: Connection) {
    if (!c.source || !c.target || c.source === c.target) return
    if (edges.value.some((e) => e.source === c.source && e.target === c.target)) return
    edges.value = [
      ...edges.value,
      {
        id: `e_${c.source}_${c.target}_${Date.now()}`,
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle,
        targetHandle: c.targetHandle,
        markerEnd: MarkerType.ArrowClosed
      }
    ]
  }

  /** 保存前校验（UX-106）：恰好一个开始、一个结束，且没有孤立节点 */
  function validateFlow(): string | null {
    const label = (n: Node) => n.data?.label || n.data?.type || n.id
    const starts = nodes.value.filter((n) => n.data?.type === 'start')
    const ends = nodes.value.filter((n) => n.data?.type === 'end')
    if (starts.length !== 1) return t('aiAppDesign.needOneStart', { n: starts.length })
    if (ends.length !== 1) return t('aiAppDesign.needOneEnd', { n: ends.length })
    const noIn = nodes.value.filter(
      (n) => n.data?.type !== 'start' && !edges.value.some((e) => e.target === n.id)
    )
    const noOut = nodes.value.filter(
      (n) => n.data?.type !== 'end' && !edges.value.some((e) => e.source === n.id)
    )
    const loose = [...new Set([...noIn, ...noOut])]
    if (loose.length) return t('aiAppDesign.looseNodes', { names: loose.map(label).join(', ') })
    return null
  }

  function onNodeClick({ node }: { node: Node }) {
    selected.value = node
  }

  function removeSelected() {
    if (!selected.value) return
    const id = selected.value.id
    nodes.value = nodes.value.filter((n) => n.id !== id)
    edges.value = edges.value.filter((e) => e.source !== id && e.target !== id)
    selected.value = null
  }

  function buildDsl(): string {
    if (app.value?.appType === 'chat') {
      return JSON.stringify({ mode: 'chat', chat: { ...chat }, nodes: [], edges: [] })
    }
    return JSON.stringify({
      nodes: nodes.value.map((n) => ({
        id: n.id,
        type: n.data?.type || n.type,
        position: n.position,
        data: { ...n.data }
      })),
      edges: edges.value.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target
      })),
      connections: edges.value.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target
      }))
    })
  }

  function loadDsl(raw?: string) {
    if (!raw) return
    try {
      const dsl = JSON.parse(raw)
      if (dsl.mode === 'chat' || app.value?.appType === 'chat') {
        Object.assign(chat, dsl.chat || {})
        return
      }
      nodes.value = (dsl.nodes || []).map((n: any) => ({
        id: n.id,
        type: 'custom',
        position: n.position || { x: 0, y: 0 },
        data: { ...(n.data || {}), type: n.data?.type || n.type, label: n.data?.label || n.type }
      }))
      const eds = dsl.edges || dsl.connections || []
      edges.value = eds.map((e: any, i: number) => ({
        id: e.id || `e_${i}`,
        source: e.source,
        target: e.target,
        markerEnd: MarkerType.ArrowClosed
      }))
    } catch {
      ElMessage.warning(t('aiAppDesign.dslParseFailed'))
    }
  }

  async function load() {
    const d = await fetchAiAppDetail(appId.value)
    app.value = d
    loadDsl(d?.dsl || d?.dslJson)
  }

  async function save() {
    if (app.value?.appType !== 'chat') {
      const err = validateFlow()
      if (err) {
        ElMessage.warning(err)
        return
      }
    }
    saving.value = true
    try {
      await fetchSaveAiAppDsl({ id: appId.value, dsl: buildDsl(), dslJson: buildDsl() })
      ElMessage.success(t('aiAppDesign.saved'))
    } catch (e: any) {
      ElMessage.error(e?.message || t('aiAppDesign.saveFailed'))
    } finally {
      saving.value = false
    }
  }

  async function run() {
    running.value = true
    try {
      const r = await fetchRunAiApp({ id: appId.value, input: t('aiAppDesign.runInput') })
      runResult.value = typeof r === 'string' ? r : JSON.stringify(r, null, 2)
    } finally {
      running.value = false
    }
  }

  async function share() {
    const r = await fetchShareAiApp({ id: appId.value, enable: true })
    ElMessage.success(t('aiAppDesign.shareOk', { url: r?.url || r?.shareToken || '' }))
  }

  function exportDsl() {
    const blob = new Blob([buildDsl()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ai-app-${appId.value}.json`
    a.click()
  }

  onMounted(load)
</script>

<style scoped>
  .design {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .toolbar h3 {
    display: flex;
    flex: 1;
    gap: 8px;
    align-items: center;
    margin: 0;
    font-size: 16px;
  }

  .flow-layout {
    display: grid;
    flex: 1;
    grid-template-columns: 180px 1fr 260px;
    gap: 8px;
    min-height: 520px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }

  .palette {
    padding: 8px;
    overflow: auto;
    background: var(--el-fill-color-blank);
    border-right: 1px solid var(--el-border-color);
  }

  .g-title {
    margin: 8px 0 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .palette-item {
    padding: 6px 8px;
    margin-bottom: 4px;
    font-size: 13px;
    cursor: grab;
    background: var(--el-bg-color);
    border: 1px dashed var(--el-border-color);
    border-radius: 6px;
  }

  .canvas {
    position: relative;
    min-height: 520px;
  }

  .props {
    padding: 12px;
    overflow: auto;
    border-left: 1px solid var(--el-border-color);
  }

  .flow-node {
    min-width: 120px;
    padding: 8px 10px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: 8px;
    box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  }

  .flow-node.active {
    border-color: var(--el-color-primary);
  }

  .n-type {
    font-size: 11px;
    color: var(--el-color-primary);
  }

  .n-label {
    font-size: 13px;
    font-weight: 600;
  }

  .chat-mode {
    flex: 1;
    padding: 16px;
    overflow: auto;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }

  .chat-form {
    max-width: 720px;
  }

  .result {
    max-height: 200px;
    padding: 8px;
    margin: 0;
    overflow: auto;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }
</style>
