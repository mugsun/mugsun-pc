/**
 * AI 抽屉内容 chunk 加载失败后的处理策略（纯函数，便于单测）。
 *
 * - 抽屉入口 .js chunk 失败：显示「重试」，重试时给 URL 加 ?retry=N 绕过浏览器对失败 import 的缓存。
 * - 以下情况加查询参数救不回来，改用 location.reload() 兜底：
 *   连续失败达到 MAX_CHAT_LOAD_FAILURES 次、失败的是 CSS、失败的是嵌套 chunk（不是抽屉入口）。
 * - 同一会话里自动 reload 过一次后不再 reload，只显示出错状态，防止死循环。
 */

/** 连续失败多少次后改用整页刷新兜底 */
export const MAX_CHAT_LOAD_FAILURES = 2

/** sessionStorage 标记：本会话已经因抽屉加载失败自动刷新过 */
export const CHAT_RELOAD_FLAG_KEY = 'mugsun:ai-drawer:auto-reloaded'

/** 抽屉入口 chunk：开发时是 AiDrawerChat.vue，构建后是 AiDrawerChat-<hash>.js */
const ENTRY_CHUNK_RE = /\/AiDrawerChat(?:[-.][^/?#]*)?\.(?:js|vue)(?:[?#].*)?$/

export type FailureAction = 'retry' | 'reload' | 'error'

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 从动态 import / CSS 预加载的报错里取出失败资源的 URL，取不到返回 null */
export function parseFailedUrl(err: unknown): string | null {
  const msg = String((err as Error)?.message ?? err)
  const m = msg.match(/((?:https?:\/\/|\/)[^\s'"]+)/)
  return m ? m[1].replace(/[.,;:)]+$/, '') : null
}

export function stripRetryParam(url: string): string {
  return url.replace(/([?&])retry=\d+(&|$)/, (_, sep: string, tail: string) => (tail ? sep : ''))
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0]
}

export function isJsUrl(url: string): boolean {
  return /\.m?js$/.test(pathOf(url))
}

export function isCssUrl(url: string): boolean {
  return /\.css$/.test(pathOf(url))
}

export function isEntryChunk(url: string): boolean {
  return ENTRY_CHUNK_RE.test(url)
}

/** 重试时要 import 的 URL：只有 .js 才加 ?retry=N，否则返回 null（走原始 import） */
export function buildRetryUrl(url: string | null, attempt: number): string | null {
  if (!url || !isJsUrl(url)) return null
  const base = stripRetryParam(url)
  return `${base}${base.includes('?') ? '&' : '?'}retry=${attempt}`
}

/** 是否需要整页刷新兜底（不考虑会话标记） */
export function needsReload(url: string | null, consecutiveFailures: number): boolean {
  if (consecutiveFailures >= MAX_CHAT_LOAD_FAILURES) return true
  if (!url) return false
  if (isCssUrl(url)) return true
  return !isEntryChunk(url)
}

/**
 * 决定失败后的动作。返回 'reload' 时已写入会话标记，调用方负责 location.reload()。
 * 本会话已自动刷新过时返回 'error'：只显示出错状态，不再自动刷新。
 */
export function decideOnFailure(
  url: string | null,
  consecutiveFailures: number,
  storage: FlagStorage | null
): FailureAction {
  if (!needsReload(url, consecutiveFailures)) return 'retry'
  try {
    if (!storage || storage.getItem(CHAT_RELOAD_FLAG_KEY)) return 'error'
    storage.setItem(CHAT_RELOAD_FLAG_KEY, '1')
    return 'reload'
  } catch {
    return 'error'
  }
}
