/**
 * 埋点「访问路径」的数据形状（对齐 boot GET /api/system/track/journey）和页面用到的纯函数。
 *
 * 口径（后端算，这里只展示）：按会话算；步骤之间要紧挨着；连着重复的同一个页面只算一次；
 * 每次会话只从起点页面第一次出现的地方往后看，在每一步只算一次。所以选了步骤以后：
 * - next 各项之和 + ended + others = 最后一步的会话数；
 * - 把 next 里的某一项选成下一步，这一步的会话数就是那一项的数。
 *
 * steps 参数是 JSON 数组字符串（页面地址里可以有逗号，不能用逗号分隔），
 * 要拼成一个 String 下发，不要传 string[]（axios 会变成 steps[]=）。
 */

/** 一条路径最多选几步（和后端一致） */
export const JOURNEY_STEPS_MAX = 5
/** 每一列默认列出多少个页面 */
export const JOURNEY_LIMIT_DEFAULT = 10
/** 每一列最多列出多少个页面（和后端一致） */
export const JOURNEY_LIMIT_MAX = 50

/** 起点方式：any 路径可以从会话的任意位置开始；entry 必须从会话的第一个页面开始 */
export type TrackJourneyStart = 'any' | 'entry'

export interface TrackJourneyPage {
  page: string
  sessions: number
}

export interface TrackJourneyResult {
  days: number
  start: TrackJourneyStart
  /** 统计范围内有页面浏览的会话数 */
  total: number
  /** 已选的每一步和走到这一步的会话数 */
  steps: TrackJourneyPage[]
  /** 下一步的去向；还没选起点时是可以当起点的页面 */
  next: TrackJourneyPage[]
  /** 走完已选的步骤以后没有下一步的会话数 */
  ended: number
  /** 去向排不进 next 的会话数 */
  others: number
}

/** 发往接口的查询参数：steps 已经是 JSON 数组字符串，没选步骤时不带 */
export interface TrackJourneyQuery {
  appKey: string
  days: number
  start: TrackJourneyStart
  limit: number
  steps?: string
}

/** 列里的一行：page 可以点（选成下一步）；ended / others 只是合计，不能点 */
export interface TrackJourneyRow {
  kind: 'page' | 'ended' | 'others'
  /** kind=page 时是页面地址，其余为空串 */
  page: string
  sessions: number
  /** 占这一列基数的百分比，0 到 100 */
  pct: number
}

function toCount(raw: unknown): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function toPages(raw: unknown): TrackJourneyPage[] {
  if (!Array.isArray(raw)) return []
  const list: TrackJourneyPage[] = []
  for (const item of raw) {
    const page = typeof item?.page === 'string' ? item.page : ''
    if (page) list.push({ page, sessions: toCount(item?.sessions) })
  }
  return list
}

/** 把接口返回的数据规整成固定形状：缺字段、字段类型不对都当 0 或空列表，页面不用再到处判空 */
export function normalizeJourneyResult(raw: unknown): TrackJourneyResult {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    days: toCount(r.days),
    start: r.start === 'entry' ? 'entry' : 'any',
    total: toCount(r.total),
    steps: toPages(r.steps),
    next: toPages(r.next),
    ended: toCount(r.ended),
    others: toCount(r.others)
  }
}

/** 已选的步骤 → 接口的 steps 参数；一步都没选时返回 undefined（不带这个参数） */
export function encodeJourneySteps(pages: readonly string[]): string | undefined {
  return pages.length > 0 ? JSON.stringify(pages) : undefined
}

/** 占比，0 到 100；基数不大于 0 时是 0 */
export function journeyShare(part: number, base: number): number {
  if (!(base > 0) || !(part > 0)) return 0
  return Math.min(100, (part / base) * 100)
}

/** 占比的显示文字：一位小数；大于 0 但不到 0.1% 的写成 <0.1%，不显示成 0.0% */
export function formatJourneyShare(pct: number): string {
  if (pct > 0 && pct < 0.1) return '<0.1%'
  return `${pct.toFixed(1)}%`
}

