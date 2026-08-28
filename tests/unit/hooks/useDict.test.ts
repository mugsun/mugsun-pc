import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchDictBatch = vi.fn()
vi.mock('@/api/dict', () => ({ fetchDictBatch: (codes: string[]) => fetchDictBatch(codes) }))

const { useDict } = await import('@/hooks/core/useDict')
const { useDictStore } = await import('@/store/modules/dict')

const items = (...values: string[]) =>
  values.map((v) => ({ dictKey: v, dictValue: `${v}-标签` }) as never)

describe('useDict / dictStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchDictBatch.mockReset()
  })

  it('首次取字典触发批量拉取，加载后 computed 响应式回填', async () => {
    fetchDictBatch.mockResolvedValue({ user_status: items('0', '1') })
    const { user_status } = useDict('user_status')

    expect(fetchDictBatch).toHaveBeenCalledWith(['user_status'])
    expect(user_status.value).toEqual([])

    await vi.waitFor(() => expect(user_status.value).toHaveLength(2))
    expect(user_status.value[0].dictValue).toBe('0-标签')
  })

  it('同码并发只发一次请求（在途去重）', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    fetchDictBatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        })
    )

    useDict('user_status')
    useDict('user_status')
    useDict('user_status')
    expect(fetchDictBatch).toHaveBeenCalledTimes(1)

    resolveFn({ user_status: items('0') })
    await vi.waitFor(() => expect(useDictStore().getItems('user_status')).toHaveLength(1))
  })

  it('缓存命中后不再重复请求', async () => {
    fetchDictBatch.mockResolvedValue({ sex: items('1', '2') })
    useDict('sex')
    await vi.waitFor(() => expect(useDictStore().getItems('sex')).toHaveLength(2))

    useDict('sex')
    expect(fetchDictBatch).toHaveBeenCalledTimes(1)
  })

  it('多码一次批量请求，未返回的码回填空数组', async () => {
    fetchDictBatch.mockResolvedValue({ a: items('1') })
    const { a, b } = useDict('a', 'b')

    expect(fetchDictBatch).toHaveBeenCalledWith(['a', 'b'])
    await vi.waitFor(() => expect(a.value).toHaveLength(1))
    expect(b.value).toEqual([])
  })

  it('请求失败不写负缓存，后续 ensure 可重取', async () => {
    fetchDictBatch.mockRejectedValueOnce(new Error('boom'))
    const store = useDictStore()
    store.ensure(['sex'])
    expect(fetchDictBatch).toHaveBeenCalledTimes(1)

    // 等 catch/finally 落定：在途窗口内的重试会被去重挡掉（这是期望行为），须等在途登记清理后再重试
    await new Promise((resolve) => setTimeout(resolve, 0))
    // 失败后 key 应缺席（不写空数组占位），否则页面永远拿不到字典
    expect('sex' in store.dictData).toBe(false)

    fetchDictBatch.mockResolvedValue({ sex: items('1') })
    store.ensure(['sex'])
    await vi.waitFor(() => expect(store.getItems('sex')).toHaveLength(1))
    expect(fetchDictBatch).toHaveBeenCalledTimes(2)
  })

  it('getLabel 未命中原样返回值，命中返回标签', async () => {
    fetchDictBatch.mockResolvedValue({ sex: items('1') })
    const store = useDictStore()
    store.ensure(['sex'])
    await vi.waitFor(() => expect(store.getItems('sex')).toHaveLength(1))

    expect(store.getLabel('sex', 1)).toBe('1-标签')
    expect(store.getLabel('sex', 9)).toBe('9')
    expect(store.getLabel('sex', null)).toBe('')
  })

  it('evict 清缓存，reload 立即重取', async () => {
    fetchDictBatch.mockResolvedValue({ sex: items('1') })
    const store = useDictStore()
    store.ensure(['sex'])
    await vi.waitFor(() => expect(store.getItems('sex')).toHaveLength(1))

    store.evict('sex')
    expect(store.getItems('sex')).toEqual([])

    fetchDictBatch.mockResolvedValue({ sex: items('1', '2') })
    store.reload('sex')
    await vi.waitFor(() => expect(store.getItems('sex')).toHaveLength(2))
  })
})
