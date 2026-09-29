<template>
  <div class="ai-chat-panel" :class="{ compact }">
    <aside v-show="!collapsed" class="ai-chat-sessions">
      <div class="ai-chat-sessions__hd">
        <ElButton type="primary" size="small" @click="createSession">新对话</ElButton>
        <ElButton text size="small" @click="collapsed = true">折叠</ElButton>
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
            <span v-else>{{ s.title || '新对话' }}</span>
          </div>
          <div class="ai-chat-session__meta">
            <span>{{ formatTime(s.updateTime || s.createTime) }}</span>
            <ElButton link type="danger" size="small" @click.stop="removeSession(s)">删除</ElButton>
          </div>
        </div>
        <ElEmpty
          v-if="!sessionLoading && !sessions.length"
          description="暂无会话"
          :image-size="64"
        />
      </div>
    </aside>

    <section class="ai-chat-main">
      <header class="ai-chat-main__hd">
        <ElButton v-if="collapsed" text @click="collapsed = false">会话</ElButton>
        <span class="ai-chat-main__title">{{ activeSession?.title || '机器人助手' }}</span>
        <div class="ai-chat-main__tools">
          <ElSelect
            v-model="modelId"
            placeholder="选择模型"
            filterable
            clearable
            style="width: 200px"
            @change="persistModel"
          >
            <ElOption v-for="m in chatModels" :key="m.id" :label="m.modelName" :value="m.id" />
          </ElSelect>
          <ElSelect
            v-model="knowledgeId"
            placeholder="知识库（可选）"
            filterable
            clearable
            style="width: 180px"
          >
            <ElOption v-for="k in knowledgeList" :key="k.id" :label="k.name" :value="k.id" />
          </ElSelect>
          <ElButton :disabled="!activeId || streaming" @click="clearMessages">清空</ElButton>
          <ElButton :disabled="!activeId" @click="exportSession">导出</ElButton>
        </div>
      </header>

      <div ref="msgBoxRef" class="ai-chat-msgs">
        <div v-for="(msg, idx) in messages" :key="msg.id || idx" class="ai-msg" :class="msg.role">
          <div class="ai-msg__role">{{ msg.role === 'user' ? '我' : '助手' }}</div>
          <div class="ai-msg__body">
            <ElCollapse v-if="msg.thinkContent" class="ai-msg__think">
              <ElCollapseItem title="思考过程" name="1">
                <pre>{{ msg.thinkContent }}</pre>
              </ElCollapseItem>
            </ElCollapse>
            <div class="ai-msg__content" v-html="renderMd(msg.content)" />
            <div v-if="msg.refs?.length" class="ai-msg__refs">
              <div class="ai-msg__refs-title">引用 {{ msg.refs.length }}</div>
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
        <ElEmpty v-if="!messages.length" description="开始提问吧" :image-size="72" />
      </div>

      <footer class="ai-chat-input">
        <ElInput
          v-model="input"
          type="textarea"
          :rows="compact ? 2 : 3"
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          :disabled="streaming"
          @keydown="onKeydown"
        />
        <div class="ai-chat-input__actions">
          <ElButton v-if="streaming" type="danger" @click="stopStream">停止</ElButton>
          <ElButton type="primary" :loading="streaming" :disabled="!input.trim()" @click="send">
            发送
          </ElButton>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onMounted, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import DOMPurify from 'dompurify'
  import hljs from 'highlight.js'
  import {
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

  defineProps<{ compact?: boolean }>()

  interface ChatMsg {
    id?: string | number
    role: 'user' | 'assistant' | 'system'
    content: string
    thinkContent?: string
    modelName?: string
    tokens?: number
    durationMs?: number
    refs?: Array<{ content?: string; score?: number; source?: string; segmentId?: string | number }>
  }

  const collapsed = ref(false)
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

  function renderMd(text?: string) {
    const raw = text || ''
    // 轻量：代码块高亮 + 转义换行；完整 Markdown 可后续换专用渲染器
    let html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      try {
        const highlighted = lang
          ? hljs.highlight(code, { language: lang }).value
          : hljs.highlightAuto(code).value
        return `<pre><code class="hljs">${highlighted}</code></pre>`
      } catch {
        return `<pre><code>${code}</code></pre>`
      }
    })
    html = html.replace(/\n/g, '<br/>')
    return DOMPurify.sanitize(html)
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
    activeId.value = s.id
    activeSession.value = s
    modelId.value = s.modelId || modelId.value
    const list = await fetchAiMessageList(s.id)
    messages.value = (list || []).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content || '',
      thinkContent: m.thinkContent,
      modelName: m.modelName,
      tokens: m.tokens,
      durationMs: m.durationMs
    }))
    await scrollBottom()
  }

  async function createSession() {
    const n = sessions.value.length + 1
    const row = await fetchSaveAiSession({
      title: `新对话 ${n}`,
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
    await ElMessageBox.confirm(`确定删除会话「${s.title || s.id}」？`, '删除确认')
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
    await ElMessageBox.confirm('清空当前会话全部消息？', '清空确认')
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

  async function send() {
    const text = input.value.trim()
    if (!text || streaming.value) return
    if (!activeId.value) await createSession()
    if (!activeId.value) {
      ElMessage.warning('请先创建会话')
      return
    }
    input.value = ''
    messages.value.push({ role: 'user', content: text })
    const assistant: ChatMsg = { role: 'assistant', content: '', thinkContent: '' }
    messages.value.push(assistant)
    streaming.value = true
    await scrollBottom()
    const started = Date.now()
    abortCtrl.value = await fetchAiChatStream(
      {
        sessionId: activeId.value,
        modelId: modelId.value,
        knowledgeId: knowledgeId.value || undefined,
        content: text
      },
      {
        onChunk: (c) => {
          assistant.content += c
          void scrollBottom()
        },
        onThink: (t) => {
          assistant.thinkContent = (assistant.thinkContent || '') + t
        },
        onRefs: (refs: any) => {
          const list = Array.isArray(refs) ? refs : refs?.refs
          if (Array.isArray(list)) {
            assistant.refs = list
            void scrollBottom()
          }
        },
        onUsage: (u: any) => {
          assistant.tokens = u?.totalTokens ?? u?.tokens
          assistant.modelName =
            u?.modelName || chatModels.value.find((m) => m.id === modelId.value)?.modelName
        },
        onEvent: (ev, data) => {
          if (
            ev === 'chunk' ||
            ev === 'think' ||
            ev === 'done' ||
            ev === 'message' ||
            ev === 'meta' ||
            ev === 'refs'
          ) {
            try {
              const j = JSON.parse(data)
              if (j.requestId) requestId.value = j.requestId
            } catch {
              /* ignore */
            }
          }
        },
        onDone: () => {
          assistant.durationMs = Date.now() - started
          streaming.value = false
          abortCtrl.value = null
        },
        onError: (msg) => {
          streaming.value = false
          abortCtrl.value = null
          ElMessage.error(msg || '生成失败')
        }
      }
    )
  }

  async function stopStream() {
    abortCtrl.value?.abort()
    if (requestId.value) {
      try {
        await fetchAiChatStop(requestId.value)
      } catch {
        /* ignore */
      }
    }
    streaming.value = false
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
    gap: 8px;
    align-items: center;
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
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }
</style>