/**
 * 这一列的基数：选了步骤时是最后一步的会话数（各去向占「走到这一步的会话」的多少），
 * 还没选起点时是有页面浏览的会话总数
 */
export function journeyBase(result: TrackJourneyResult): number {
  const last = result.steps[result.steps.length - 1]
  return last ? last.sessions : result.total
}

/** 一列要显示的行：各去向按接口给的顺序，后面跟「其他页面」「没有下一步」两个合计（为 0 的不显示） */
export function buildJourneyRows(result: TrackJourneyResult): TrackJourneyRow[] {
  const base = journeyBase(result)
  const rows: TrackJourneyRow[] = result.next.map((item) => ({
    kind: 'page',
    page: item.page,
    sessions: item.sessions,
    pct: journeyShare(item.sessions, base)
  }))
  if (result.others > 0) {
    rows.push({
      kind: 'others',
      page: '',
      sessions: result.others,
      pct: journeyShare(result.others, base)
    })
  }
  if (result.ended > 0) {
    rows.push({
      kind: 'ended',
      page: '',
      sessions: result.ended,
      pct: journeyShare(result.ended, base)
    })
  }
  return rows
}

/**
 * 这一列还有没有没列出来的页面（决定显不显示「显示更多」）：
 * 有 others 就是有；任意位置选起点时后端不算 others（一次会话会算进好几个页面），
 * 这时列满了就当作可能还有
 */
export function journeyHasMore(result: TrackJourneyResult, limit: number): boolean {
  if (limit >= JOURNEY_LIMIT_MAX) return false
  if (result.others > 0) return true
  return result.steps.length === 0 && result.start === 'any' && result.next.length >= limit
}

/** 页面上的一列：带着 prefix 这几步查出来的结果；还没查回来、或者查失败时 result 是 null */
export interface TrackJourneyColumnData {
  prefix: readonly string[]
  result: TrackJourneyResult | null
}

/** 已选路径里的一步 */
export interface TrackJourneyCrumb {
  page: string
  /** 走到这一步的会话数；还不知道（正在查、或者查失败）时是 null */
  sessions: number | null
  /** 占上一步的百分比；第一步没有上一步，或者前后有一个数还不知道时是 null */
  pctOfPrev: number | null
}

/**
 * 已选路径的每一步和它的会话数。列是一层一层选出来的：第 k 列带着前 k 步去查，
 * 所以最后一列的 prefix 就是整条已选路径。数从已经查回来的结果里取：
 * 先用后面的列返回的 steps（最近一次查的），没有就用这一步所在那一列里被选中的那一项
 * （后端保证两个数相等），都没有就是 null。
 */
export function buildJourneyCrumbs(
  columns: readonly TrackJourneyColumnData[]
): TrackJourneyCrumb[] {
  const selected = columns.length > 0 ? columns[columns.length - 1].prefix : []
  const crumbs: TrackJourneyCrumb[] = []
  selected.forEach((page, i) => {
    let sessions: number | null = null
    for (let j = columns.length - 1; j > i && sessions === null; j--) {
      const step = columns[j].result?.steps[i]
      if (step && step.page === page) sessions = step.sessions
    }
    if (sessions === null) {
      const item = columns[i]?.result?.next.find((n) => n.page === page)
      if (item) sessions = item.sessions
    }
    const prev = i > 0 ? crumbs[i - 1].sessions : null
    crumbs.push({
      page,
      sessions,
      pctOfPrev: i > 0 && sessions !== null && prev !== null ? journeyShare(sessions, prev) : null
    })
  })
  return crumbs
}

/** 走完整条路径的占比：最后一步的会话数占第一步的多少；不到两步、或者有数还不知道时是 null */
export function journeyOverallShare(crumbs: readonly TrackJourneyCrumb[]): number | null {
  if (crumbs.length < 2) return null
  const first = crumbs[0].sessions
  const last = crumbs[crumbs.length - 1].sessions
  if (first === null || last === null) return null
  return journeyShare(last, first)
}
