import { compareVersions, validate } from 'compare-versions'
import { computed, ref } from 'vue'
import { isCanceledError } from '@/utils/sys/error-handle'
import { newTraceId } from '@/utils/http/traceId'

/** 后端 SysChangelog.type 的取值；其他值（老数据、手工改库）按 other 显示，不报错 */
export type ChangelogType = 'feature' | 'optimize' | 'fix' | 'other'

export interface ChangelogItem {
  id: string
  version: string
  type: ChangelogType
  title: string
  /** 发布日期 yyyy-MM-dd；后端没给发布时间时为空串 */
  date: string
}

type FetchRecent = (limit: number, opts: { traceId: string }) => Promise<any[] | null | undefined>

const KNOWN_TYPES = new Set<ChangelogType>(['feature', 'optimize', 'fix'])

/** 后端行 → 卡片条目。publishTime 是 "yyyy-MM-dd HH:mm:ss"，只取日期部分 */
export function toChangelogItem(row: any, index: number): ChangelogItem {
  const type = String(row?.type ?? '') as ChangelogType
  return {
    id: String(row?.id ?? `row-${index}`),
    version: String(row?.version ?? '').trim(),
    type: KNOWN_TYPES.has(type) ? type : 'other',
    title: String(row?.title ?? '').trim(),
    date: String(row?.publishTime ?? '').slice(0, 10)
  }
}

export interface ChangelogEntry extends ChangelogItem {
  /** 版本比当前版本新（前端构建落后于后台记录）：显示「未升级」 */
  notInstalled: boolean
}

/** 去掉 v/V 前缀后交给 compare-versions 校验；不合法返回 null（不加标签、不报错） */
function normalizeVersion(v: string | null | undefined): string | null {
  const s = String(v ?? '')
    .trim()
    .replace(/^v/i, '')
  return s && validate(s) ? s : null
}

/** 条目版本是否比当前版本新；任一方版本号不合法时返回 false */
export function isNewerThan(version: string, current: string): boolean {
  const a = normalizeVersion(version)
  const b = normalizeVersion(current)
  return !!a && !!b && compareVersions(a, b) > 0
}

/**
 * 给条目标上「未升级」，并找出比当前版本新的最高版本（显示「有新版本 vX」）。
 * 当前版本或条目版本号不合法时不加标签；没有更新的版本时 available 为 null。
 */
export function markVersions(
  items: ChangelogItem[],
  current: string
): { entries: ChangelogEntry[]; available: string | null } {
  let latest: string | null = null
  const entries = items.map((item) => {
    const notInstalled = isNewerThan(item.version, current)
    if (notInstalled) {
      const v = normalizeVersion(item.version)!
      if (!latest || compareVersions(v, latest) > 0) latest = v
    }
    return { ...item, notInstalled }
  })
  return { entries, available: latest ? `v${latest}` : null }
}

/**
 * 工作台「更新日志」卡片的数据：
 * - 失败时不弹 toast（请求带 showErrorMessage:false），卡片显示错误态和重试按钮，
 *   错误编号用本次请求的 X-Trace-Id；后端原文只进 console。
 * - 每次加载生成新的编号，所以重试再失败时编号会刷新。
 * - 只认最后一次请求的结果：连点重试、卸载后返回的旧响应都会被丢弃。
 * - liveText 给 polite live region：每次失败写入一次，开始加载时清空。
 * - 后端假数据已清掉（boot#15），空列表是常态，走空态而不是错误态。
 * - currentVersion 是前端构建版本（package.json，经 vite define 注入 __PKG_VERSION__）；
 *   后台记录由管理员维护，版本可能比前端构建新，比它新的条目标「未升级」。
 */
export function useChangelogRecent(deps: {
  fetchRecent: FetchRecent
  t: (key: string, named?: Record<string, unknown>) => string
  limit?: number
  currentVersion?: string
}) {
  const { fetchRecent, t, limit = 6, currentVersion = '' } = deps
  const items = ref<ChangelogItem[]>([])
  const loading = ref(false)
  /** 错误编号；null 表示没有错误 */
  const loadError = ref<string | null>(null)
  const liveText = ref('')
  let seq = 0

  /**
   * 错误文案拆成两段渲染：「消息 + 分隔符」和「编号段」，编号段在页面上整段换行，
   * 不在「（错误编号：」和编号之间断开。两段拼起来就是完整文案（读屏也用完整文案）。
   */
  const loadErrorLead = computed(
    () =>
      t('pages.dashboard.console.changelogLoadFailed') + t('pages.dashboard.console.changelogIdSep')
  )
  const loadErrorIdPart = computed(() =>
    t('pages.dashboard.console.changelogIdPart', { id: loadError.value ?? '' })
  )
  const loadErrorText = computed(() => loadErrorLead.value + loadErrorIdPart.value)
  const versions = computed(() => markVersions(items.value, currentVersion))
  const entries = computed(() => versions.value.entries)
  /** 比当前版本新的最高版本（如 v0.2.0）；没有时为 null */
  const availableVersion = computed(() => versions.value.available)

  /** 作废在途请求（组件卸载时调用）：之后返回的结果一律丢弃 */
  function invalidate(): void {
    seq++
    loading.value = false
    liveText.value = ''
  }

  async function reload(): Promise<void> {
    const mine = ++seq
    const traceId = newTraceId()
    loading.value = true
    liveText.value = ''
    try {
      const rows = await fetchRecent(limit, { traceId })
      if (mine !== seq) return
      items.value = (Array.isArray(rows) ? rows : []).map(toChangelogItem)
      loadError.value = null
    } catch (err) {
      if (mine !== seq || isCanceledError(err)) return
      console.error('[Dashboard] changelog recent failed', { traceId, error: err })
      items.value = []
      loadError.value = traceId
      liveText.value = loadErrorText.value
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  return {
    items,
    entries,
    availableVersion,
    loading,
    loadError,
    loadErrorLead,
    loadErrorIdPart,
    loadErrorText,
    liveText,
    reload,
    invalidate
  }
}
