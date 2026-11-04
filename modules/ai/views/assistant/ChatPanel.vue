<template>
  <div class="ai-chat-panel" :class="{ compact, narrow }">
    <aside v-show="!collapsed" class="ai-chat-sessions">
      <div class="ai-chat-sessions__hd">
        <ElButton type="primary" size="small" @click="createSession">{{
          $t('aiChat.newChat')
        }}</ElButton>
        <ElButton text size="small" @click="collapsed = true">{{ $t('aiChat.collapse') }}</ElButton>
      </div>
      <div v-loading="sessionLoading" class="ai-chat-sessions__list">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="ai-chat-session"
          :class="{ active: s.id === activeId }"
          @click="selectSession(s)"
        >
          <div class="ai-chat-session__title" @dblclick.stop="startRename(s)">
            <ElInput
              v-if="renamingId === s.id"
              v-model="renameTitle"
              size="small"
              @keyup.enter="confirmRename(s)"
              @keyup.esc="renamingId = null"
              @blur="confirmRename(s)"
            />
            <span v-else>{{ displaySessionTitle(s.title, t) }}</span>
          </div>
          <div class="ai-chat-session__meta">
            <span>{{ formatTime(s.updateTime || s.createTime) }}</span>
            <ElButton link type="danger" size="small" @click.stop="removeSession(s)">{{
              $t('aiChat.delete')
            }}</ElButton>
          </div>
        </div>
        <ElEmpty
          v-if="!sessionLoading && !sessions.length"
          :description="$t('aiChat.emptySessions')"
          :image-size="64"
        />
      </div>
    </aside>

    <section class="ai-chat-main">
      <header class="ai-chat-main__hd">
        <ElButton v-if="collapsed" text @click="collapsed = false">{{
          $t('aiChat.sessions')
        }}</ElButton>
        <span class="ai-chat-main__title">{{
          activeSession?.title
            ? displaySessionTitle(activeSession.title, t)
            : $t('aiChat.assistantTitle')
        }}</span>
        <div class="ai-chat-main__tools">
          <ElSelect
            v-model="modelId"
            :placeholder="$t('aiChat.selectModel')"
            filterable
            clearable
            style="width: 200px"
            @change="persistModel"
          >
            <ElOption v-for="m in chatModels" :key="m.id" :label="m.modelName" :value="m.id" />
          </ElSelect>
          <ElSelect
            v-model="knowledgeId"
            :placeholder="$t('aiChat.knowledgeOptional')"
            filterable
            clearable
            style="width: 180px"
          >
            <ElOption v-for="k in knowledgeList" :key="k.id" :label="k.name" :value="k.id" />
          </ElSelect>
          <ElButton :disabled="!activeId || streaming" @click="clearMessages">{{
            $t('aiChat.clear')
          }}</ElButton>
          <ElButton :disabled="!activeId" @click="exportSession">{{
            $t('aiChat.export')
          }}</ElButton>
        </div>
      </header>

      <div ref="msgBoxRef" class="ai-chat-msgs" @click="onMsgsClick">
        <div v-for="msg in messages" :key="msg.uid" class="ai-msg" :class="msg.role">
          <div class="ai-msg__role">{{
            msg.role === 'user' ? $t('aiChat.me') : $t('aiChat.assistant')
          }}</div>
          <div class="ai-msg__body">
            <ElCollapse v-if="msg.thinkContent" class="ai-msg__think">
              <ElCollapseItem :title="$t('aiChat.thinking')" name="1">
                <pre>{{ msg.thinkContent }}</pre>
              </ElCollapseItem>
            </ElCollapse>
            <div class="ai-msg__content" v-html="renderMd(msg.content)" />
            <ElAlert
              v-if="msg.error"
              class="ai-msg__err"
              type="error"
              :title="msg.error"
              :closable="false"
              show-icon
            >
              <ElButton size="small" :disabled="streaming" @click="retry(msg)">
                {{ $t('aiDrawer.retry') }}
              </ElButton>
            </ElAlert>
            <ElButton
              v-if="msg.role === 'assistant' && msg.requestId && !msg.error && !msg.pending"
              link
              type="primary"
              :disabled="streaming"
              @click="replayMessage(msg)"
            >
              {{ $t('aiChat.resume') }}
            </ElButton>
            <div v-if="msg.refs?.length" class="ai-msg__refs">
              <div class="ai-msg__refs-title">{{ $t('aiChat.refs', { n: msg.refs.length }) }}</div>
              <div v-for="(r, ri) in msg.refs" :key="ri" class="ai-msg__ref">
                <span class="ai-msg__ref-meta">
                  #{{ ri + 1 }}
                  <template v-if="r.score != null"> · {{ Number(r.score).toFixed(3) }}</template>
                  <template v-if="r.source"> · {{ r.source }}</template>
                </span>
                <div class="ai-msg__ref-body">{{ r.content }}</div>
              </div>
            </div>
            <div
              v-if="msg.role === 'assistant' && (msg.modelName || msg.tokens)"
              class="ai-msg__foot"
            >
              <span v-if="msg.modelName">{{ msg.modelName }}</span>
              <span v-if="msg.tokens">{{ msg.tokens }} tokens</span>
              <span v-if="msg.durationMs">{{ msg.durationMs }} ms</span>
            </div>
          </div>
        </div>
        <ElEmpty
          v-if="!messages.length"
          :description="$t('aiChat.emptyMessages')"
          :image-size="72"
        />
      </div>

      <footer class="ai-chat-input">
        <ElInput
          v-model="input"
          type="textarea"
          :rows="compact ? 2 : 3"
          :placeholder="$t('aiChat.inputPlaceholder')"
          :disabled="streaming"
          @keydown="onKeydown"
        />
        <div class="ai-chat-input__actions">
          <ElButton v-if="streaming" type="danger" @click="stopStream">{{
            $t('aiChat.stop')
          }}</ElButton>
          <ElButton type="primary" :loading="streaming" :disabled="!input.trim()" @click="send">
            {{ $t('aiChat.send') }}
          </ElButton>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { displaySessionTitle, newSessionTitle } from './sessionTitle'
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { useClipboard, useWindowSize } from '@vueuse/core'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { handleCodeCopy, renderMarkdown } from './renderMarkdown'
  import {
    fetchAiChatRegenerate,
    fetchAiChatReplay,
    fetchAiChatStop,
    fetchAiChatStream,
    fetchAiMessageList,
    fetchAiModelPage,
    fetchAiSessionPage,
    fetchClearAiSession,
    fetchExportAiSession,
    fetchAiKnowledgePage,
    fetchRemoveAiSession,
    fetchSaveAiSession
  } from '../../api'
  import { pickAssistantMessageId, shouldRegenerate } from './drawer/chatRegenerate'

  const { t } = useI18n()

  defineProps<{ compact?: boolean }>()

  interface ChatMsg {
    id?: string | number
    /** 列表渲染稳定键；与后端 messageId 分开 */
    uid: number
    role: 'user' | 'assistant' | 'system'
    content: string
    thinkContent?: string
    modelName?: string
    tokens?: number
    durationMs?: number
    requestId?: string
    refs?: Array<{ content?: string; score?: number; source?: string; segmentId?: string | number }>
    pending?: boolean
    /** 出错前是否已收到过 SSE（提问/助手行多半已入库） */
    persisted?: boolean
    error?: string
    /** 这条回答对应的提问，用于重试/重新生成 */
    question?: string
  }

  let uidSeed = 0
  const nextUid = () => ++uidSeed

  const collapsed = ref(false)
  /** 窄屏（UX-113）：单栏，会话列表收成覆盖层，默认收起，选中会话后自动收起 */
  const { width: viewportWidth } = useWindowSize()
  const narrow = computed(() => viewportWidth.value <= 640)
  watch(narrow, (v) => (collapsed.value = v), { immediate: true })
  const sessionLoading = ref(false)
  const sessions = ref<any[]>([])
  const activeId = ref<string | number | null>(null)
  const activeSession = ref<any>(null)
  const messages = ref<ChatMsg[]>([])
  const input = ref('')
  const modelId = ref<string | number | null>(null)
  const knowledgeId = ref<string | number | null>(null)
  const knowledgeList = ref<any[]>([])
  const chatModels = ref<any[]>([])
  const streaming = ref(false)
  const requestId = ref('')
  const abortCtrl = ref<AbortController | null>(null)
  const renamingId = ref<string | number | null>(null)
  const renameTitle = ref('')
  const msgBoxRef = ref<HTMLElement | null>(null)

  function formatTime(v?: string) {
    if (!v) return ''
    return String(v).replace('T', ' ').slice(0, 16)
  }

  /** 与 AI 助手抽屉共用同一套 Markdown 渲染 */
  const renderMd = (text?: string) => renderMarkdown(text, t('aiDrawer.copy'))
  const { copy } = useClipboard({ legacy: true })
  function onMsgsClick(e: MouseEvent) {
    void handleCodeCopy(e, copy, t('aiDrawer.copy'), t('aiDrawer.copied'))
  }

  async function scrollBottom() {
    await nextTick()
    if (msgBoxRef.value) msgBoxRef.value.scrollTop = msgBoxRef.value.scrollHeight
  }

  async function loadModels() {
    try {
      const res = await fetchAiModelPage({
        pageNum: 1,
        pageSize: 100,
        modelType: 'chat'
      })
      const records = res?.records ?? []
      chatModels.value = records.filter((m: any) => m.activateFlag !== 0)
      const def = chatModels.value.find((m: any) => m.defaultFlag === 1)
      if (!modelId.value && def) modelId.value = def.id
    } catch {
      chatModels.value = []
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

  async function loadSessions() {
    sessionLoading.value = true
    try {
      const res = await fetchAiSessionPage({
        pageNum: 1,
        pageSize: 50,
        source: 'assistant'
      })
      sessions.value = res?.records ?? []
      if (!activeId.value && sessions.value[0]) {
        await selectSession(sessions.value[0])
      }
    } finally {
      sessionLoading.value = false
    }
  }

  async function selectSession(s: any) {
    if (narrow.value) collapsed.value = true
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
        durationMs: m.durationMs,
        requestId: m.requestId,
        question: m.role === 'assistant' ? lastQuestion : undefined
      }
    })
    await scrollBottom()
  }

  async function createSession() {
    const n = sessions.value.length + 1
    const row = await fetchSaveAiSession({
      title: newSessionTitle(n),
      source: 'assistant',
      modelId: modelId.value
    })
    await loadSessions()
    if (row?.id) {
      const found = sessions.value.find((x) => x.id === row.id) || row
      await selectSession(found)
    }
  }

  function startRename(s: any) {
    renamingId.value = s.id
    renameTitle.value = s.title || ''
  }

  async function confirmRename(s: any) {
    if (renamingId.value !== s.id) return
    renamingId.value = null
    const title = renameTitle.value.trim()
    if (!title || title === s.title) return
    await fetchSaveAiSession({ id: s.id, title })
    s.title = title
    if (activeSession.value?.id === s.id) activeSession.value.title = title
  }

  async function removeSession(s: any) {
    await ElMessageBox.confirm(
      t('aiChat.removeConfirm', {
        name: s.title ? displaySessionTitle(s.title, t) : t('aiChat.thisSession')
      }),
      t('aiChat.confirmTitle')
    )
    await fetchRemoveAiSession(s.id)
    if (activeId.value === s.id) {
      activeId.value = null
      activeSession.value = null
      messages.value = []
    }
    await loadSessions()
  }

  async function clearMessages() {
    if (!activeId.value) return
    await ElMessageBox.confirm(t('aiChat.clearConfirm'), t('aiChat.confirmTitle'))
    await fetchClearAiSession(activeId.value)
    messages.value = []
  }

  async function exportSession() {
    if (!activeId.value) return
    await fetchExportAiSession(activeId.value)
  }

  async function persistModel() {
    if (!activeId.value) return
    await fetchSaveAiSession({ id: activeId.value, modelId: modelId.value })
    if (activeSession.value) activeSession.value.modelId = modelId.value
  }

  function onKeydown(e: Event | KeyboardEvent) {
    if (!(e instanceof KeyboardEvent)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function bindStreamHandlers(msg: ChatMsg, finish: () => void, started?: number) {
    return {
      onChunk: (c: string) => {
        msg.content += c
        void scrollBottom()
      },
      onThink: (chunk: string) => {
        msg.thinkContent = (msg.thinkContent || '') + chunk
      },
      onRefs: (refs: any) => {
        const list = Array.isArray(refs) ? refs : refs?.refs
        if (Array.isArray(list)) {
          msg.refs = list
          void scrollBottom()
        }
      },
      onUsage: (u: any) => {
        msg.tokens = u?.totalTokens ?? u?.tokens
        msg.modelName =
          u?.modelName || chatModels.value.find((m) => m.id === modelId.value)?.modelName
      },
      onEvent: (_ev: string, data: string) => {
        msg.persisted = true
        try {
          const parsed = JSON.parse(data)
          if (parsed?.requestId) {
            requestId.value = parsed.requestId
            msg.requestId = parsed.requestId
          }
          if (parsed?.messageId != null) msg.id = parsed.messageId
        } catch {
          /* ignore */
        }
      },
      onDone: (payload?: unknown) => {
        if (payload && typeof payload === 'object' && payload !== null && 'messageId' in payload) {
          const mid = (payload as { messageId?: unknown }).messageId
          if (mid != null) msg.id = mid as string | number
        }
        if (started != null) msg.durationMs = Date.now() - started
        finish()
      },
      onError: (m: string) => {
        finish()
        msg.error = m || t('aiChat.genFailed')
        ElMessage.error(msg.error)
      }
    }
  }

  async function stream(assistant: ChatMsg) {
    const msg = messages.value.find((m) => m.uid === assistant.uid) || assistant
    streaming.value = true
    requestId.value = crypto.randomUUID().replace(/-/g, '')
    msg.requestId = requestId.value
    const started = Date.now()
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
      bindStreamHandlers(msg, finish, started)
    )
  }

  /** boot #71：sessionId + messageId；不重复写提问；SSE 同 stream */
  async function regenerate(assistant: ChatMsg, messageId: string | number) {
    const msg = messages.value.find((m) => m.uid === assistant.uid) || assistant
    streaming.value = true
    requestId.value = crypto.randomUUID().replace(/-/g, '')
    msg.requestId = requestId.value
    const started = Date.now()
    const finish = () => {
      msg.pending = false
      streaming.value = false
      abortCtrl.value = null
    }
    abortCtrl.value = await fetchAiChatRegenerate(
      {
        sessionId: activeId.value,
        messageId,
        modelId: modelId.value,
        knowledgeId: knowledgeId.value || undefined,
        requestId: requestId.value
      },
      bindStreamHandlers(msg, finish, started)
    )
  }

  async function send() {
    const text = input.value.trim()
    if (!text || streaming.value) return
    if (!activeId.value) await createSession()
    if (!activeId.value) {
      ElMessage.warning(t('aiChat.createFirst'))
      return
    }
    input.value = ''
    messages.value.push({ uid: nextUid(), role: 'user', content: text })
    const assistant: ChatMsg = {
      uid: nextUid(),
      role: 'assistant',
      content: '',
      thinkContent: '',
      pending: true,
      question: text
    }
    messages.value.push(assistant)
    await scrollBottom()
    await stream(assistant)
  }

  /**
   * 失败重试：与抽屉同语义——已入库走 regenerate（不重复写提问）；
   * 校验阶段失败仍走 stream；只更新本条助手消息。
   */
  async function retry(msg: ChatMsg) {
    if (streaming.value || !msg.question) return
    const target = messages.value.find((m) => m.uid === msg.uid)
    if (!target) return
    target.content = ''
    target.thinkContent = ''
    target.refs = undefined
    target.tokens = undefined
    target.durationMs = undefined
    target.error = undefined
    target.pending = true

    let list: any[] | null = null
    if (activeId.value && (target.id == null || target.persisted || target.requestId)) {
      try {
        list = await fetchAiMessageList(activeId.value)
      } catch {
        list = null
      }
    }
    const messageId = pickAssistantMessageId(target, list)
    if (shouldRegenerate(target, messageId) && activeId.value && messageId != null) {
      target.id = messageId
      await regenerate(target, messageId)
      return
    }
    if (target.persisted) {
      target.pending = false
      target.error = t('aiChat.genFailed')
      ElMessage.warning(t('aiDrawer.retryNeedRefresh'))
      return
    }
    await stream(target)
  }

  async function replayMessage(msg: ChatMsg) {
    if (!msg.requestId || streaming.value) return
    let failed = false
    streaming.value = true
    abortCtrl.value = await fetchAiChatReplay(msg.requestId, {
      onChunk: (c) => {
        if (c && !msg.content.includes(c)) msg.content += c
      },
      onThink: (chunk) => {
        if (chunk && !(msg.thinkContent || '').includes(chunk)) {
          msg.thinkContent = (msg.thinkContent || '') + chunk
        }
      },
      onError: (m) => {
        failed = true
        streaming.value = false
        abortCtrl.value = null
        ElMessage.error(m || t('aiChat.nothingToResume'))
      },
      onDone: (payload) => {
        streaming.value = false
        abortCtrl.value = null
        if (failed) return
        const text =
          payload && typeof payload === 'object' && 'message' in payload
            ? String((payload as { message?: unknown }).message || '')
            : ''
        ElMessage.success(text || t('aiChat.resumed'))
      }
    })
  }

  async function stopStream() {
    abortCtrl.value?.abort()
    abortCtrl.value = null
    const id = requestId.value
    streaming.value = false
    if (!id) {
      ElMessage.warning(t('aiChat.notStarted'))
      return
    }
    try {
      await fetchAiChatStop(id)
    } catch {
      /* 拦截器已经提示下一步 */
    }
  }

  onMounted(async () => {
    await Promise.all([loadModels(), loadKnowledge(), loadSessions()])
  })

  watch(activeId, () => {
    requestId.value = ''
  })
</script>

<style scoped>
  .ai-chat-panel {
    display: flex;
    height: 100%;
    min-height: 480px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .ai-chat-panel.compact {
    min-height: 360px;
    border: none;
  }

  .ai-chat-sessions {
    display: flex;
    flex-direction: column;
    width: 260px;
    border-right: 1px solid var(--el-border-color-lighter);
  }

  .ai-chat-sessions__hd {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding: 12px;
  }

  .ai-chat-sessions__list {
    flex: 1;
    overflow: auto;
  }

  .ai-chat-session {
    padding: 10px 12px;
    cursor: pointer;
  }

  .ai-chat-session:hover,
  .ai-chat-session.active {
    background: var(--el-fill-color-light);
  }

  .ai-chat-session__title {
    font-size: 14px;
  }

  .ai-chat-session__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-chat-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .ai-chat-main__hd {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .ai-chat-main__title {
    flex: 1;
    font-weight: 600;
  }

  .ai-chat-main__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  /* 窄屏单栏（UX-113）：会话列表覆盖在聊天区上，工具栏下拉各占半行 */
  .ai-chat-panel.narrow {
    position: relative;
  }

  .ai-chat-panel.narrow .ai-chat-sessions {
    position: absolute;
    inset: 0;
    z-index: 5;
    width: 100%;
    background: var(--el-bg-color);
    border-right: none;
  }

  .ai-chat-panel.narrow .ai-chat-main__tools {
    width: 100%;
  }

  .ai-chat-panel.narrow .ai-chat-main__tools .el-select {
    width: calc(50% - 4px) !important;
  }

  .ai-chat-msgs {
    flex: 1;
    padding: 16px;
    overflow: auto;
  }

  .ai-msg {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }

  .ai-msg.user {
    flex-direction: row-reverse;
  }

  .ai-msg__role {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    font-size: 12px;
    line-height: 36px;
    text-align: center;
    background: var(--el-fill-color);
    border-radius: 50%;
  }

  .ai-msg__body {
    max-width: 78%;
    padding: 10px 12px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .ai-msg.user .ai-msg__body {
    background: var(--el-color-primary-light-9);
  }

  .ai-msg__content {
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  }

  .ai-msg__refs {
    padding-top: 8px;
    margin-top: 10px;
    border-top: 1px dashed var(--el-border-color-lighter);
  }

  .ai-msg__refs-title {
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-msg__ref {
    padding: 6px 8px;
    margin-bottom: 6px;
    font-size: 12px;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }

  .ai-msg__ref-meta {
    color: var(--el-text-color-secondary);
  }

  .ai-msg__ref-body {
    margin-top: 2px;
    line-height: 1.45;
    color: var(--el-text-color-regular);
    word-break: break-word;
  }

  .ai-msg__foot {
    display: flex;
    gap: 10px;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-msg__err {
    margin-top: 8px;
  }

  .ai-msg__think {
    margin-bottom: 8px;
  }

  .ai-msg__think pre {
    margin: 0;
    white-space: pre-wrap;
  }

  .ai-chat-input {
    padding: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .ai-chat-input__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }
</style>
