/**
 * AI 抽屉内容 chunk 加载失败后的处理策略（纯函数，便于单测）。
 *
 * - 抽屉入口 .js chunk 失败：显示「重试」，重试时给 URL 加 ?retry=N 绕过浏览器对失败 import 的缓存。
 * - 以下情况加查询参数救不回来，改用 location.reload() 兜底：
 *   连续失败达到 MAX_CHAT_LOAD_FAILURES 次、失败的是 CSS、失败的是嵌套 chunk（不是抽屉入口）。
 * - 加载超时（CHAT_LOAD_TIMEOUT）同样算一次失败，计入连续失败次数。
 * - 同一会话里自动 reload 过一次后不再 reload，只显示出错状态，防止死循环；
 *   加载成功后清掉会话标记，之后再出问题仍可自动刷新一次。
 */

/** 连续失败多少次后改用整页刷新兜底 */
export const MAX_CHAT_LOAD_FAILURES = 2

/** sessionStorage 标记：本会话已经因抽屉加载失败自动刷新过 */
export const CHAT_RELOAD_FLAG_KEY = 'mugsun:ai-drawer:auto-reloaded'

/** 抽屉入口 chunk：开发时是 AiDrawerChat.vue，构建后是 AiDrawerChat-<hash>.js */
const ENTRY_CHUNK_RE = /\/AiDrawerChat(?:[-.][^/?#]*)?\.(?:js|vue)(?:[?#].*)?$/

/** 抽屉 chunk 加载超时（毫秒），超时按一次失败处理 */
export const CHAT_LOAD_TIMEOUT = 15_000

export type FailureAction = 'retry' | 'reload' | 'error'

type FlagStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

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

/** 超时错误：不带 URL，走「重试」，但计入连续失败次数 */
export class ChatLoadTimeoutError extends Error {
  constructor(ms: number) {
    super(`AI drawer chunk load timed out after ${ms}ms`)
    this.name = 'ChatLoadTimeoutError'
  }
}

/** 给加载加超时：超时后以 ChatLoadTimeoutError 拒绝 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ChatLoadTimeoutError(ms)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/** 加载成功后清掉自动刷新标记 */
export function clearReloadFlag(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(CHAT_RELOAD_FLAG_KEY)
  } catch {
    // sessionStorage 不可用时忽略
  }
}

export interface ChatLoaderOptions<T> {
  /** 实际的 import：retryUrl 为 null 时走原始 import */
  importer: (retryUrl: string | null) => Promise<T>
  /** 抽屉当前是否可见；不可见时不计失败、不自动刷新 */
  isActive: () => boolean
  storage: () => FlagStorage | null
  reload: () => void
  timeout?: number
}

/**
 * 抽屉 chunk 加载器：重试参数、超时、连续失败计数、整页刷新兜底。
 * 每次 load() 有一个代数编号，invalidate()（抽屉关闭 / 卸载）后旧的加载作废：
 * 结果照常交给调用方，但不计数、不清标记、不刷新。
 * 同一次加载只结算一次：超时后原请求再成功或失败都不再计数。
 */
export function createChatLoader<T>(opts: ChatLoaderOptions<T>) {
  const ms = opts.timeout ?? CHAT_LOAD_TIMEOUT
  let failedUrl: string | null = null
  let attempt = 0
  let failures = 0
  let generation = 0
  let loaded = false

  function load(): Promise<T> {
    const gen = ++generation
    const p = opts.importer(buildRetryUrl(failedUrl, attempt))
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const stale = () => gen !== generation || !opts.isActive()
      const finish = (ok: boolean, v: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (ok) {
          loaded = true
          if (!stale()) {
            failures = 0
            clearReloadFlag(opts.storage())
          }
          resolve(v as T)
          return
        }
        if (!stale()) {
          failures++
          const url = parseFailedUrl(v)
          if (url) failedUrl = stripRetryParam(url)
          if (decideOnFailure(url, failures, opts.storage()) === 'reload') opts.reload()
        }
        reject(v)
      }
      const timer = setTimeout(() => finish(false, new ChatLoadTimeoutError(ms)), ms)
      p.then(
        (m) => finish(true, m),
        (e) => finish(false, e)
      )
    })
  }

  return {
    load,
    /** 点「重试」：下次 import 换新的 ?retry=N */
    retry() {
      attempt++
    },
    /** 抽屉关闭 / 卸载：作废进行中的加载 */
    invalidate() {
      generation++
    },
    get failures() {
      return failures
    },
    get loaded() {
      return loaded
    }
  }
}
