import request from '@/utils/http'
import { useUserStore } from '@/store/modules/user'

export type AiId = string | number

/** SSE 事件回调 */
export interface AiSseHandlers {
  onChunk?: (text: string) => void
  onThink?: (text: string) => void
  onUsage?: (usage: Record<string, unknown>) => void
  onRefs?: (refs: unknown) => void
  onDone?: (payload?: unknown) => void
  onError?: (message: string) => void
  onEvent?: (event: string, data: string) => void
}

function authHeaders(): Record<string, string> {
  const token = useUserStore().accessToken
  return token ? { Authorization: token } : {}
}

/**
 * 消费 SSE（fetch + ReadableStream）。返回 AbortController，调用方可 stop。
 * 协议：event: chunk|think|usage|refs|done|error，data 多为 JSON（含 content/message）。
 */
export async function consumeAiSse(
  url: string,
  body: Record<string, unknown> | undefined,
  handlers: AiSseHandlers,
  method: 'POST' | 'GET' = 'POST'
): Promise<AbortController> {
  const controller = new AbortController()
  const init: RequestInit = {
    method,
    headers: {
      Accept: 'text/event-stream',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders()
    },
    signal: controller.signal,
    credentials: 'include'
  }
  if (method === 'POST' && body) {
    init.body = JSON.stringify(body)
  }
  void (async () => {
    let gotDone = false
    const finish = (payload?: unknown) => {
      if (gotDone) return
      gotDone = true
      handlers.onDone?.(payload)
    }
    try {
      const resp = await fetch(url.startsWith('http') ? url : `/api${url.replace(/^\/api/, '')}`, {
        ...init
      })
      if (!resp.ok || !resp.body) {
        handlers.onError?.(resp.statusText || `HTTP ${resp.status}`)
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventName = 'message'
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''
        for (const line of parts) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim()
            handlers.onEvent?.(eventName, data)
            const parsed = tryParseJson(data)
            switch (eventName) {
              case 'chunk':
                handlers.onChunk?.(extractSseText(parsed, data, 'content'))
                break
              case 'think':
                handlers.onThink?.(extractSseText(parsed, data, 'content'))
                break
              case 'usage':
                handlers.onUsage?.(
                  parsed && typeof parsed === 'object'
                    ? (parsed as Record<string, unknown>)
                    : { raw: data }
                )
                break
              case 'refs':
                handlers.onRefs?.(parsed ?? data)
                break
              case 'done':
                finish(parsed ?? data)
                break
              case 'error':
                handlers.onError?.(extractSseText(parsed, data, 'message') || data || 'error')
                break
              default:
                break
            }
            eventName = 'message'
          } else if (line === '') {
            eventName = 'message'
          }
        }
      }
      finish()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        handlers.onError?.(e?.message || 'SSE 中断')
      }
    }
  })()
  return controller
}

function tryParseJson(data: string): unknown {
  if (!data || (data[0] !== '{' && data[0] !== '[')) return undefined
  try {
    return JSON.parse(data)
  } catch {
    return undefined
  }
}

function extractSseText(parsed: unknown, raw: string, field: string): string {
  if (parsed && typeof parsed === 'object' && parsed !== null && field in (parsed as object)) {
    const v = (parsed as Record<string, unknown>)[field]
    return v == null ? '' : String(v)
  }
  // 非 JSON 时回退原文（兼容纯文本 chunk）
  return raw
}

// ===== 大模型 =====
export function fetchAiModelPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/model/page', params })
}
export function fetchSaveAiModel(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/model/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiModel(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/model/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchDefaultAiModel(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/model/default',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchTestAiModel(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/model/test',
    data: { id },
    showSuccessMessage: true
  })
}

// ===== 提示词 =====
export function fetchAiPromptPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/prompt/page', params })
}
export function fetchSaveAiPrompt(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/prompt/submit', data, showSuccessMessage: true })
}
export function fetchRemoveAiPrompt(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/prompt/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchOptimizeAiPrompt(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/prompt/optimize',
    data,
    showSuccessMessage: true
  })
}
export function fetchAiPromptVersions(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/ai/prompt/version/list', params })
}
export function fetchRollbackAiPrompt(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/ai/prompt/rollback', data })
}
export function fetchTryAiPrompt(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/prompt/try', data })
}

