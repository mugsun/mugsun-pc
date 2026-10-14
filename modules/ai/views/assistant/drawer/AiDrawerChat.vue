<template>
  <div ref="rootRef" class="ai-dchat" :class="{ 'is-narrow': narrow }">
    <!-- 顶栏：一行，左会话标题（点开历史），右三个图标按钮 -->
    <header class="ai-dchat__hd">
      <ElPopover
        v-model:visible="historyOpen"
        trigger="click"
        placement="bottom-start"
        :width="320"
        :show-arrow="false"
        popper-class="ai-dchat-history"
        :teleported="true"
      >
        <template #reference>
          <button
            type="button"
            class="ai-dchat__title"
            :aria-label="$t('aiDrawer.history')"
            :aria-expanded="historyOpen"
          >
            <span class="ai-dchat__title-text">{{ titleText }}</span>
            <ElIcon :size="16"><ArrowDown /></ElIcon>
          </button>
        </template>
        <div class="ai-dchat-history__body">
          <ElInput
            v-model="historyKeyword"
            :prefix-icon="Search"
            :placeholder="$t('aiDrawer.searchHistory')"
            clearable
          />
          <div v-if="!filteredSessions.length" class="ai-dchat-history__empty">{{
            $t('aiDrawer.noHistory')
          }}</div>
          <Conversations
            v-else
            :active="activeId ?? undefined"
            :items="conversationItems"
            row-key="id"
            label-key="label"
            :groupable="{ sort: groupSort }"
            :menu="sessionMenu"
            :show-built-in-menu="true"
            :label-height="20"
            :items-style="{ height: '36px', padding: '0 8px', marginBottom: '0' }"
            :style="{
              maxHeight: 'calc(60vh - 56px)',
              padding: '0',
              backgroundColor: 'var(--el-bg-color-overlay)'
            }"
            show-tooltip
            @change="onPickSession"
            @menu-command="onSessionCommand"
          />
        </div>
      </ElPopover>
      <div class="ai-dchat__tools">
        <ElTooltip :content="$t('aiDrawer.newChat')" placement="bottom">
          <ElButton
            text
            class="ai-dchat__icon-btn"
            :aria-label="$t('aiDrawer.newChat')"
            :disabled="streaming"
            @click="newChat"
          >
            <ElIcon :size="20"><Plus /></ElIcon>
          </ElButton>
        </ElTooltip>
        <ElTooltip
          v-if="canFullscreen"
          :content="fullscreen ? $t('aiDrawer.restore') : $t('aiDrawer.fullscreen')"
          placement="bottom"
        >
          <ElButton
            text
            class="ai-dchat__icon-btn"
            :aria-label="fullscreen ? $t('aiDrawer.restore') : $t('aiDrawer.fullscreen')"
            @click="$emit('toggle-fullscreen')"
          >
            <ElIcon :size="16"><component :is="fullscreen ? Aim : FullScreen" /></ElIcon>
          </ElButton>
        </ElTooltip>
        <ElTooltip :content="$t('aiDrawer.close')" placement="bottom">
          <ElButton
            text
            class="ai-dchat__icon-btn"
            :aria-label="$t('aiDrawer.close')"
            @click="$emit('close')"
          >
            <ElIcon :size="20"><Close /></ElIcon>
          </ElButton>
        </ElTooltip>
      </div>
    </header>

    <!-- 消息区 -->
    <main
      class="ai-dchat__main"
      tabindex="0"
      :aria-label="$t('aiDrawer.messages')"
      @click="onMainClick"
    >
      <div v-if="!messages.length" class="ai-dchat__welcome">
        <Welcome
          variant="borderless"
          :title="$t('aiDrawer.welcomeTitle')"
          :description="$t('aiDrawer.welcomeDesc')"
          :class-names="{ title: 'ai-dchat__w-title', description: 'ai-dchat__w-desc' }"
        >
          <template #image>
            <div class="ai-dchat__logo"><ArtLogo :size="32" /></div>
          </template>
        </Welcome>
        <div class="ai-dchat__prompts" :class="{ 'is-single': promptSingle }">
          <Prompts :items="promptItems" wrap @item-click="onPromptClick" />
        </div>
      </div>
      <BubbleList
        v-else
        ref="bubbleListRef"
        class="ai-dchat__list"
        :list="bubbleItems"
        max-height="100%"
        item-key="key"
        :show-back-button="true"
        :btn-color="'var(--el-color-primary)'"
      >
        <template #content="{ item }">
          <div v-if="item.role === 'user'" class="ai-dmsg-user">{{ item.content }}</div>
          <div v-else class="ai-dmsg-ai">
            <ElCollapse v-if="item.raw.thinkContent" class="ai-dmsg-ai__think">
              <ElCollapseItem :title="$t('aiChat.thinking')" name="1">
                <pre>{{ item.raw.thinkContent }}</pre>
              </ElCollapseItem>
            </ElCollapse>
            <div
              v-if="item.raw.content"
              class="ai-dmsg-ai__md"
              v-html="renderMarkdown(item.raw.content, $t('aiDrawer.copy'))"
            />
            <div
              v-if="item.raw.pending && !item.raw.content"
              class="ai-dmsg-typing"
              :aria-label="$t('aiDrawer.generating')"
            >
              <i /><i /><i />
            </div>
            <ElAlert
              v-if="item.raw.error"
              class="ai-dmsg-ai__err"
              type="error"
              :title="item.raw.error"
              :closable="false"
              show-icon
            >
              <ElButton size="small" tabindex="-1" :disabled="streaming" @click="retry(item.raw)">
                {{ $t('aiDrawer.retry') }}
              </ElButton>
            </ElAlert>
            <div v-if="item.raw.refs?.length" class="ai-dmsg-ai__refs">
              <div class="ai-dmsg-ai__refs-title">{{
                $t('aiChat.refs', { n: item.raw.refs.length })
              }}</div>
              <div v-for="(r, ri) in item.raw.refs" :key="ri" class="ai-dmsg-ai__ref">
                <span class="ai-dmsg-ai__ref-meta">
                  #{{ ri + 1 }}
                  <template v-if="r.score != null"> · {{ Number(r.score).toFixed(3) }}</template>
                  <template v-if="r.source"> · {{ r.source }}</template>
                </span>
                <div>{{ r.content }}</div>
              </div>
            </div>
          </div>
        </template>
        <template #footer="{ item }">
          <div
            v-if="!item.raw.pending && !item.raw.error"
            class="ai-dmsg-actions"
            :class="{ 'is-user': item.role === 'user' }"
          >
            <ElTooltip
              :content="copiedKey === item.key ? $t('aiDrawer.copied') : $t('aiDrawer.copy')"
              placement="top"
            >
              <ElButton
                text
                size="small"
                class="ai-dmsg-actions__btn"
                tabindex="-1"
                :aria-label="$t('aiDrawer.copy')"
                @click="copyMessage(item)"
              >
                <ElIcon :size="16">
                  <component :is="copiedKey === item.key ? Check : CopyDocument" />
                </ElIcon>
              </ElButton>
            </ElTooltip>
            <span v-if="item.role === 'assistant' && item.raw.modelName" class="ai-dmsg-meta">
              {{ item.raw.modelName }}
              <template v-if="item.raw.tokens"> · {{ item.raw.tokens }} tokens</template>
            </span>
          </div>
        </template>
      </BubbleList>
    </main>

    <!-- 没配模型 -->
    <div v-if="modelsLoaded && !chatModels.length" class="ai-dchat__nomodel" role="status">
      <ElIcon :size="16"><WarningFilled /></ElIcon>
      <span class="ai-dchat__nomodel-text">{{ $t('aiDrawer.noModel') }}</span>
      <ElButton v-if="canConfigModel" type="primary" link @click="goConfigModel">{{
        $t('aiDrawer.goConfig')
      }}</ElButton>
      <span v-else class="ai-dchat__nomodel-hint">{{ $t('aiDrawer.contactAdmin') }}</span>
    </div>

    <!-- 输入卡片 -->
    <div ref="composerRef" class="ai-dchat__composer" @keydown.capture="onComposerTab">
      <XSender
        ref="senderRef"
        class="ai-dchat__sender"
        :placeholder="$t('aiDrawer.placeholder')"
        :auto-focus="true"
        :disabled="false"
        submit-type="enter"
        :custom-style="senderStyle"
        @change="onSenderChange"
        @submit="onSubmit"
      >
        <template #action-list><span /></template>
        <template #footer>
          <div class="ai-dchat__toolbar">
            <div class="ai-dchat__chips">
              <template v-if="!narrow">
                <ElDropdown
                  trigger="click"
                  placement="top-start"
                  max-height="280px"
                  popper-class="ai-dchat-chip-menu"
                  @command="pickModel"
                >
                  <button type="button" class="ai-dchat__chip" :aria-label="$t('aiDrawer.model')">
                    <ElTooltip :content="modelLabel" placement="top" :show-after="300">
                      <span class="ai-dchat__chip-text">{{ modelLabel }}</span>
                    </ElTooltip>
                    <ElIcon :size="12"><ArrowDown /></ElIcon>
                  </button>
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem
                        v-for="m in chatModels"
                        :key="m.id"
                        :command="m.id"
                        :class="{ 'is-active': m.id === modelId }"
                        >{{ m.modelName }}</ElDropdownItem
                      >
                      <ElDropdownItem v-if="!chatModels.length" disabled>{{
                        $t('aiDrawer.noModel')
                      }}</ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
                <ElDropdown
                  trigger="click"
                  placement="top-start"
                  max-height="280px"
                  popper-class="ai-dchat-chip-menu"
                  @command="pickKnowledge"
                >
                  <button
                    type="button"
                    class="ai-dchat__chip"
                    :class="{ 'is-placeholder': !knowledgeId }"
                    :aria-label="$t('aiDrawer.knowledge')"
                  >
                    <ElTooltip :content="knowledgeLabel" placement="top" :show-after="300">
                      <span class="ai-dchat__chip-text">{{ knowledgeLabel }}</span>
                    </ElTooltip>
                    <ElIcon :size="12"><ArrowDown /></ElIcon>
                  </button>
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem :command="NONE">{{
                        $t('aiDrawer.noKnowledge')
                      }}</ElDropdownItem>
                      <ElDropdownItem
                        v-for="k in knowledgeList"
                        :key="k.id"
                        :command="k.id"
                        :class="{ 'is-active': k.id === knowledgeId }"
                        >{{ k.name }}</ElDropdownItem
                      >
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </template>
              <ElPopover v-else trigger="click" placement="top-start" :width="260">
                <template #reference>
                  <ElButton text class="ai-dchat__icon-btn" :aria-label="$t('aiDrawer.settings')">
                    <ElIcon :size="16"><Setting /></ElIcon>
                  </ElButton>
                </template>
                <div class="ai-dchat__settings">
                  <label>{{ $t('aiDrawer.model') }}</label>
                  <ElSelect
                    :model-value="modelId ?? undefined"
                    :placeholder="$t('aiDrawer.selectModel')"
                    :teleported="false"
                    @change="pickModel"
                  >
                    <ElOption
                      v-for="m in chatModels"
                      :key="m.id"
                      :label="m.modelName"
                      :value="m.id"
                    />
                  </ElSelect>
                  <label>{{ $t('aiDrawer.knowledge') }}</label>
                  <ElSelect
                    :model-value="knowledgeId ?? NONE"
                    :teleported="false"
                    @change="pickKnowledge"
                  >
                    <ElOption :label="$t('aiDrawer.noKnowledge')" :value="NONE" />
                    <ElOption
                      v-for="k in knowledgeList"
                      :key="k.id"
                      :label="k.name"
                      :value="k.id"
                    />
                  </ElSelect>
                </div>
              </ElPopover>
            </div>
            <div class="ai-dchat__actions">
              <ElTooltip
                :content="streaming ? $t('aiDrawer.stop') : $t('aiDrawer.send')"
                placement="top"
              >
                <button
                  type="button"
                  class="ai-dchat__send"
                  :class="{ 'is-stop': streaming }"
                  :disabled="!streaming && senderEmpty"
                  :aria-label="streaming ? $t('aiDrawer.stop') : $t('aiDrawer.send')"
                  @click="streaming ? stopStream() : onSubmit()"
                >
                  <span v-if="streaming" class="ai-dchat__stop-square" />
                  <ElIcon v-else :size="16"><Top /></ElIcon>
                </button>
              </ElTooltip>
            </div>
          </div>
        </template>
      </XSender>
      <div class="ai-dchat__disclaimer">{{ $t('aiDrawer.disclaimer') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useClipboard, useElementSize } from '@vueuse/core'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    Aim,
    ArrowDown,
    Check,
    Close,
    CopyDocument,
    FullScreen,
    Plus,
    Search,
    Setting,
    Top,
    WarningFilled
  } from '@element-plus/icons-vue'
  import { BubbleList, Conversations, Prompts, Welcome, XSender } from 'vue-element-plus-x'
  import { hasPerm } from '@/utils/permission'
  import { handleCodeCopy, renderMarkdown } from '../renderMarkdown'
  import { displaySessionTitle, newSessionTitle } from '../sessionTitle'
  import { SESSION_GROUP_ORDER, sessionGroupOf } from './drawerLayout'
  import {
    fetchAiChatStop,
    fetchAiChatStream,
    fetchAiKnowledgePage,
    fetchAiMessageList,
    fetchAiModelPage,
    fetchAiSessionPage,
    fetchClearAiSession,
    fetchExportAiSession,
    fetchRemoveAiSession,
    fetchSaveAiSession
  } from '../../../api'

  defineProps<{ fullscreen?: boolean; canFullscreen?: boolean }>()
  const emit = defineEmits<{ 'toggle-fullscreen': []; close: [] }>()

  const { t } = useI18n()
  const NONE = '__none__'

  interface ChatMsg {
    id?: string | number
    uid: number
    role: 'user' | 'assistant' | 'system'
    content: string
    thinkContent?: string
    modelName?: string
    tokens?: number
    requestId?: string
    refs?: Array<{ content?: string; score?: number; source?: string }>
    pending?: boolean
    /** 出错前后端是否已写入这次提问（收到过 SSE 事件） */
    persisted?: boolean
    error?: string
    /** 这条回答对应的提问，用于重试/重新生成 */
    question?: string
  }

  let uidSeed = 0
  const nextUid = () => ++uidSeed

  // —— 尺寸 ——
  const rootRef = ref<HTMLElement | null>(null)
  const { width: rootWidth } = useElementSize(rootRef)
  /** 390 这类窄宽：两个 chip 合成「设置」 */
  const narrow = computed(() => rootWidth.value > 0 && rootWidth.value < 440)
  /** 抽屉内容宽小于 480：示例问题改一列 */
  const promptSingle = computed(() => rootWidth.value > 0 && rootWidth.value < 480)
  /** 1–8 行：行高 22px，上下内边距 12px */
  const senderStyle = { maxHeight: `${22 * 8 + 24}px`, minHeight: `${22 + 24}px` }

  // —— 数据 ——
  const sessions = ref<any[]>([])
  const activeId = ref<string | number | null>(null)
  const activeSession = ref<any>(null)
  const messages = ref<ChatMsg[]>([])
  const chatModels = ref<any[]>([])
  const modelsLoaded = ref(false)
  const knowledgeList = ref<any[]>([])
  const modelId = ref<string | number | null>(null)
  const knowledgeId = ref<string | number | null>(null)
  const streaming = ref(false)
  const requestId = ref('')
  const abortCtrl = ref<AbortController | null>(null)
  const senderRef = ref<any>(null)
  const senderEmpty = ref(true)
  const historyOpen = ref(false)
  const historyKeyword = ref('')

  const canConfigModel = computed(() => hasPerm('ai:model:save'))

  const titleText = computed(() =>
    activeSession.value?.title
      ? displaySessionTitle(activeSession.value.title, t)
      : t('aiDrawer.title')
  )
  const modelLabel = computed(
    () =>
      chatModels.value.find((m) => m.id === modelId.value)?.modelName || t('aiDrawer.selectModel')
  )
  const knowledgeLabel = computed(
    () =>
      knowledgeList.value.find((k) => k.id === knowledgeId.value)?.name || t('aiDrawer.knowledge')
  )

  const promptItems = computed(() =>
    ['ex1', 'ex2', 'ex3', 'ex4'].map((k) => ({ key: k, label: t(`aiDrawer.${k}`) }))
  )

  const groupLabel = (g: string) => t(`aiDrawer.group${g.charAt(0).toUpperCase()}${g.slice(1)}`)
  const filteredSessions = computed(() => {
    const kw = historyKeyword.value.trim().toLowerCase()
    return sessions.value.filter(
      (s) => !kw || displaySessionTitle(s.title, t).toLowerCase().includes(kw)
    )
  })
  const conversationItems = computed(() =>
    filteredSessions.value.map((s) => ({
      ...s,
      id: s.id,
      label: displaySessionTitle(s.title, t),
      group: groupLabel(sessionGroupOf(s.updateTime || s.createTime))
    }))
  )
  const groupOrder = computed(() => SESSION_GROUP_ORDER.map(groupLabel))
  const groupSort = (a: string, b: string) =>
    groupOrder.value.indexOf(a) - groupOrder.value.indexOf(b)
  const sessionMenu = computed(() => [
    { label: t('aiDrawer.rename'), key: 'rename', command: 'rename' },
    { label: t('aiDrawer.export'), key: 'export', command: 'export' },
    { label: t('aiDrawer.clear'), key: 'clear', command: 'clear' },
    { label: t('aiDrawer.delete'), key: 'delete', command: 'delete', divided: true }
  ])

  const bubbleItems = computed(() => {
    return messages.value
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        key: m.uid,
        role: m.role,
        content: m.content,
        placement: m.role === 'user' ? ('end' as const) : ('start' as const),
        noStyle: true,
        raw: m
      }))
  })

  // —— 加载 ——
  async function loadModels() {
    try {
      const res = await fetchAiModelPage({ pageNum: 1, pageSize: 100, modelType: 'chat' })
      chatModels.value = (res?.records ?? []).filter((m: any) => m.activateFlag !== 0)
      const def = chatModels.value.find((m: any) => m.defaultFlag === 1) || chatModels.value[0]
      if (!modelId.value && def) modelId.value = def.id
    } catch {
      chatModels.value = []
    } finally {
      modelsLoaded.value = true
    }
  }

  async function loadKnowledge() {
    try {
      const res = await fetchAiKnowledgePage({ pageNum: 1, pageSize: 100 })
      knowledgeList.value = res?.records ?? []
    } catch {
      knowledgeList.value = []
    }
  }

  async function loadSessions(selectFirst = true) {
    const res = await fetchAiSessionPage({ pageNum: 1, pageSize: 50, source: 'assistant' })
    sessions.value = res?.records ?? []
    if (selectFirst && !activeId.value && sessions.value[0]) await selectSession(sessions.value[0])
  }

  async function selectSession(s: any) {
    activeId.value = s.id
    activeSession.value = s
    modelId.value = s.modelId || modelId.value
    const list = await fetchAiMessageList(s.id)
    let lastQuestion = ''
    messages.value = (list || []).map((m: any) => {
      if (m.role === 'user') lastQuestion = m.content || ''
      return {
        id: m.id,
        uid: nextUid(),
        role: m.role,
        content: m.content || '',
        thinkContent: m.thinkContent,
        modelName: m.modelName,
        tokens: m.tokens,
        requestId: m.requestId,
        question: m.role === 'assistant' ? lastQuestion : undefined
      }
    })
  }

  function newChat() {
    // 只清当前选中，第一次发送时再建会话，避免空会话堆积
    activeId.value = null
    activeSession.value = null
    messages.value = []
    senderRef.value?.focus?.('end')
  }

  async function ensureSession(): Promise<boolean> {
    if (activeId.value) return true
    const row = await fetchSaveAiSession({
      title: newSessionTitle(sessions.value.length + 1),
      source: 'assistant',
      modelId: modelId.value
    })
    await loadSessions(false)
    const found = sessions.value.find((x) => x.id === row?.id) || row
    if (!found?.id) return false
    activeId.value = found.id
    activeSession.value = found
    return true
  }

  function onPickSession(item: any) {
    historyOpen.value = false
    const s = sessions.value.find((x) => x.id === item?.id)
    if (s && s.id !== activeId.value) void selectSession(s)
  }

  async function onSessionCommand(command: unknown, item: any) {
    const s = sessions.value.find((x) => x.id === item?.id)
    if (!s) return
    if (command === 'rename') {
      const { value } = await ElMessageBox.prompt('', t('aiDrawer.rename'), {
        inputValue: displaySessionTitle(s.title, t),
        inputPlaceholder: t('aiDrawer.renamePlaceholder'),
        inputValidator: (v: string) => !!v?.trim() || t('aiDrawer.renamePlaceholder')
      }).catch(() => ({ value: '' }))
      const title = value.trim()
      if (!title || title === s.title) return
      await fetchSaveAiSession({ id: s.id, title })
      s.title = title
      if (activeSession.value?.id === s.id) activeSession.value.title = title
    } else if (command === 'export') {
      await fetchExportAiSession(s.id)
    } else if (command === 'clear') {
      await ElMessageBox.confirm(t('aiChat.clearConfirm'), t('aiChat.confirmTitle'))
      await fetchClearAiSession(s.id)
      if (s.id === activeId.value) messages.value = []
    } else if (command === 'delete') {
      await ElMessageBox.confirm(
        t('aiChat.removeConfirm', { name: displaySessionTitle(s.title, t) }),
        t('aiChat.confirmTitle'),
        { type: 'warning' }
      )
      await fetchRemoveAiSession(s.id)
      sessions.value = sessions.value.filter((x) => x.id !== s.id)
      if (s.id === activeId.value) newChat()
    }
  }

  async function pickModel(id: string | number) {
    modelId.value = id
    if (activeId.value) {
      await fetchSaveAiSession({ id: activeId.value, modelId: id })
      if (activeSession.value) activeSession.value.modelId = id
    }
  }

  function pickKnowledge(id: string | number) {
    knowledgeId.value = id === NONE ? null : id
  }

  function goConfigModel() {
    emit('close')
    window.location.hash = '#/ai/model'
  }

  // —— 输入 ——
  function onSenderChange() {
    const v = senderRef.value?.getModelValue?.()
    senderEmpty.value = !v?.text?.trim()
  }

  function onSubmit() {
    if (streaming.value) return
    const text = String(senderRef.value?.getModelValue?.()?.text || '').trim()
    if (!text) return
    senderRef.value?.onClear?.()
    senderEmpty.value = true
    void ask(text)
  }

  function onPromptClick(item: { label?: string }) {
    if (item?.label && !streaming.value) void ask(item.label)
  }

  // —— 发送 / 流式 ——
  async function ask(text: string) {
    if (!(await ensureSession())) {
      ElMessage.warning(t('aiChat.createFirst'))
      return
    }
    messages.value.push({ uid: nextUid(), role: 'user', content: text })
    const assistant: ChatMsg = {
      uid: nextUid(),
      role: 'assistant',
      content: '',
      pending: true,
      question: text
    }
    messages.value.push(assistant)
    await stream(assistant)
  }

  /**
   * 重试：只在出错的那条回答上出现，原地替换这一条，界面上不再插入一遍问题。
   * 后端没有「重新生成」接口：/chat/stream 每次都会先写入用户消息。
   * 如果上次是流式过程中出错（问题已入库），重试会在后端历史里再写一次问题，
   * 已在 mugsun-boot 提 issue 请加重新生成接口；校验阶段出错（未入库）不受影响。
   */
  async function retry(msg: ChatMsg) {
    if (streaming.value || !msg.question) return
    const target = messages.value.find((m) => m.uid === msg.uid)
    if (!target) return
    target.content = ''
    target.thinkContent = ''
    target.refs = undefined
    target.error = undefined
    target.pending = true
    await stream(target)
  }

  async function stream(assistant: ChatMsg) {
    // 拿到响应式代理，后续写入才会触发更新
    const msg = messages.value.find((m) => m.uid === assistant.uid) || assistant
    streaming.value = true
    requestId.value = crypto.randomUUID().replace(/-/g, '')
    const finish = () => {
      msg.pending = false
      streaming.value = false
      abortCtrl.value = null
    }
    abortCtrl.value = await fetchAiChatStream(
      {
        sessionId: activeId.value,
        modelId: modelId.value,
        knowledgeId: knowledgeId.value || undefined,
        content: msg.question,
        requestId: requestId.value
      },
      {
        onChunk: (c) => {
          msg.content += c
        },
        onThink: (c) => {
          msg.thinkContent = (msg.thinkContent || '') + c
        },
        onRefs: (refs: any) => {
          const list = Array.isArray(refs) ? refs : refs?.refs
          if (Array.isArray(list)) msg.refs = list
        },
        onUsage: (u: any) => {
          msg.tokens = u?.totalTokens ?? u?.tokens
          msg.modelName =
            u?.modelName || chatModels.value.find((m) => m.id === modelId.value)?.modelName
        },
        onEvent: (_ev, data) => {
          msg.persisted = true
          try {
            const j = JSON.parse(data)
            if (j?.requestId) requestId.value = j.requestId
          } catch {
            /* ignore */
          }
        },
        onDone: finish,
        onError: (m) => {
          finish()
          // 错误留在这条消息里，带重试；不只弹 toast
          msg.error = m || t('aiChat.genFailed')
        }
      }
    )
  }

  async function stopStream() {
    abortCtrl.value?.abort()
    abortCtrl.value = null
    const last = [...messages.value].reverse().find((m) => m.pending)
    if (last) last.pending = false
    streaming.value = false
    if (!requestId.value) return
    try {
      await fetchAiChatStop(requestId.value)
    } catch {
      /* 拦截器已经提示 */
    }
  }

  // —— 复制 ——
  const { copy } = useClipboard({ legacy: true })
  const copiedKey = ref<number | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | undefined
  async function copyMessage(item: { key: number; content: string }) {
    await copy(item.content)
    copiedKey.value = item.key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copiedKey.value = null), 1500)
  }

  /** 代码块复制按钮（v-html 里，用事件委托） */
  function onMainClick(e: MouseEvent) {
    void handleCodeCopy(e, copy, t('aiDrawer.copy'), t('aiDrawer.copied'))
  }

  watch(activeId, () => {
    requestId.value = ''
  })

  /**
   * XSender 的编辑区会吞掉 Tab（焦点出不去）。在捕获阶段接管：
   * Tab 去模型 chip（窄宽时是「设置」），Shift+Tab 回到消息区。
   */
  const composerRef = ref<HTMLElement | null>(null)
  function onComposerTab(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const target = e.target as HTMLElement | null
    if (!target?.isContentEditable) return
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      rootRef.value?.querySelector<HTMLElement>('.ai-dchat__main')?.focus()
    } else {
      composerRef.value
        ?.querySelector<HTMLElement>('.ai-dchat__chips button, .ai-dchat__send:not(:disabled)')
        ?.focus()
    }
  }

  /**
   * Tab 顺序：消息区（main）之后直接到输入框。
   * Chrome 会把可滚动的列表容器当成 Tab 停靠点，这里把它移出 Tab 序列。
   */
  const bubbleListRef = ref<any>(null)
  watch(
    bubbleListRef,
    async (v) => {
      await nextTick()
      const el = (v?.$el as HTMLElement | undefined)?.querySelector?.('.elx-bubble-list__list')
      el?.setAttribute('tabindex', '-1')
    },
    { flush: 'post' }
  )

  onMounted(async () => {
    // 抽屉打开时焦点落到输入框
    await nextTick()
    senderRef.value?.focus?.('end')
    await Promise.all([loadModels(), loadKnowledge(), loadSessions()])
  })
