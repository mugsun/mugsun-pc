import { computed, ref, type Ref } from 'vue'
import { isCanceledError } from '@/utils/sys/error-handle'
import { newTraceId } from '../shared/traceId'

type FetchPage = (params: Record<string, any>, opts: { traceId: string }) => Promise<any>

/**
 * MCP 工具列表的加载状态：
 * - 失败时不弹 toast（请求带 showErrorMessage:false），页面显示错误态，
 *   错误编号用本次请求的 X-Trace-Id；后端原文只进 console。
 * - 每次加载生成新的编号，所以重试再失败时编号会刷新。
 * - 只认最后一次请求的结果：切 tab / 搜索时旧响应不会覆盖新结果。
 * - liveText 给 polite live region：每次失败写入一次，开始加载时清空。
 */
export function useMcpList(deps: {
  fetchPage: FetchPage
  category: Ref<string>
  keyword: Ref<string>
  t: (key: string, named?: Record<string, unknown>) => string
}) {
  const { fetchPage, category, keyword, t } = deps
  const records = ref<any[]>([])
  const loading = ref(false)
  /** 错误编号；null 表示没有错误 */
  const loadError = ref<string | null>(null)
  const liveText = ref('')
  let seq = 0

  const loadErrorText = computed(() => t('aiMcpList.loadFailed', { id: loadError.value ?? '' }))
  /** 有搜索词或分类筛选：空结果显示「没有符合条件」，和真正没有数据区分 */
  const filtered = computed(() => !!keyword.value.trim() || !!category.value)

  async function reload(): Promise<void> {
    const mine = ++seq
    const traceId = newTraceId()
    loading.value = true
    liveText.value = ''
    try {
      const res = await fetchPage(
        {
          pageNum: 1,
          pageSize: 50,
          name: keyword.value || undefined,
          category: category.value || undefined
        },
        { traceId }
      )
      if (mine !== seq) return
      records.value = res?.records ?? []
      loadError.value = null
    } catch (err) {
      if (mine !== seq || isCanceledError(err)) return
      console.error('[AiMcp] list failed', { traceId, error: err })
      records.value = []
      loadError.value = traceId
      liveText.value = loadErrorText.value
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  return { records, loading, loadError, loadErrorText, liveText, filtered, reload }
}
