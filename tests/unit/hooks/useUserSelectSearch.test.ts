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
})