// ===== MCP =====
export function fetchAiMcpPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/mcp/page', params })
}
export function fetchSaveAiMcp(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/mcp/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiMcp(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/mcp/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchParseAiMcp(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/mcp/parse',
    data,
    showSuccessMessage: true
  })
}
export function fetchDebugAiMcp(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/mcp/debug',
    data,
    showSuccessMessage: true
  })
}
export function fetchLockAiMcp(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/ai/mcp/lock',
    data,
    showSuccessMessage: true
  })
}
export function fetchDefaultAiMcp(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/mcp/default',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchAiMcpServerList() {
  return request.get<any[]>({ url: '/api/system/ai/mcp/server/list' })
}
export function fetchToggleAiMcpServer(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/ai/mcp/server/toggle',
    data,
    showSuccessMessage: true
  })
}

// ===== 向量库 =====
export function fetchAiVectorPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/vector/page', params })
}
export function fetchSaveAiVector(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/vector/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiVector(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/vector/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchTestAiVector(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/vector/test',
    data: { id },
    showSuccessMessage: true
  })
}

// ===== 数据源 =====
export function fetchAiDatasourcePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/datasource/page', params })
}
export function fetchSaveAiDatasource(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/datasource/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiDatasource(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/datasource/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchTestAiDatasource(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/datasource/test',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchAiDatasourceTables(id: AiId) {
  return request.get<any[]>({ url: '/api/system/ai/datasource/tables', params: { id } })
}

// ===== 消息渠道 =====
export function fetchAiChannelPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/channel/page', params })
}
export function fetchSaveAiChannel(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/channel/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiChannel(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/channel/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchDebugAiChannel(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/channel/debug',
    data: { id },
    showSuccessMessage: true
  })
}

// ===== 会话 / 对话 =====
export function fetchAiSessionPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/session/page', params })
}
export function fetchSaveAiSession(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/session/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiSession(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/session/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchClearAiSession(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/session/clear',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchExportAiSession(id: AiId) {
  return request.download({ url: '/api/system/ai/session/export', params: { id } })
}
export function fetchAiMessageList(sessionId: AiId) {
  return request.get<any[]>({ url: '/api/system/ai/session/messages', params: { sessionId } })
}
export function fetchAiChatStream(data: Record<string, any>, handlers: AiSseHandlers) {
  return consumeAiSse('/api/system/ai/chat/stream', data, handlers)
}
export function fetchAiChatReceive(requestId: string, handlers: AiSseHandlers) {
  return consumeAiSse(`/api/system/ai/chat/receive/${requestId}`, undefined, handlers, 'GET')
}
export function fetchAiChatStop(requestId: string) {
  return request.post<void>({
    url: `/api/system/ai/chat/stop?requestId=${encodeURIComponent(String(requestId))}`,
    data: {},
    showSuccessMessage: true
  })
}

// ===== 应用 =====
export function fetchAiAppPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/app/page', params })
}
export function fetchSaveAiApp(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/app/submit', data, showSuccessMessage: true })
}
export function fetchRemoveAiApp(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/app/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchCopyAiApp(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/app/copy',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchExportAiApp(id: AiId) {
  return request.download({ url: '/api/system/ai/app/export', params: { id } })
}
export function fetchImportAiApp(data: FormData | Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/app/import', data })
}
export function fetchAiAppDetail(id: AiId) {
  return request.get<any>({ url: `/api/system/ai/app/detail/${id}` })
}
export function fetchSaveAiAppDsl(data: Record<string, any>) {
  const id = data.id
  const payload = { dsl: data.dsl ?? data.dslJson, dslJson: data.dslJson ?? data.dsl, id }
  return request.post<any>({ url: `/api/system/ai/app/dsl/save?id=${id}`, data: payload })
}
export function fetchRunAiApp(data: Record<string, any>) {
  const id = data.id
  const input = { ...data }
  delete input.id
  delete input.dsl
  delete input.dslJson
  return request.post<any>({ url: `/api/system/ai/app/run?id=${id}`, data: input })
}
export function fetchRunAiAppStream(data: Record<string, any>, handlers: AiSseHandlers) {
  return consumeAiSse('/api/system/ai/app/run/stream', data, handlers)
}
export function fetchAiAppRunPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/app/run/page', params })
}
export function fetchAiAppRunDetail(runId: AiId) {
  return request.get<any>({ url: '/api/system/ai/app/run/detail', params: { runId } })
}
export function fetchShareAiApp(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/app/share', data })
}

// ===== 知识库 =====
export function fetchAiKnowledgePage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/knowledge/page', params })
}
export function fetchAiKnowledgeDetail(id: AiId) {
  return request.get<any>({ url: `/api/system/ai/knowledge/detail/${id}` })
}
export function fetchSaveAiKnowledge(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/knowledge/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiKnowledge(id: AiId) {
  // POST 的 params 会被 HTTP 层挪到 JSON body；后端要 @RequestParam，须写进 URL
  return request.post<void>({
    url: `/api/system/ai/knowledge/remove?ids=${encodeURIComponent(String(id))}`,
    data: {},
    showSuccessMessage: true
  })
}
export function fetchCopyAiKnowledge(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/knowledge/copy',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchTestAiKnowledge(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/knowledge/test', data })
}
export function fetchStatusAiKnowledge(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/ai/knowledge/status', data })
}
export function fetchUploadKbAsset(data: FormData | Record<string, any>) {
  // 兼容 FormData（取文本）与 JSON 正文
  return request.post<any>({ url: '/api/system/ai/knowledge/asset/upload', data })
}
export function fetchKbAssetPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/knowledge/asset/list', params })
}
export function fetchRemoveKbAsset(id: AiId) {
  return request.post<void>({
    url: `/api/system/ai/knowledge/asset/remove?ids=${encodeURIComponent(String(id))}`,
    data: {},
    showSuccessMessage: true
  })
}
export function fetchResegmentKbAsset(id: AiId) {
  return request.post<any>({
    url: `/api/system/ai/knowledge/asset/resegment?id=${encodeURIComponent(String(id))}`
  })
}
export function fetchKbSegmentPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/knowledge/segment/list', params })
}
export function fetchSaveKbSegment(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/knowledge/segment/submit', data })
}
export function fetchStatusKbSegment(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/ai/knowledge/segment/status',
    data,
    showSuccessMessage: true
  })
}
export function fetchKbVectorStart(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/knowledge/vectorize',
    data: { ...data, rebuild: false }
  })
}
export function fetchKbVectorPause() {
  return Promise.reject(new Error('同步向量化不支持暂停'))
}
export function fetchKbVectorRebuild(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/knowledge/vectorize',
    data: { ...data, rebuild: true }
  })
}
export function fetchKbVectorStats(knowledgeId: AiId) {
  return request.get<any>({ url: '/api/system/ai/knowledge/vector-stats', params: { knowledgeId } })
}
export function fetchKbHitTest(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/knowledge/hit-test', data })
}

