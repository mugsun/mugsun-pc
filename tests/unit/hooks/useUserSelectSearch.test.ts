import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchUserSelect = vi.fn()
vi.mock('@/api/message', () => ({
  fetchUserSelect: (params?: Record<string, unknown>) => fetchUserSelect(params)
}))

const { useUserSelectSearch } = await import('@/hooks/core/useUserSelectSearch')
const { withSetup } = await import('../helpers/withSetup')

const opt = (value: number, label: string) => ({ value, label })

describe('useUserSelectSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchUserSelect.mockReset()
    fetchUserSelect.mockResolvedValue([opt(1, 'admin')])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('挂载即拉默认列表（无参）', async () => {
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(fetchUserSelect).toHaveBeenCalledWith(undefined))
    await vi.waitFor(() => expect(result.userOptions.value).toHaveLength(1))
    app.unmount()
  })

  it('关键字防抖 300ms，连续输入只发最后一次', async () => {
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(fetchUserSelect).toHaveBeenCalledTimes(1))
    fetchUserSelect.mockClear()

    result.searchUsers('a')
    result.searchUsers('ad')
    result.searchUsers('adm')
    expect(fetchUserSelect).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(fetchUserSelect).toHaveBeenCalledTimes(1)
    expect(fetchUserSelect).toHaveBeenCalledWith({ keyword: 'adm' })
    app.unmount()
  })

  it('空串与纯空格回默认列表（不带 keyword）', async () => {
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(fetchUserSelect).toHaveBeenCalledTimes(1))
    fetchUserSelect.mockClear()

    result.searchUsers('   ')
    await vi.advanceTimersByTimeAsync(300)
    expect(fetchUserSelect).toHaveBeenCalledWith(undefined)
    app.unmount()
  })

  it('已选项在搜索结果刷新后仍保留（防标签退化为裸 id）', async () => {
    fetchUserSelect.mockResolvedValueOnce([opt(1, 'admin'), opt(2, 'fronttest')])
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(result.userOptions.value).toHaveLength(2))

    result.syncSelected(2)

    // 搜索命中另一批用户，已选的 2 不在结果里
    fetchUserSelect.mockResolvedValueOnce([opt(3, 'zhang')])
    result.searchUsers('zhang')
    await vi.advanceTimersByTimeAsync(300)

    await vi.waitFor(() => {
      const values = result.userOptions.value.map((o) => o.value)
      expect(values).toContain(2)
      expect(values).toContain(3)
    })
    expect(result.userOptions.value.find((o) => o.value === 2)?.label).toBe('fronttest')
    app.unmount()
  })

  it('ensureUsers 只补拉缺失 id，已缓存不再请求', async () => {
    fetchUserSelect.mockResolvedValueOnce([opt(1, 'admin')])
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(result.userOptions.value).toHaveLength(1))
    fetchUserSelect.mockClear()

    fetchUserSelect.mockResolvedValueOnce([opt(7, 'li'), opt(8, 'wang')])
    await result.ensureUsers([1, 7, 8])
    expect(fetchUserSelect).toHaveBeenCalledWith({ ids: '7,8' })

    fetchUserSelect.mockClear()
    await result.ensureUsers([1, 7])
    expect(fetchUserSelect).not.toHaveBeenCalled()
    app.unmount()
  })

  it('接口返回空值不炸（兜底空数组）', async () => {
    fetchUserSelect.mockResolvedValue(null)
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(fetchUserSelect).toHaveBeenCalled())
    expect(result.userOptions.value).toEqual([])
    app.unmount()
  })

  it('搜索期间 userSearching 置位，结束复位', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    fetchUserSelect.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        })
    )
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(result.userSearching.value).toBe(true))

    resolveFn([opt(1, 'admin')])
    await vi.waitFor(() => expect(result.userSearching.value).toBe(false))
    app.unmount()
  })

  it('默认接口失败：原因进 userLoadError，不留下没人处理的错误', async () => {
    fetchUserSelect.mockRejectedValue(new Error('没有访问权限'))
    const { result, app } = withSetup(() => useUserSelectSearch())
    await vi.waitFor(() => expect(result.userLoadError.value).toBe('没有访问权限'))
    expect(result.userSearching.value).toBe(false)
    expect(result.userOptions.value).toEqual([])
    app.unmount()
  })

  it('immediate: false 时挂载不请求，loadUsers 才用换上的接口取默认列表', async () => {
    const fetcher = vi.fn().mockResolvedValue([opt(5, 'li')])
    const { result, app } = withSetup(() => useUserSelectSearch({ immediate: false, fetcher }))
    await vi.advanceTimersByTimeAsync(500)
    expect(fetcher).not.toHaveBeenCalled()
    expect(fetchUserSelect).not.toHaveBeenCalled()

    await result.loadUsers()
    expect(fetcher).toHaveBeenCalledWith(undefined)
    expect(fetchUserSelect).not.toHaveBeenCalled()
    expect(result.userOptions.value).toEqual([opt(5, 'li')])
    app.unmount()
  })

  it('换了接口以后，关键字搜索也走它', async () => {
    const fetcher = vi.fn().mockResolvedValue([opt(6, 'zhao')])
    const { result, app } = withSetup(() => useUserSelectSearch({ immediate: false, fetcher }))

    result.searchUsers(' zh ')
    await vi.advanceTimersByTimeAsync(300)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('zh')
    expect(fetchUserSelect).not.toHaveBeenCalled()
    app.unmount()
  })

  it('取候选人失败：不抛出，列表只留已选的人；再取成功后原因清空', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce([opt(1, 'admin'), opt(2, 'li')])
    const { result, app } = withSetup(() => useUserSelectSearch({ immediate: false, fetcher }))
    await result.loadUsers()
    result.syncSelected([2])

    fetcher.mockRejectedValueOnce(new Error('只有这条待办的办理人可以选人'))
    await expect(result.loadUsers()).resolves.toBeUndefined()
    expect(result.userLoadError.value).toBe('只有这条待办的办理人可以选人')
    expect(result.userOptions.value).toEqual([opt(2, 'li')])
    expect(result.userSearching.value).toBe(false)

    fetcher.mockResolvedValueOnce([opt(3, 'wang')])
    await result.loadUsers()
    expect(result.userLoadError.value).toBe('')
    expect(result.userOptions.value.map((o) => o.value)).toEqual([2, 3])
    app.unmount()
  })

  it('失败但接口没给原因时，给一句通用的说法', async () => {
    const fetcher = vi.fn().mockRejectedValue({})
    const { result, app } = withSetup(() => useUserSelectSearch({ immediate: false, fetcher }))
    await result.loadUsers()
    expect(result.userLoadError.value).toBe('候选人加载失败。请稍后重试')
    app.unmount()
  })

  it('先发的请求回来得晚，不盖掉后发的结果', async () => {
    const resolvers: Array<(v: unknown) => void> = []
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        })
    )
    const { result, app } = withSetup(() => useUserSelectSearch({ immediate: false, fetcher }))
    const first = result.loadUsers()
    const second = result.loadUsers()

    resolvers[1]([opt(2, '后发')])
    await second
    resolvers[0]([opt(1, '先发')])
    await first
    expect(result.userOptions.value).toEqual([opt(2, '后发')])
    expect(result.userSearching.value).toBe(false)
    app.unmount()
  })

  it('loadUsers 会作废还没发出去的搜索', async () => {
    const fetcher = vi.fn().mockResolvedValue([])
    const { result, app } = withSetup(() => useUserSelectSearch({ immediate: false, fetcher }))

    result.searchUsers('abc')
    await result.loadUsers()
    await vi.advanceTimersByTimeAsync(300)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(undefined)
    app.unmount()
  })
})
