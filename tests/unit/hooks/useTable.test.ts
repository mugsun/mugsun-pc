import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))

const { useTable } = await import('@/hooks/core/useTable')
const { withSetup } = await import('../helpers/withSetup')

/** mybatis-flex 分页体 */
const page = (records: unknown[], totalRow: number, pageNumber = 1, pageSize = 10) => ({
  records,
  totalRow,
  pageNumber,
  pageSize
})

/** 与 useCrud 内置 smartAdapter 同口径：单测直连生产真实用法 */
const adapter = (resp: any) =>
  Array.isArray(resp)
    ? { records: resp, total: resp.length, current: 1, size: resp.length || 10 }
    : {
        records: resp?.records ?? [],
        total: resp?.totalRow ?? resp?.total ?? 0,
        current: resp?.pageNumber ?? resp?.current ?? 1,
        size: resp?.pageSize ?? resp?.size ?? 10
      }

const rows = (n: number, prefix = 'r') =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `${prefix}${i + 1}` }))

describe('useTable', () => {
  let apiFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    apiFn = vi.fn().mockResolvedValue(page(rows(2), 2))
  })

  const setup = (config: Record<string, any> = {}) =>
    withSetup(() =>
      useTable({
        core: {
          apiFn,
          apiParams: { pageNum: 1, pageSize: 10 },
          paginationKey: { current: 'pageNum', size: 'pageSize' },
          ...config.core
        },
        transform: { responseAdapter: adapter, ...config.transform },
        performance: { enableCache: false, ...config.performance },
        hooks: config.hooks
      } as never)
    )

  it('immediate 默认开启：挂载即请求', async () => {
    const { result, app } = setup()
    await vi.waitFor(() => expect(apiFn).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(result.data.value).toHaveLength(2))
    app.unmount()
  })

  it('immediate=false 挂载不请求', async () => {
    const { result, app } = setup({ core: { immediate: false } })
    await new Promise((r) => setTimeout(r, 0))
    expect(apiFn).not.toHaveBeenCalled()
    expect(result.data.value).toEqual([])
    app.unmount()
  })

  it('分页字段按 paginationKey 映射进请求参数', async () => {
    const { app } = setup()
    await vi.waitFor(() => expect(apiFn).toHaveBeenCalled())
    const params = apiFn.mock.calls[0][0]
    expect(params).toMatchObject({ pageNum: 1, pageSize: 10 })
    expect(params).not.toHaveProperty('current')
    app.unmount()
  })

  it('响应体的 totalRow/pageNumber 回填分页状态', async () => {
    apiFn.mockResolvedValue(page(rows(3), 57, 2, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(3))
    expect(result.pagination.total).toBe(57)
    expect(result.pagination.current).toBe(2)
    app.unmount()
  })

  it('响应页码超出总页数时被夹到最大页', async () => {
    // total=15、size=10 → 最大 2 页，后端回 9 应被夹到 2，避免请求空页
    apiFn.mockResolvedValue(page(rows(5), 15, 9, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(5))
    expect(result.pagination.current).toBe(2)
    app.unmount()
  })

  it('getData（搜索）重置页码到第一页', async () => {
    apiFn.mockResolvedValue(page(rows(2), 30, 3, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))

    apiFn.mockResolvedValue(page(rows(2), 30, 1, 10))
    await result.getData({ keyword: 'x' } as never)
    expect(apiFn.mock.calls.at(-1)?.[0]).toMatchObject({ pageNum: 1, keyword: 'x' })
    app.unmount()
  })

  it('refreshCreate 回首页', async () => {
    apiFn.mockResolvedValue(page(rows(2), 30, 3, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))

    apiFn.mockResolvedValue(page(rows(2), 30, 1, 10))
    await result.refreshCreate()
    expect(apiFn.mock.calls.at(-1)?.[0]).toMatchObject({ pageNum: 1 })
    app.unmount()
  })

  it('refreshUpdate 保持当前页', async () => {
    apiFn.mockResolvedValue(page(rows(2), 30, 3, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))

    await result.refreshUpdate()
    expect(apiFn.mock.calls.at(-1)?.[0]).toMatchObject({ pageNum: 3 })
    app.unmount()
  })

  it('refreshRemove：当前页删空且非首页时自动回退上一页', async () => {
    apiFn.mockResolvedValue(page(rows(1), 21, 3, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))

    // 删掉第 3 页最后一条 → 该页为空 → 应再请求一次第 2 页
    apiFn.mockReset()
    apiFn
      .mockResolvedValueOnce(page([], 20, 3, 10))
      .mockResolvedValueOnce(page(rows(10), 20, 2, 10))

    await result.refreshRemove()
    expect(apiFn).toHaveBeenCalledTimes(2)
    expect(apiFn.mock.calls[1][0]).toMatchObject({ pageNum: 2 })
    expect(result.data.value).toHaveLength(10)
    app.unmount()
  })

  it('refreshRemove：首页删空不回退（页码不为 0）', async () => {
    apiFn.mockResolvedValue(page(rows(1), 1, 1, 10))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(1))

    apiFn.mockReset()
    apiFn.mockResolvedValue(page([], 0, 1, 10))
    await result.refreshRemove()
    expect(apiFn).toHaveBeenCalledTimes(1)
    expect(result.pagination.current).toBe(1)
    app.unmount()
  })

  it('请求失败：data 清空、error 置位并触发 onError', async () => {
    const onError = vi.fn()
    apiFn.mockRejectedValue(new Error('500'))
    const { result, app } = setup({ hooks: { onError } })

    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    expect(result.data.value).toEqual([])
    expect(result.error.value).not.toBeNull()
    expect(result.loading.value).toBe(false)
    app.unmount()
  })

  it('失败后重试成功可恢复数据', async () => {
    apiFn.mockRejectedValueOnce(new Error('500'))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.error.value).not.toBeNull())

    apiFn.mockResolvedValue(page(rows(2), 2))
    await result.refreshData()
    expect(result.data.value).toHaveLength(2)
    app.unmount()
  })

  it('空响应与 null 响应不炸，数据为空', async () => {
    apiFn.mockResolvedValue(null)
    const { result, app } = setup()
    await vi.waitFor(() => expect(apiFn).toHaveBeenCalled())
    expect(result.data.value).toEqual([])
    expect(result.isEmpty.value).toBe(true)
    app.unmount()
  })

  it('纯数组响应按数组长度算总数', async () => {
    apiFn.mockResolvedValue(rows(3))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(3))
    expect(result.pagination.total).toBe(3)
    app.unmount()
  })

  it('dataTransformer 对返回行做二次加工', async () => {
    const { result, app } = setup({
      transform: {
        dataTransformer: (list: Array<{ name: string }>) =>
          list.map((r) => ({ ...r, name: r.name.toUpperCase() }))
      }
    })
    await vi.waitFor(() => expect(result.data.value).toHaveLength(2))
    expect((result.data.value[0] as { name: string }).name).toBe('R1')
    app.unmount()
  })

  it('resetSearchParams 清掉业务条件但保留分页字段', async () => {
    const { result, app } = setup()
    await vi.waitFor(() => expect(apiFn).toHaveBeenCalled())

    await result.getData({ keyword: 'abc' } as never)
    await result.resetSearchParams()
    const params = apiFn.mock.calls.at(-1)?.[0]
    expect(params.keyword ?? '').toBe('')
    expect(params).toMatchObject({ pageNum: 1, pageSize: 10 })
    app.unmount()
  })
})
