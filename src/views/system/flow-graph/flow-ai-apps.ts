/**
 * 流程设计器：拉取可绑到 AI 节点的已启用 AiApp。
 * 「已发布」= status==1 且 appType 为 workflow|chatflow。
 * 默认真 API；DEV 仅 VITE_FLOW_AI_MOCK=true 走本地 mock（等后端 tip 进 main 后关）。
 */
import { reactive } from 'vue'
import request from '@/utils/http'
import { isFlowAiMockOn, type FlowAiAppOption } from './flow-ai-mock'

const ALLOWED = new Set(['workflow', 'chatflow'])

function normalize(row: any): FlowAiAppOption | null {
  if (!row || row.id == null) return null
  const appType = String(row.appType || '')
  const status = Number(row.status)
  if (status !== 1 || !ALLOWED.has(appType)) return null
  return {
    id: row.id as number | string,
    name: String(row.name || row.id),
    appType,
    status,
    description: row.description ? String(row.description) : undefined
  }
}

/** 拉可选 AiApp；mock 时不打网。id 可能是 number 或雪花 string。 */
export async function loadPublishedAiFlows(): Promise<FlowAiAppOption[]> {
  if (isFlowAiMockOn()) {
    const { buildFlowAiAppMock } = await import('./flow-ai-mock')
    return buildFlowAiAppMock()
  }
  // page 无 status 过滤：多取后前端筛；workflow/chatflow 各拉一页合并
  const pages = await Promise.all(
    ['workflow', 'chatflow'].map((appType) =>
      request.get<any>({
        url: '/api/system/ai/app/page',
        params: { pageNum: 1, pageSize: 100, appType }
      })
    )
  )
  const seen = new Set<string>()
  const out: FlowAiAppOption[] = []
  for (const res of pages) {
    const records = (res?.records ?? res?.data?.records ?? []) as any[]
    for (const row of records) {
      const opt = normalize(row)
      if (!opt) continue
      const key = String(opt.id)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(opt)
    }
  }
  return out
}

/** 设计器内共享的 AiApp 下拉状态（递归 GraphChain 共用） */
export const flowAiAppsStore = reactive({
  list: [] as FlowAiAppOption[],
  loading: false,
  async reload(): Promise<void> {
    flowAiAppsStore.loading = true
    try {
      flowAiAppsStore.list = await loadPublishedAiFlows()
    } finally {
      flowAiAppsStore.loading = false
    }
  }
})
