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
    <ElAlert
      v-if="mockOn"
      class="mock-hint"
      type="info"
      :closable="false"
      :title="$t('aiAppDesign.mockHint')"
      show-icon
    />

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
              <div class="n-label">{{ displayLabel(data.type, data.label, t) }}</div>
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
              ><ElInput
                v-model="selected.data.label"
                :placeholder="displayLabel(selected.data.type, '', t)"
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

            <!-- foreach -->
            <template v-if="selected.data.type === 'foreach'">
              <ElFormItem :label="$t('aiAppDesign.inputPath')" required>
                <ElInput
                  v-model="selected.data.inputPath"
                  :placeholder="$t('aiAppDesign.inputPathPlaceholder')"
                />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.itemVar')">
                <ElInput v-model="selected.data.itemVar" placeholder="item" />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.indexVar')">
                <ElInput v-model="selected.data.indexVar" placeholder="index" />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.maxIterations')">
                <ElInputNumber
                  v-model="selected.data.maxIterations"
                  :min="1"
                  :max="100"
                  controls-position="right"
                />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.timeoutMs')">
                <ElInputNumber
                  v-model="selected.data.timeoutMs"
                  :min="1000"
                  :max="300000"
                  :step="1000"
                  controls-position="right"
                />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.aggregate')">
                <ElSelect v-model="selected.data.aggregate" style="width: 100%">
                  <ElOption :label="$t('aiAppDesign.aggregateArray')" value="array" />
                  <ElOption :label="$t('aiAppDesign.aggregateLast')" value="last" />
                  <ElOption :label="$t('aiAppDesign.aggregateNone')" value="none" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.onItemFailure')">
                <ElSelect v-model="selected.data.onItemFailure" style="width: 100%">
                  <ElOption :label="$t('aiAppDesign.onFailContinue')" value="continue" />
                  <ElOption :label="$t('aiAppDesign.onFailAbort')" value="abort" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.bodyNodeIds')">
                <ElSelect
                  :model-value="selected.data.bodyNodeIds || []"
                  multiple
                  filterable
                  style="width: 100%"
                  :placeholder="$t('aiAppDesign.bodyNodeIdsHint')"
                  @update:model-value="onBodyNodeIdsChange"
                >
                  <ElOption
                    v-for="opt in bodyOptions"
                    :key="opt.id"
                    :label="opt.label"
                    :value="opt.id"
                  />
                </ElSelect>
              </ElFormItem>
            </template>

            <!-- parallel -->
            <template v-if="selected.data.type === 'parallel'">
              <ElFormItem :label="$t('aiAppDesign.waitAll')">
                <ElSwitch :model-value="true" disabled />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.onBranchFailure')">
                <ElSelect v-model="selected.data.onBranchFailure" style="width: 100%" disabled>
                  <ElOption :label="$t('aiAppDesign.onFailContinue')" value="continue" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.maxBranches')">
                <ElInputNumber
                  v-model="selected.data.maxBranches"
                  :min="2"
                  :max="16"
                  controls-position="right"
                />
              </ElFormItem>
              <ElFormItem :label="$t('aiAppDesign.timeoutMs')">
                <ElInputNumber
                  v-model="selected.data.timeoutMs"
                  :min="1000"
                  :max="300000"
                  :step="1000"
                  controls-position="right"
                />
              </ElFormItem>
              <div class="branches-block">
                <div class="branches-hd">
                  <span>{{ $t('aiAppDesign.branches') }}</span>
                  <ElButton
                    link
                    type="primary"
                    size="small"
                    :disabled="
                      (selected.data.branches || []).length >= (selected.data.maxBranches || 8)
                    "
                    @click="addBranch"
                    >{{ $t('aiAppDesign.addBranch') }}</ElButton
                  >
                </div>
                <div
                  v-for="(b, bi) in selected.data.branches || []"
                  :key="b.id || bi"
                  class="branch-card"
                >
                  <div class="branch-row">
                    <ElInput
                      v-model="b.id"
                      size="small"
                      :placeholder="$t('aiAppDesign.branchId')"
                      style="width: 88px"
                    />
                    <ElInput
                      v-model="b.label"
                      size="small"
                      :placeholder="$t('aiAppDesign.branchLabel')"
                    />
                    <ElButton
                      v-if="(selected.data.branches || []).length > 2"
                      link
                      type="danger"
                      size="small"
                      @click="removeBranch(bi)"
                      >{{ $t('aiAppDesign.removeBranch') }}</ElButton
                    >
                  </div>
                  <ElSelect
                    :model-value="b.bodyNodeIds || []"
                    multiple
                    filterable
                    size="small"
                    style="width: 100%; margin-top: 6px"
                    :placeholder="$t('aiAppDesign.branchBody')"
                    @update:model-value="(v) => onBranchBodyChange(bi, v)"
                  >
                    <ElOption
                      v-for="opt in bodyOptions"
                      :key="opt.id"
                      :label="opt.label"
                      :value="opt.id"
                    />
                  </ElSelect>
                  <ElInput
                    v-model="b.outputVar"
                    size="small"
                    style="margin-top: 6px"
                    :placeholder="$t('aiAppDesign.outputVar')"
                  />
                </div>
              </div>
            </template>

            <ElFormItem
              v-if="selected.data.type !== 'start' && selected.data.type !== 'end'"
              :label="$t('aiAppDesign.outputVar')"
            >
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

    <div v-if="controlOutputs.length" class="control-detail">
      <h4>{{ $t('aiAppDesign.runControlDetail') }}</h4>
      <div v-for="c in controlOutputs" :key="c.nodeId + c.nodeType" class="control-card">
        <div class="control-hd">
          <ElTag size="small">{{ c.nodeType }}</ElTag>
          <span class="cid">{{ c.nodeId }}</span>
          <ElTag v-if="c.truncated" type="warning" size="small">{{
            $t('aiAppDesign.truncated')
          }}</ElTag>
          <ElTag v-if="c.partial" type="warning" size="small">{{
            $t('aiAppDesign.partial')
          }}</ElTag>
        </div>
        <div v-if="c.iterations?.length" class="control-sec">
          <div class="sec-title"
            >{{ $t('aiAppDesign.iterations') }} ({{ c.ranCount ?? c.iterations.length }}/{{
              c.inputCount ?? '?'
            }})</div
          >
          <pre class="mini">{{ JSON.stringify(c.iterations, null, 2) }}</pre>
        </div>
        <div v-if="c.branches?.length" class="control-sec">
          <div class="sec-title">{{ $t('aiAppDesign.parallelBranches') }}</div>
          <pre class="mini">{{ JSON.stringify(c.branches, null, 2) }}</pre>
        </div>
      </div>
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
  import {
    fetchAiAppDetail,
    fetchAiAppRunDetail,
    fetchRunAiApp,
    fetchSaveAiAppDsl,
    fetchShareAiApp
  } from '../../api'
  import { displayLabel, RUN_SAMPLE_INPUT, withStoredLabel } from './flowNodes'
  import {
    bodyCandidateNodes,
    defaultDataForType,
    extractControlOutputs,
    findLooseFlowNodes,
    isAiFlowControlMockEnabled,
    normalizeControlData,
    syncOrderedIds,
    validateControlNode,
    type ControlNodeOutput,
    type ParallelBranch
  } from './flowControl'

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
  const controlOutputs = ref<ControlNodeOutput[]>([])
  const mockOn = isAiFlowControlMockEnabled()
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
        { type: 'switch', label: t('aiAppDesign.nodeSwitch') },
        { type: 'foreach', label: t('aiAppDesign.nodeForeach') },
        { type: 'parallel', label: t('aiAppDesign.nodeParallel') }
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

  const bodyOptions = computed(() =>
    bodyCandidateNodes(
      nodes.value.map((n) => ({ id: n.id, data: n.data as any })),
      selected.value?.id
    ).map((n) => ({
      id: n.id,
      label: `${displayLabel(n.data?.type, n.data?.label, t)} (${n.id})`
    }))
  )

  /** 与 defaultData/normalize 去重：点选时补默认并强制 waitAll */
  function ensureControlDefaults(data: Record<string, any>) {
    const type = String(data?.type || '')
    if (type !== 'foreach' && type !== 'parallel') return
    Object.assign(data, normalizeControlData(type, data))
  }

  function onBodyNodeIdsChange(next: string[]) {
    if (!selected.value || selected.value.data?.type !== 'foreach') return
    selected.value.data.bodyNodeIds = syncOrderedIds(selected.value.data.bodyNodeIds, next)
  }

  function onBranchBodyChange(bi: number, next: string[]) {
    if (!selected.value || selected.value.data?.type !== 'parallel') return
    const branches = selected.value.data.branches as ParallelBranch[]
    if (!branches?.[bi]) return
    branches[bi].bodyNodeIds = syncOrderedIds(branches[bi].bodyNodeIds, next)
  }

  function addBranch() {
    if (!selected.value || selected.value.data?.type !== 'parallel') return
    ensureControlDefaults(selected.value.data)
    const branches = selected.value.data.branches as ParallelBranch[]
    const max = Number(selected.value.data.maxBranches) || 8
    if (branches.length >= max) return
    const n = branches.length + 1
    const id = `b${n}`
    branches.push({ id, label: '', bodyNodeIds: [], outputVar: `branch_${id}` })
  }

  function removeBranch(bi: number) {
    if (!selected.value || selected.value.data?.type !== 'parallel') return
    const branches = selected.value.data.branches as ParallelBranch[]
    if (!branches || branches.length <= 2) return
    branches.splice(bi, 1)
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
      data: defaultDataForType(n.type)
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

  /** 保存前校验（UX-106）：恰好一个开始、一个结束；bodyNodeIds 引用不算孤立 */
  function validateFlow(): string | null {
    const label = (n: Node) => displayLabel(n.data?.type, n.data?.label, t) || n.id
    const starts = nodes.value.filter((n) => n.data?.type === 'start')
    const ends = nodes.value.filter((n) => n.data?.type === 'end')
    if (starts.length !== 1) return t('aiAppDesign.needOneStart', { n: starts.length })
    if (ends.length !== 1) return t('aiAppDesign.needOneEnd', { n: ends.length })
    const flowNodes = nodes.value.map((n) => ({ id: n.id, data: n.data as any }))
    const loose = findLooseFlowNodes(
      flowNodes,
      edges.value.map((e) => ({ source: e.source, target: e.target }))
    )
    if (loose.length) {
      const names = loose.map((n) => label({ id: n.id, data: n.data } as Node)).join(', ')
      return t('aiAppDesign.looseNodes', { names })
    }

    const byId = new Map(flowNodes.map((n) => [n.id, n]))
    for (const n of flowNodes) {
      const err = validateControlNode(n, byId)
      if (err) {
        const detail = t(err.messageKey, err.params ?? {})
        return t('aiAppDesign.controlValidateFailed', {
          msg: `${label({ id: n.id, data: n.data } as Node)}: ${detail} (${err.code})`
        })
      }
    }
    return null
  }

  function onNodeClick({ node }: { node: Node }) {
    if (node.data?.type === 'foreach' || node.data?.type === 'parallel') {
      ensureControlDefaults(node.data)
    }
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
      nodes: nodes.value.map((n) => {
        const type = n.data?.type || n.type
        const raw = withStoredLabel(type, n.data) as Record<string, any>
        const data =
          type === 'foreach' || type === 'parallel' ? normalizeControlData(type, raw) : raw
        return {
          id: n.id,
          type,
          position: n.position,
          data
        }
      }),
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
      nodes.value = (dsl.nodes || []).map((n: any) => {
        const type = n.data?.type || n.type
        let data = {
          ...withStoredLabel(type, n.data),
          type
        } as Record<string, any>
        if (type === 'foreach' || type === 'parallel') {
          data = normalizeControlData(type, data)
        }
        return {
          id: n.id,
          type: 'custom',
          position: n.position || { x: 0, y: 0 },
          data
        }
      })
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

  async function applyRunDetail(runId: string | number) {
    try {
      const detail = await fetchAiAppRunDetail(runId)
      const list = (detail?.nodes || []).map((nr: any) => ({
        nodeId: nr.nodeId || nr.node_id,
        nodeType: nr.nodeType || nr.node_type,
        outputJson: nr.outputJson || nr.output_json
      }))
      controlOutputs.value = extractControlOutputs(list)
    } catch {
      // 详情拉取失败时仍保留 run 原文
    }
  }

  async function run() {
    running.value = true
    controlOutputs.value = []
    try {
      if (mockOn) {
        const { buildAiFlowControlMock } = await import('./flowControlMock')
        const r = buildAiFlowControlMock({
          id: appId.value,
          dsl: buildDsl(),
          input: RUN_SAMPLE_INPUT
        })
        controlOutputs.value = r.controlOutputs
        runResult.value = JSON.stringify(r, null, 2)
        return
      }
      const r = await fetchRunAiApp({ id: appId.value, input: RUN_SAMPLE_INPUT })
      runResult.value = typeof r === 'string' ? r : JSON.stringify(r, null, 2)
      const runId = (r as any)?.runId
      if (runId != null) await applyRunDetail(runId)
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

  .mock-hint {
    margin: 0;
  }

  .flow-layout {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(160px, 180px) minmax(280px, 1fr) minmax(260px, 300px);
    gap: 8px;
    min-height: 520px;
    overflow: auto hidden;
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

  .branches-block {
    margin-bottom: 8px;
  }

  .branches-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .branch-card {
    padding: 8px;
    margin-bottom: 8px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .branch-row {
    display: flex;
    gap: 6px;
    align-items: center;
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

  .control-detail {
    padding: 10px 12px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }

  .control-detail h4 {
    margin: 0 0 8px;
    font-size: 14px;
  }

  .control-card {
    padding: 8px;
    margin-bottom: 8px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .control-hd {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }

  .cid {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .sec-title {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .mini {
    max-height: 180px;
    padding: 6px;
    margin: 0;
    overflow: auto;
    font-size: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
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