// ===== 问数 =====
export function fetchAiDatasetPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/dataset/page', params })
}
export function fetchAiDatasetDetail(id: AiId) {
  return request.get<any>({ url: '/api/system/ai/dataset/detail', params: { id } })
}
export function fetchSaveAiDataset(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/dataset/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiDataset(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/dataset/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchCopyAiDataset(id: AiId) {
  return request.post<any>({
    url: '/api/system/ai/dataset/copy',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchExportAiDataset(id: AiId) {
  return request.download({ url: '/api/system/ai/dataset/export', params: { id } })
}
export function fetchSaveDatasetTables(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/ai/dataset/config/tables',
    data,
    showSuccessMessage: true
  })
}
export function fetchDatasetTables(id: AiId) {
  return request.get<any>({ url: '/api/system/ai/dataset/config/tables', params: { id } })
}
export function fetchAiTerminologyPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/terminology/page', params })
}
export function fetchSaveAiTerminology(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/terminology/submit', data })
}
export function fetchRemoveAiTerminology(id: AiId) {
  return request.post<void>({ url: '/api/system/ai/terminology/remove', data: { id } })
}
export function fetchSaveDatasetTerms(data: Record<string, any>) {
  return request.post<void>({ url: '/api/system/ai/dataset/terms', data })
}
export function fetchDatasetAsk(data: Record<string, any>) {
  const datasetId = data.datasetId ?? data.id
  return request.post<any>({
    url: '/api/system/ai/dataset/ask',
    data: { datasetId, question: data.question }
  })
}
/** @deprecated 后端为同步 ask；保留别名避免旧引用断裂 */
export function fetchDatasetAskStream(data: Record<string, any>, handlers: AiSseHandlers) {
  void (async () => {
    try {
      const r = await fetchDatasetAsk(data)
      if (r?.sql) handlers.onEvent?.('sql', String(r.sql))
      if (r?.rows) handlers.onEvent?.('rows', JSON.stringify(r.rows))
      const summary =
        r?.message || (Array.isArray(r?.rows) ? `查询完成，共 ${r.rows.length} 行` : '查询完成')
      handlers.onChunk?.(summary)
      handlers.onDone?.(r)
    } catch (e: any) {
      handlers.onError?.(e?.message || '问数失败')
    }
  })()
  return new AbortController()
}
export function fetchDatasetSqlRerun(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/dataset/sql/rerun', data })
}
export function fetchDatasetSuggest(id: AiId) {
  return request.get<string[]>({ url: '/api/system/ai/dataset/suggest', params: { id } })
}
export function fetchDatasetAnalyze(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/dataset/analyze', data })
}
export function fetchDatasetPredict(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/dataset/predict', data })
}
export function fetchDatasetSchema(datasourceId: AiId) {
  return request.get<any>({ url: '/api/system/ai/dataset/schema', params: { datasourceId } })
}

// ===== 仪表盘 =====
export function fetchAiDashboardPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/dashboard/page', params })
}
export function fetchSaveAiDashboard(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/dashboard/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiDashboard(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/dashboard/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchAiDashboardDetail(id: AiId) {
  return request.get<any>({ url: '/api/system/ai/dashboard/detail', params: { id } })
}
export function fetchSaveAiDashboardDsl(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/dashboard/dsl/save',
    data,
    showSuccessMessage: true
  })
}
export function fetchShareAiDashboard(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/dashboard/share',
    data,
    showSuccessMessage: true
  })
}
export function fetchDashboardChartSessions(datasetId: AiId) {
  return request.get<any[]>({
    url: '/api/system/ai/dashboard/chart-sessions',
    params: { datasetId }
  })
}

