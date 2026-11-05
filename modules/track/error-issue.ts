/**
 * 错误问题单（error-issues）前端约定：状态 / releaseFlag 文案键与 404 判定。
 * 后端契约见 /api/system/track/error-issues*；组内事件仍走 /errors/detail。
 */

export type ErrorIssueStatus = 'OPEN' | 'ASSIGNED' | 'RESOLVED'

/** 筛了 release 时后端给出的相对该 release 的标记 */
export type ErrorIssueReleaseFlag = 'NEW' | 'REGRESSED' | 'ONGOING'

export interface ErrorIssueRecord {
  id: number | string
  appKey: string
  fingerprint: string
  title?: string
  message?: string
  status: ErrorIssueStatus
  assigneeId?: number | null
  assigneeName?: string | null
  firstRelease?: string | null
  lastRelease?: string | null
  firstSeenAt?: number | string | null
  lastSeenAt?: number | string | null
  resolvedAt?: number | string | null
  eventCount?: number
  sessionCount?: number
  userCount?: number
  regressed?: boolean
  releaseFlag?: ErrorIssueReleaseFlag | null
  updateTime?: number | string | null
}

export interface ErrorIssueDetail extends ErrorIssueRecord {
  latestSessionId?: string | null
  latestUserId?: number | null
  latestDistinctId?: string | null
  latestEventId?: string | null
  latestUrlPath?: string | null
  latestRoutePath?: string | null
  latestStack?: string | null
  recentReleases?: string[] | null
}

/** i18n key under pages.track.errorIssue.status.* */
export function errorIssueStatusKey(status?: string | null): string {
  switch (status) {
    case 'OPEN':
      return 'open'
    case 'ASSIGNED':
      return 'assigned'
    case 'RESOLVED':
      return 'resolved'
    default:
      return 'unknown'
  }
}

/** i18n key under pages.track.errorIssue.releaseFlag.* */
export function errorIssueReleaseFlagKey(flag?: string | null): string | null {
  switch (flag) {
    case 'NEW':
      return 'new'
    case 'REGRESSED':
      return 'regressed'
    case 'ONGOING':
      return 'ongoing'
    default:
      return null
  }
}

/** ElTag type for status */
export function errorIssueStatusTagType(
  status?: string | null
): 'info' | 'warning' | 'success' | 'danger' {
  switch (status) {
    case 'OPEN':
      return 'danger'
    case 'ASSIGNED':
      return 'warning'
    case 'RESOLVED':
      return 'success'
    default:
      return 'info'
  }
}

/** ElTag type for releaseFlag */
export function errorIssueReleaseFlagTagType(
  flag?: string | null
): 'success' | 'danger' | 'info' | undefined {
  switch (flag) {
    case 'NEW':
      return 'success'
    case 'REGRESSED':
      return 'danger'
    case 'ONGOING':
      return 'info'
    default:
      return undefined
  }
}

/** 摘要：优先 title，否则 message */
export function errorIssueSummary(row: { title?: string | null; message?: string | null }): string {
  const t = String(row.title ?? '').trim()
  if (t) return t
  const m = String(row.message ?? '').trim()
  return m || '-'
}

/**
 * 列表/详情接口 404（或同类「未实现」）时友好空态，不弹阻塞 toast。
 * HttpError.code 为 HTTP status；部分网关会包成业务码，一并认 404。
 */
export function isErrorIssueBackendMissing(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const anyErr = err as { code?: unknown; bizCode?: unknown; response?: { status?: unknown } }
  const candidates = [anyErr.code, anyErr.bizCode, anyErr.response?.status]
  return candidates.some((c) => Number(c) === 404)
}
