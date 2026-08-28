import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))

const { useCrud } = await import('@/hooks/core/useCrud')
const { withSetup } = await import('../helpers/withSetup')

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn().mockResolvedValue('confirm') }
}))

/** 后端 mybatis-flex 分页体：按请求页号切片，贴近参数管理页真实数据量（22 条 / 20 条每页） */
const backend = (pageNum: number, pageSize: number, total = 22) => {
  const start = (pageNum - 1) * pageSize
  const records = Array.from(
    { length: Math.max(0, Math.min(pageSize, total - start)) },
    (_, i) => ({
      id: start + i + 1,
      name: `param${start + i + 1}`
    })
  )
  return { records, totalRow: total, pageNumber: pageNum, pageSize }
}

describe('翻页后页码保持（参数管理页回归）', () => {
  let listApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    listApi = vi.fn((params: Record<string, number>) =>
      Promise.resolve(backend(params.pageNum, params.pageSize))
    )
  })

  it('handleCurrentChange(2) 后停在第 2 页并加载第 2 页数据', async () => {
    const { result, app } = withSetup(() => useCrud({ listApi } as never))
    await vi.waitFor(() => expect(result.data.value).toHaveLength(20))

    await result.handleCurrentChange(2)

    expect(listApi.mock.calls.at(-1)?.[0]).toMatchObject({ pageNum: 2 })
    expect(result.pagination.current).toBe(2)
    expect(result.data.value).toHaveLength(2)
    app.unmount()
  })

  it('连续两次点“下一页”能到第 3 页', async () => {
    listApi = vi.fn((params: Record<string, number>) =>
      Promise.resolve(backend(params.pageNum, params.pageSize, 55))
    )
    const { result, app } = withSetup(() => useCrud({ listApi } as never))
    await vi.waitFor(() => expect(result.data.value).toHaveLength(20))

    await result.handleCurrentChange(2)
    await result.handleCurrentChange(3)

    expect(result.pagination.current).toBe(3)
    expect(result.data.value).toHaveLength(15)
    app.unmount()
  })

  it('翻页后立即触发的重复同页调用被忽略，不会把页码打回第 1 页', async () => {
    const { result, app } = withSetup(() => useCrud({ listApi } as never))
    await vi.waitFor(() => expect(result.data.value).toHaveLength(20))
    listApi.mockClear()

    await Promise.all([result.handleCurrentChange(2), result.handleCurrentChange(2)])

    expect(listApi).toHaveBeenCalledTimes(1)
    expect(result.pagination.current).toBe(2)
    app.unmount()
  })
})