// ===== 超级密钥 =====
export function fetchAiSecretPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/secret/page', params })
}
export function fetchSaveAiSecret(data: Record<string, any>) {
  return request.post<any>({
    url: '/api/system/ai/secret/submit',
    data,
    showSuccessMessage: true
  })
}
export function fetchRemoveAiSecret(id: AiId) {
  return request.post<void>({
    url: '/api/system/ai/secret/remove',
    data: { id },
    showSuccessMessage: true
  })
}
export function fetchStatusAiSecret(data: Record<string, any>) {
  return request.post<void>({
    url: '/api/system/ai/secret/status',
    data,
    showSuccessMessage: true
  })
}

// ===== 对话记录 / 账单 / 配额 =====
export function fetchAiConversationPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/conversation/page', params })
}
export function fetchAiConversationDetail(id: AiId) {
  return request.get<any>({ url: '/api/system/ai/conversation/detail', params: { id } })
}
export function fetchAiConversationTrend(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/ai/conversation/trend', params })
}
export function fetchExportAiConversation(params: Record<string, any>) {
  return request.download({ url: '/api/system/ai/conversation/export', params })
}
export function fetchAiBillingPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/billing/page', params })
}
export function fetchAiBillingTrend(params: Record<string, any>) {
  return request.get<any[]>({ url: '/api/system/ai/billing/trend', params })
}
export function fetchExportAiBilling(params: Record<string, any>) {
  return request.download({ url: '/api/system/ai/billing/export', params })
}
export function fetchAiQuotaPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/ai/quota/page', params })
}
export function fetchSaveAiQuota(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/quota/submit', data })
}

// ===== 生成器 =====
export function fetchAiGenStream(type: string, data: Record<string, any>, handlers: AiSseHandlers) {
  return consumeAiSse(`/api/system/ai/gen/${type}/stream`, data, handlers)
}
export async function fetchAiGenExport(type: string, data: Record<string, any>) {
  const saved = await request.post<{ filename?: string; content?: string }>({
    url: `/api/system/ai/gen/${type}/export`,
    data
  })
  const content = saved?.content ?? ''
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = saved?.filename || `${type}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ===== 平台织入（只读候选） =====
export function fetchAiWeaveGenDraft(data: { description: string }) {
  return request.post<any>({ url: '/api/system/ai/weave/genDraft', data })
}
export function fetchAiWeaveApprovalSummary(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/weave/approvalSummary', data })
}
export function fetchAiWeaveReportCharts(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/weave/reportCharts', data })
}
export function fetchAiWeaveGisAsk(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/weave/gisAsk', data })
}
export function fetchAiWeaveTrackInsight(data: Record<string, any>) {
  return request.post<any>({ url: '/api/system/ai/weave/trackInsight', data })
}
