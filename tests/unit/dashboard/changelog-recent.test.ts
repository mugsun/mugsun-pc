import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import { withSetup } from '../helpers/withSetup'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const httpGet = vi.fn()
vi.mock('@/utils/http', () => ({ default: { get: (...a: unknown[]) => httpGet(...a) } }))

import { HttpError } from '@/utils/http/error'
import { fetchChangelogRecent } from '@/api/feedback'
import { TRACE_HEADER, newTraceId } from '@/utils/http/traceId'
import { toChangelogItem, useChangelogRecent } from '@/views/dashboard/console/useChangelogRecent'

const root = resolve(__dirname, '../../../')
const read = (f: string) => readFileSync(resolve(root, f), 'utf-8')
const get = (pack: any, key: string) => key.split('.').reduce((o, k) => o?.[k], pack)
const fill = (s: string, named?: Record<string, unknown>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(named?.[k] ?? ''))
const tOf = (pack: any) => (k: string, named?: Record<string, unknown>) => fill(get(pack, k), named)
const HEX32 = /^[0-9a-f]{32}$/

function deferred<T>() {
  let resolveFn!: (v: T) => void
  let rejectFn!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res
    rejectFn = rej
  })
  return { promise, resolve: resolveFn, reject: rejectFn }
}

function setup(fetchRecent: any, pack: any = zh) {
  const { result, app } = withSetup(() =>
    useChangelogRecent({ fetchRecent, t: tOf(pack), limit: 6 })
  )
  return { ...result, app }
}

const ROW = {
  id: 7,
  version: 'v0.2.0',
  type: 'feature',
  title: '工作台恢复更新日志',
  publishTime: '2026-10-18 09:30:00'
}

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  httpGet.mockReset()
})

describe('工作台更新日志：接口', () => {
  it('请求 /api/system/changelog/recent，带 limit、X-Trace-Id，且不弹全局 toast', async () => {
    httpGet.mockResolvedValue([])
    await fetchChangelogRecent(6, { traceId: 'a'.repeat(32) })
    expect(httpGet).toHaveBeenCalledWith({
      url: '/api/system/changelog/recent',
      params: { limit: 6 },
      showErrorMessage: false,
      headers: { [TRACE_HEADER]: 'a'.repeat(32) }
    })
  })

  it('没给 traceId 时不带头，limit 默认 5（与后端默认一致）', async () => {
    httpGet.mockResolvedValue([])
    await fetchChangelogRecent()
    expect(httpGet.mock.calls[0][0]).toMatchObject({
      params: { limit: 5 },
      showErrorMessage: false,
      headers: undefined
    })
  })

  it('newTraceId 生成 32 位十六进制，每次不同', () => {
    const a = newTraceId()
    expect(a).toMatch(HEX32)
    expect(newTraceId()).not.toBe(a)
  })
})

describe('工作台更新日志：数据映射', () => {
  it('取发布日期、去空白；未知类型按 other；缺 id 时用序号兜底', () => {
    expect(toChangelogItem(ROW, 0)).toEqual({
      id: '7',
      version: 'v0.2.0',
      type: 'feature',
      title: '工作台恢复更新日志',
      date: '2026-10-18'
    })
    expect(
      toChangelogItem({ type: 'breaking', title: '  x  ', version: null, publishTime: null }, 3)
    ).toEqual({ id: 'row-3', version: '', type: 'other', title: 'x', date: '' })
  })
})

