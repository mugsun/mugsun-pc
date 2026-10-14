import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_LOAD_TIMEOUT,
  CHAT_RELOAD_FLAG_KEY,
  ChatLoadTimeoutError,
  MAX_CHAT_LOAD_FAILURES,
  buildRetryUrl,
  clearReloadFlag,
  createChatLoader,
  decideOnFailure,
  isEntryChunk,
  needsReload,
  parseFailedUrl,
  stripRetryParam,
  withTimeout
} from '../../../modules/ai/views/assistant/drawer/chatChunkRetry'

const ENTRY = 'https://app.example.com/assets/AiDrawerChat-Ab12Cd.js'
const NESTED = 'https://app.example.com/assets/vue-element-plus-x-9f8e.js'
const CSS = '/assets/AiDrawerChat-Ab12Cd.css'

function memStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m
  }
}

describe('parseFailedUrl', () => {
  it('取出动态 import 报错里的 URL', () => {
    const e = new TypeError(`Failed to fetch dynamically imported module: ${ENTRY}`)
    expect(parseFailedUrl(e)).toBe(ENTRY)
  })
  it('取出 CSS 预加载报错里的相对路径', () => {
    expect(parseFailedUrl(new Error(`Unable to preload CSS for ${CSS}`))).toBe(CSS)
  })
  it('没有 URL 时返回 null', () => {
    expect(parseFailedUrl(new Error('timeout'))).toBeNull()
  })
})

describe('buildRetryUrl', () => {
  it('只对 .js 加 ?retry=N，并替换旧的 retry 参数', () => {
    expect(buildRetryUrl(ENTRY, 1)).toBe(`${ENTRY}?retry=1`)
    expect(buildRetryUrl(`${ENTRY}?retry=1`, 2)).toBe(`${ENTRY}?retry=2`)
    expect(buildRetryUrl(`${ENTRY}?v=3`, 1)).toBe(`${ENTRY}?v=3&retry=1`)
  })
  it('CSS、.vue 或没有 URL 时不加参数', () => {
    expect(buildRetryUrl(CSS, 1)).toBeNull()
    expect(buildRetryUrl('http://localhost:3093/modules/x/AiDrawerChat.vue', 1)).toBeNull()
    expect(buildRetryUrl(null, 1)).toBeNull()
  })
  it('stripRetryParam 保留其他参数', () => {
    expect(stripRetryParam(`${ENTRY}?retry=2&v=3`)).toBe(`${ENTRY}?v=3`)
  })
})

describe('isEntryChunk', () => {
  it('识别构建产物和开发模式的入口', () => {
    expect(isEntryChunk(ENTRY)).toBe(true)
    expect(isEntryChunk(`${ENTRY}?retry=1`)).toBe(true)
    expect(isEntryChunk('http://localhost:3093/modules/ai/AiDrawerChat.vue')).toBe(true)
    expect(isEntryChunk(NESTED)).toBe(false)
    expect(isEntryChunk('https://x/assets/AiDrawerChatHistory-1.js')).toBe(false)
  })
})

describe('needsReload', () => {
  it('入口 .js 首次失败：给重试', () => {
    expect(needsReload(ENTRY, 1)).toBe(false)
    expect(needsReload(null, 1)).toBe(false)
  })
  it(`连续失败 ${MAX_CHAT_LOAD_FAILURES} 次、CSS、嵌套 chunk：整页刷新`, () => {
    expect(MAX_CHAT_LOAD_FAILURES).toBe(2)
    expect(needsReload(ENTRY, MAX_CHAT_LOAD_FAILURES)).toBe(true)
    expect(needsReload(null, MAX_CHAT_LOAD_FAILURES)).toBe(true)
    expect(needsReload(CSS, 1)).toBe(true)
    expect(needsReload(NESTED, 1)).toBe(true)
  })
})

describe('decideOnFailure', () => {
  it('不需要刷新时返回 retry，不写标记', () => {
    const s = memStorage()
    expect(decideOnFailure(ENTRY, 1, s)).toBe('retry')
    expect(s.map.size).toBe(0)
  })
  it('同一会话只自动刷新一次，之后只显示出错状态', () => {
    const s = memStorage()
    expect(decideOnFailure(NESTED, 1, s)).toBe('reload')
    expect(s.getItem(CHAT_RELOAD_FLAG_KEY)).toBe('1')
    expect(decideOnFailure(CSS, 1, s)).toBe('error')
    expect(decideOnFailure(ENTRY, 2, s)).toBe('error')
    expect(decideOnFailure(ENTRY, 1, s)).toBe('retry')
  })
  it('sessionStorage 不可用时不刷新，避免死循环', () => {
    expect(decideOnFailure(NESTED, 1, null)).toBe('error')
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {},
      removeItem: () => {}
    }
    expect(decideOnFailure(NESTED, 1, broken)).toBe('error')
  })
})