</script>

<style scoped>
  .ai-dchat {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
  }

  /* —— 顶栏 —— */
  .ai-dchat__hd {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .ai-dchat__title {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    min-width: 0;
    max-width: 240px;
    height: 32px;
    padding: 0 8px;
    margin-left: -8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    cursor: pointer;
    background: none;
    border: none;
    border-radius: 8px;
  }

  .ai-dchat__title:hover,
  .ai-dchat__title:focus-visible {
    background: var(--el-fill-color-light);
  }

  .ai-dchat__title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-dchat__tools {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
  }

  .ai-dchat__icon-btn.el-button {
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    color: var(--el-text-color-regular);
    border-radius: 8px;
  }

  /* —— 消息区 —— */
  .ai-dchat__main {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    outline: none;
  }

  .ai-dchat__list {
    height: 100%;
  }

  .ai-dchat__list :deep(.elx-bubble-list__list) {
    box-sizing: border-box;
    padding: 12px 16px;
  }

  /* 消息间距统一 16px：只用列表自带的 gap，单条不再加外边距 */
  .ai-dchat__list :deep(.elx-bubble) {
    padding: 0;
    margin: 0;
  }

  .ai-dchat__list :deep(.elx-bubble--end) {
    position: relative;
  }

  .ai-dchat__list :deep(.elx-bubble--end .elx-bubble__footer) {
    position: absolute;
    top: 50%;
    right: calc(100% + 4px);
    margin: 0;
    transform: translateY(-50%);
  }

  .ai-dchat__list :deep(.elx-bubble__content-wrapper .elx-bubble__content) {
    min-height: 0;
  }

  .ai-dchat__list :deep(.elx-bubble__content-wrapper .elx-bubble__footer) {
    margin-top: 4px;
  }

  .ai-dchat__list :deep(.elx-bubble--end .elx-bubble__content-wrapper .elx-bubble__footer) {
    margin: 0;
  }

  .ai-dchat__list :deep(.elx-bubble--start .elx-bubble__content-wrapper),
  .ai-dchat__list :deep(.elx-bubble--start .elx-bubble__content) {
    width: 100%;
    max-width: 100%;
  }

  .ai-dchat__list :deep(.elx-bubble--end .elx-bubble__content-wrapper) {
    max-width: 85%;
  }

  .ai-dmsg-user {
    padding: 8px 12px;
    font-size: 14px;
    line-height: 22px;
    word-break: break-word;
    white-space: pre-wrap;
    background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
    border-radius: 12px;
  }

  :global(html.dark) .ai-dmsg-user {
    background: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  }

  .ai-dmsg-ai {
    width: 100%;
    font-size: 14px;
    line-height: 22px;
    word-break: break-word;
  }

  .ai-dmsg-ai__think {
    margin-bottom: 8px;
  }

  .ai-dmsg-ai__think pre {
    margin: 0;
    white-space: pre-wrap;
  }

  .ai-dmsg-ai__err {
    margin-top: 8px;
  }

  .ai-dmsg-ai__err :deep(.el-alert__description) {
    margin-top: 8px;
  }

  .ai-dmsg-ai__refs {
    padding-top: 8px;
    margin-top: 8px;
    font-size: 12px;
    line-height: 20px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .ai-dmsg-ai__refs-title,
  .ai-dmsg-ai__ref-meta {
    color: var(--el-text-color-secondary);
  }

  .ai-dmsg-ai__ref {
    padding: 4px 8px;
    margin-top: 4px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }

  .ai-dmsg-typing {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    height: 22px;
  }

  .ai-dmsg-typing i {
    width: 6px;
    height: 6px;
    background: var(--el-text-color-secondary);
    border-radius: 50%;
    animation: ai-dot 1.2s infinite ease-in-out;
  }

  .ai-dmsg-typing i:nth-child(2) {
    animation-delay: 0.2s;
  }

  .ai-dmsg-typing i:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes ai-dot {
    0%,
    80%,
    100% {
      opacity: 0.3;
      transform: translateY(0);
    }

    40% {
      opacity: 1;
      transform: translateY(-3px);
    }
  }

  .ai-dmsg-actions {
    display: flex;
    gap: 4px;
    align-items: center;
    height: 24px;
    margin-top: 4px;
    visibility: hidden;
  }

  /* AI 消息的操作行常显（带模型名），属于消息本身；用户消息的复制按钮悬停才出现 */
  .ai-dmsg-actions:not(.is-user) {
    visibility: visible;
  }

  .ai-dchat__list :deep(.elx-bubble:hover) .ai-dmsg-actions,
  .ai-dmsg-actions:focus-within {
    visibility: visible;
  }

  .ai-dmsg-actions__btn.el-button {
    width: 24px;
    height: 24px;
    padding: 0;
    margin: 0;
    color: var(--el-text-color-secondary);
  }

  .ai-dmsg-meta {
    margin-left: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  /* —— 空状态 —— */
  .ai-dchat__welcome {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
    height: 100%;
    padding: 0 16px;
    padding-top: 30%;
    overflow: auto;
  }

  .ai-dchat__welcome :deep(.elx-welcome) {
    flex-direction: column;
    gap: 12px;
    align-items: center;
    padding: 0;
    text-align: center;
    background: transparent;
  }

  .ai-dchat__welcome :deep(.ai-dchat__w-title) {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    line-height: 28px;
    color: var(--el-text-color-primary);
  }

  .ai-dchat__welcome :deep(.ai-dchat__w-desc) {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 20px;
    color: var(--el-text-color-secondary);
  }

  .ai-dchat__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    color: #fff;
    background: linear-gradient(135deg, var(--el-color-primary-light-3), var(--el-color-primary));
    border-radius: 12px;

    --default-box-color: var(--el-color-primary);
  }

  .ai-dchat__logo :deep(.art-logo) {
    color: #fff;
  }

  .ai-dchat__prompts {
    width: 100%;
    max-width: 480px;
  }

  .ai-dchat__prompts :deep(.elx-prompts) {
    width: 100%;
  }

  .ai-dchat__prompts :deep(.elx-prompts__items) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .ai-dchat__prompts.is-single :deep(.elx-prompts__items) {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-dchat__prompts :deep(.elx-prompts__item) {
    min-height: 40px;
    padding: 8px 12px;
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .ai-dchat__prompts :deep(.elx-prompts__item .elx-prompts__item-label) {
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .ai-dchat__prompts :deep(.elx-prompts__item:hover) {
    background: var(--el-bg-color);
    border-color: var(--el-color-primary);
  }

  /* —— 没配模型 —— */
  .ai-dchat__nomodel {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    min-height: 32px;
    padding: 4px 12px;
    margin: 0 12px;
    font-size: 13px;
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
    border-radius: 8px;
  }

  .ai-dchat__nomodel-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-dchat__nomodel-hint {
    color: var(--el-text-color-secondary);
  }

  /* —— 输入卡片 —— */
  .ai-dchat__composer {
    flex-shrink: 0;
    padding: 12px 12px 8px;
  }

  .ai-dchat__sender :deep(.elx-x-sender) {
    padding: 0;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 12px;
    box-shadow: none;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .ai-dchat__sender :deep(.elx-x-sender:focus-within) {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  }

  .ai-dchat__sender :deep(.elx-x-sender__content) {
    padding: 12px 12px 0;
  }

  .ai-dchat__sender :deep(.chat-rich-text),
  .ai-dchat__sender :deep(.chat-placeholder-wrap) {
    font-size: 14px;
    line-height: 22px;
  }

  .ai-dchat__sender :deep(.elx-x-sender__action-list) {
    display: none;
  }

  .ai-dchat__sender :deep(.elx-x-sender__footer) {
    padding: 0;
    border: none;
  }

  .ai-dchat__toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    padding: 0 8px 4px;
  }

  .ai-dchat__chips {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .ai-dchat__chip {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    max-width: 180px;
    height: 24px;
    padding: 0 8px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--el-fill-color-light);
    border: none;
    border-radius: 6px;
  }

  .ai-dchat__chip:hover,
  .ai-dchat__chip:focus-visible {
    background: var(--el-fill-color);
  }

  .ai-dchat__main:focus-visible {
    box-shadow: inset 0 0 0 2px var(--el-color-primary);
  }

  .ai-dchat__chip.is-placeholder {
    color: var(--el-text-color-secondary);
  }

  .ai-dchat__chip-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-dchat__actions {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
  }

  .ai-dchat__send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border: none;
    border-radius: 50%;
  }

  .ai-dchat__send:disabled {
    cursor: not-allowed;
    background: var(--el-color-primary-light-5);
  }

  .ai-dchat__stop-square {
    width: 12px;
    height: 12px;
    background: currentcolor;
    border-radius: 2px;
  }

  .ai-dchat__settings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-dchat__disclaimer {
    margin-top: 8px;
    font-size: 12px;
    line-height: 16px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }
</style>

<style>
  .ai-dchat-history.el-popover.el-popper {
    max-height: 60vh;
    padding: 8px;
  }

  .ai-dchat-history__body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-dchat-history__empty {
    padding: 8px;
    font-size: 13px;
    line-height: 20px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  /* vue-element-plus-x 的 Conversations 写死了浅色值，这里统一换成 Element Plus 变量（暗色可用） */
  .el-popover.ai-dchat-history .elx-conversations {
    --elx-conversations-list-auto-bg-color: var(--el-bg-color-overlay);
  }

  .el-popover.ai-dchat-history .elx-conversations__group .elx-conversations__group-title {
    width: 100%;
    padding: 4px 8px;
    margin: 0;
    font-size: 12px;
    line-height: 20px;
    color: var(--el-text-color-secondary);
    background-color: var(--el-bg-color-overlay);
  }

  .el-popover.ai-dchat-history .elx-conversations-item {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 8px;
    margin: 0;
  }

  .el-popover.ai-dchat-history .elx-conversations-item:hover,
  .el-popover.ai-dchat-history .elx-conversations-item.elx-conversations-item--hovered,
  .el-popover.ai-dchat-history .elx-conversations-item.elx-conversations-item--menu-opened {
    background-color: var(--el-fill-color-light);
  }

  .el-popover.ai-dchat-history .elx-conversations-item.elx-conversations-item--active {
    background-color: var(--el-color-primary-light-9);
  }

  .el-popover.ai-dchat-history .elx-conversations-item__content .elx-conversations-item__label {
    font-size: 13px;
    color: var(--el-text-color-primary);
  }

  .el-popover.ai-dchat-history .elx-conversations-item--active .elx-conversations-item__label {
    color: var(--el-color-primary);
  }

  .el-popover.ai-dchat-history
    .elx-conversations-item__content
    .elx-conversations-dropdown-more-icon:hover {
    background-color: var(--el-fill-color);
  }

  .ai-dchat-chip-menu .el-dropdown-menu__item.is-active {
    color: var(--el-color-primary);
  }
</style>