describe('工作台更新日志：状态', () => {
  it('加载中：loading 为 true，结束后为 false', async () => {
    const d = deferred<any[]>()
    const s = setup(vi.fn().mockReturnValue(d.promise))
    const p = s.reload()
    expect(s.loading.value).toBe(true)
    expect(s.loadError.value).toBeNull()
    d.resolve([ROW])
    await p
    expect(s.loading.value).toBe(false)
    s.app.unmount()
  })

  it('成功：按后端顺序映射，传 limit 和本次 traceId', async () => {
    const fetchRecent = vi.fn().mockResolvedValue([ROW, { ...ROW, id: 8, type: 'fix' }])
    const s = setup(fetchRecent)
    await s.reload()
    expect(fetchRecent).toHaveBeenCalledWith(6, { traceId: expect.stringMatching(HEX32) })
    expect(s.items.value.map((i) => [i.id, i.type])).toEqual([
      ['7', 'feature'],
      ['8', 'fix']
    ])
    expect(s.loadError.value).toBeNull()
    expect(s.liveText.value).toBe('')
    s.app.unmount()
  })

  it('空：后端返回空数组或 null 都是空列表，不算错误', async () => {
    for (const v of [[], null, undefined]) {
      const s = setup(vi.fn().mockResolvedValue(v))
      await s.reload()
      expect(s.items.value).toEqual([])
      expect(s.loadError.value).toBeNull()
      expect(s.loading.value).toBe(false)
      s.app.unmount()
    }
  })

  it('失败：显示错误编号（即请求的 X-Trace-Id），不上抛，后端原文只进 console', async () => {
    const err = new HttpError('java.lang.NullPointerException at Foo.bar(Foo.java:1)', 500)
    const fetchRecent = vi.fn().mockRejectedValue(err)
    const s = setup(fetchRecent)
    await expect(s.reload()).resolves.toBeUndefined()
    const sentId = fetchRecent.mock.calls[0][1].traceId
    expect(s.loadError.value).toBe(sentId)
    expect(s.items.value).toEqual([])
    expect(s.loading.value).toBe(false)
    expect(s.loadErrorText.value).toBe(`更新日志加载失败，请稍后重试（错误编号：${sentId}）`)
    expect(s.loadErrorLead.value + s.loadErrorIdPart.value).toBe(s.loadErrorText.value)
    expect(s.loadErrorIdPart.value).toBe(`（错误编号：${sentId}）`)
    expect(s.loadErrorText.value).not.toContain('NullPointerException')
    expect(s.liveText.value).toBe(s.loadErrorText.value)
    expect(consoleError).toHaveBeenCalledWith('[Dashboard] changelog recent failed', {
      traceId: sentId,
      error: err
    })
    s.app.unmount()
  })

  it('英文错误文案', async () => {
    const s = setup(vi.fn().mockRejectedValue(new HttpError('x', 500)), en)
    await s.reload()
    expect(s.loadErrorText.value).toBe(
      `Failed to load the changelog. Try again later (Error ID: ${s.loadError.value}).`
    )
    s.app.unmount()
  })

  it('重试：再失败时编号刷新、live region 先清空再写入；成功后清掉错误', async () => {
    const fetchRecent = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('x', 500))
      .mockRejectedValueOnce(new HttpError('x', 502))
      .mockResolvedValueOnce([ROW])
    const s = setup(fetchRecent)
    await s.reload()
    const first = s.loadError.value
    const p = s.reload()
    expect(s.liveText.value).toBe('')
    await p
    expect(s.loadError.value).not.toBe(first)
    expect(s.loadError.value).toMatch(HEX32)
    await s.reload()
    expect(s.loadError.value).toBeNull()
    expect(s.items.value).toHaveLength(1)
    s.app.unmount()
  })

  it('竞态：只认最后一次请求，先发后到的成功或失败都不覆盖', async () => {
    const slowOk = deferred<any[]>()
    const slowFail = deferred<any[]>()
    const fast = deferred<any[]>()
    const fetchRecent = vi
      .fn()
      .mockReturnValueOnce(slowOk.promise)
      .mockReturnValueOnce(slowFail.promise)
      .mockReturnValueOnce(fast.promise)
    const s = setup(fetchRecent)
    const p1 = s.reload()
    const p2 = s.reload()
    const p3 = s.reload()
    fast.resolve([{ ...ROW, id: 99 }])
    await p3
    slowOk.resolve([ROW])
    slowFail.reject(new HttpError('x', 500))
    await Promise.all([p1, p2])
    expect(s.items.value.map((i) => i.id)).toEqual(['99'])
    expect(s.loadError.value).toBeNull()
    expect(s.loading.value).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
    s.app.unmount()
  })

  it('竞态：新请求在途时旧请求返回，不提前结束加载态', async () => {
    const old = deferred<any[]>()
    const cur = deferred<any[]>()
    const s = setup(vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(cur.promise))
    const p1 = s.reload()
    const p2 = s.reload()
    old.resolve([ROW])
    await p1
    expect(s.loading.value).toBe(true)
    expect(s.items.value).toEqual([])
    cur.resolve([])
    await p2
    expect(s.loading.value).toBe(false)
  })

  it('卸载（invalidate）后返回的结果丢弃', async () => {
    const d = deferred<any[]>()
    const s = setup(vi.fn().mockReturnValue(d.promise))
    const p = s.reload()
    s.invalidate()
    expect(s.loading.value).toBe(false)
    d.reject(new HttpError('x', 500))
    await p
    expect(s.loadError.value).toBeNull()
    expect(s.liveText.value).toBe('')
  })

  it('主动取消的请求不算错误', async () => {
    const s = setup(
      vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'CanceledError' }))
    )
    await s.reload()
    expect(s.loadError.value).toBeNull()
    expect(s.loading.value).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('工作台更新日志：文案与页面', () => {
  const KEYS = [
    'changelog',
    'noChangelog',
    'currentVersion',
    'viewChangelog',
    'changelogLoadFailed',
    'changelogIdSep',
    'changelogIdPart',
    'changelogRetry',
    'changelogTypeFeature',
    'changelogTypeOptimize',
    'changelogTypeFix',
    'changelogTypeOther'
  ]
  it('中英文 key 齐全；编号段带 {id} 占位', () => {
    for (const pack of [zh, en]) {
      for (const k of KEYS) {
        expect(typeof get(pack, `pages.dashboard.console.${k}`), k).toBe('string')
      }
      expect(get(pack, 'pages.dashboard.console.changelogIdPart')).toContain('{id}')
    }
  })

  it('工作台挂 ChangelogCard；卡片保留「当前版本」、带 live region 与重试', () => {
    const page = read('src/views/dashboard/console/index.vue')
    expect(page).toContain('<ChangelogCard />')
    const card = read('src/views/dashboard/console/ChangelogCard.vue')
    expect(card).toContain("$t('pages.dashboard.console.currentVersion')")
    expect(card).toContain('v{{ appVersion }}')
    expect(card).toContain('aria-live="polite"')
    expect(card).toContain('data-test="changelog-retry"')
    expect(card).toContain('onUnmounted(invalidate)')
  })
})