describe('加载超时', () => {
  afterEach(() => vi.useRealTimers())
  it(`超过 ${CHAT_LOAD_TIMEOUT}ms 以 ChatLoadTimeoutError 拒绝`, async () => {
    vi.useFakeTimers()
    const p = withTimeout(new Promise(() => {}), CHAT_LOAD_TIMEOUT)
    const done = expect(p).rejects.toBeInstanceOf(ChatLoadTimeoutError)
    await vi.advanceTimersByTimeAsync(CHAT_LOAD_TIMEOUT)
    await done
  })
  it('按时完成或先失败时透传结果，不再触发超时', async () => {
    await expect(withTimeout(Promise.resolve(1), 10)).resolves.toBe(1)
    const e = new Error('boom')
    await expect(withTimeout(Promise.reject(e), 10)).rejects.toBe(e)
  })
  it('超时计入连续失败：第一次给重试，连续第二次整页刷新', () => {
    const url = parseFailedUrl(new ChatLoadTimeoutError(CHAT_LOAD_TIMEOUT))
    expect(url).toBeNull()
    const s = memStorage()
    expect(decideOnFailure(url, 1, s)).toBe('retry')
    expect(decideOnFailure(url, MAX_CHAT_LOAD_FAILURES, s)).toBe('reload')
  })
})

describe('clearReloadFlag', () => {
  it('加载成功后清掉标记，之后再出问题仍可自动刷新一次', () => {
    const s = memStorage()
    expect(decideOnFailure(NESTED, 1, s)).toBe('reload')
    clearReloadFlag(s)
    expect(s.getItem(CHAT_RELOAD_FLAG_KEY)).toBeNull()
    expect(decideOnFailure(NESTED, 1, s)).toBe('reload')
  })
  it('sessionStorage 不可用时不抛错', () => {
    expect(() => clearReloadFlag(null)).not.toThrow()
    const broken = {
      removeItem: () => {
        throw new Error('denied')
      }
    }
    expect(() => clearReloadFlag(broken)).not.toThrow()
  })
})

describe('createChatLoader', () => {
  afterEach(() => vi.useRealTimers())

  function deferred<T = unknown>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  function setup(active = { v: true }) {
    const pending: ReturnType<typeof deferred>[] = []
    const reload = vi.fn()
    const storage = memStorage()
    const loader = createChatLoader({
      importer: () => {
        const d = deferred()
        pending.push(d)
        return d.promise
      },
      isActive: () => active.v,
      storage: () => storage,
      reload,
      timeout: 1000
    })
    return { loader, pending, reload, storage, active }
  }

  it('抽屉关闭后发生超时：不刷新页面，也不计失败', async () => {
    vi.useFakeTimers()
    const { loader, reload, active } = setup()
    // 已失败过一次，再失败就该整页刷新
    const first = loader.load().catch(() => {})
    await vi.advanceTimersByTimeAsync(1000)
    await first
    expect(loader.failures).toBe(1)
    const second = loader.load().catch((e) => e)
    // 用户关掉抽屉
    active.v = false
    loader.invalidate()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await second).toBeInstanceOf(ChatLoadTimeoutError)
    expect(reload).not.toHaveBeenCalled()
    expect(loader.failures).toBe(1)
  })

  it('只 invalidate（关闭后又打开前）旧加载超时也不刷新', async () => {
    vi.useFakeTimers()
    const { loader, reload } = setup()
    loader.load().catch(() => {})
    await vi.advanceTimersByTimeAsync(1000)
    const stale = loader.load().catch(() => {})
    loader.invalidate()
    await vi.advanceTimersByTimeAsync(1000)
    await stale
    expect(reload).not.toHaveBeenCalled()
    expect(loader.failures).toBe(1)
  })

  it('超时后原请求再返回成功或失败，不重复计数', async () => {
    vi.useFakeTimers()
    const { loader, pending, reload, storage } = setup()
    const a = loader.load().catch((e) => e)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await a).toBeInstanceOf(ChatLoadTimeoutError)
    expect(loader.failures).toBe(1)
    // 原请求迟到失败：不再计数，不触发刷新
    pending[0].reject(new TypeError(`Failed to fetch dynamically imported module: ${ENTRY}`))
    await vi.advanceTimersByTimeAsync(0)
    expect(loader.failures).toBe(1)
    expect(reload).not.toHaveBeenCalled()

    // 第二次也超时：到达 2 次，刷新一次
    storage.setItem('x', '1')
    const b = loader.load().catch(() => {})
    await vi.advanceTimersByTimeAsync(1000)
    await b
    expect(loader.failures).toBe(2)
    expect(reload).toHaveBeenCalledTimes(1)
    // 原请求迟到成功：不清零计数、不清标记
    pending[1].resolve({ default: {} })
    await vi.advanceTimersByTimeAsync(0)
    expect(loader.failures).toBe(2)
    expect(storage.getItem(CHAT_RELOAD_FLAG_KEY)).toBe('1')
  })

  it('加载成功清零计数并清标记；失败的 .js 下次重试加 ?retry=N', async () => {
    const urls: (string | null)[] = []
    const storage = memStorage()
    let fail = true
    const loader = createChatLoader({
      importer: (u) => {
        urls.push(u)
        return fail
          ? Promise.reject(new TypeError(`Failed to fetch dynamically imported module: ${ENTRY}`))
          : Promise.resolve('ok')
      },
      isActive: () => true,
      storage: () => storage,
      reload: () => {}
    })
    await loader.load().catch(() => {})
    expect(loader.failures).toBe(1)
    loader.retry()
    fail = false
    storage.setItem(CHAT_RELOAD_FLAG_KEY, '1')
    await expect(loader.load()).resolves.toBe('ok')
    expect(urls).toEqual([null, `${ENTRY}?retry=1`])
    expect(loader.failures).toBe(0)
    expect(storage.getItem(CHAT_RELOAD_FLAG_KEY)).toBeNull()
    expect(loader.loaded).toBe(true)
  })
})
