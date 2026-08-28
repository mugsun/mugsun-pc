import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({
  $t: (key: string, named?: Record<string, unknown>) =>
    named ? `${key}:${Object.values(named).join('/')}` : key
}))

const confirm = vi.fn()
const success = vi.fn()
vi.mock('element-plus', () => ({
  ElMessage: { success: (msg: string) => success(msg), error: vi.fn() },
  ElMessageBox: { confirm: (...args: unknown[]) => confirm(...args) }
}))

const { useCrud } = await import('@/hooks/core/useCrud')
const { withSetup } = await import('../helpers/withSetup')

const page = (records: unknown[], totalRow: number, pageNumber = 1, pageSize = 10) => ({
  records,
  totalRow,
  pageNumber,
  pageSize
})

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `r${i + 1}` }))

describe('useCrud', () => {
  let listApi: ReturnType<typeof vi.fn>
  let saveApi: ReturnType<typeof vi.fn>
  let removeApi: ReturnType<typeof vi.fn>

  beforeEach(() => {
    listApi = vi.fn().mockResolvedValue(page(rows(2), 2))
    saveApi = vi.fn().mockResolvedValue(undefined)
    removeApi = vi.fn().mockResolvedValue(undefined)
    confirm.mockReset()
    success.mockReset()
    confirm.mockResolvedValue('confirm')
  })

  const setup = (options: Record<string, unknown> = {}) =>
    withSetup(() => useCrud({ listApi, saveApi, removeApi, ...options } as never))

  it('默认适配 mybatis-flex 分页体（records/totalRow）', async () => {
    listApi.mockResolvedValue(page(rows(3), 42, 1, 20))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(3))
    expect(result.pagination.total).toBe(42)
    app.unmount()
  })

  it('默认适配纯数组响应', async () => {
    listApi.mockResolvedValue(rows(4))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.data.value).toHaveLength(4))
    expect(result.pagination.total).toBe(4)
    app.unmount()
  })

  it('自定义 responseAdapter 覆盖默认适配', async () => {
    listApi.mockResolvedValue({ list: rows(2), count: 9 })
    const { result, app } = setup({
      responseAdapter: (resp: any) => ({
        records: resp.list,
        total: resp.count,
        current: 1,
        size: 10
      })
    })
    await vi.waitFor(() => expect(result.data.value).toHaveLength(2))
    expect(result.pagination.total).toBe(9)
    app.unmount()
  })

  it('showDialog(add) 清空表单行，dialogVisible 在 nextTick 后打开', async () => {
    const { result, app } = setup()
    result.showDialog('add')
    expect(result.dialogType.value).toBe('add')
    expect(result.currentRow.value).toEqual({})
    expect(result.dialogVisible.value).toBe(false)

    await vi.waitFor(() => expect(result.dialogVisible.value).toBe(true))
    app.unmount()
  })

  it('showDialog(edit) 传入行副本，改表单不污染列表行', async () => {
    const { result, app } = setup()
    const row = { id: 1, name: 'origin' }
    result.showDialog('edit', row)

    result.currentRow.value.name = 'changed'
    expect(row.name).toBe('origin')
    expect(result.dialogType.value).toBe('edit')
    app.unmount()
  })

  it('handleDelete 确认后调 removeApi 并提示成功', async () => {
    const { result, app } = setup()
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())

    result.handleDelete({ id: 7, name: 'foo' })
    await vi.waitFor(() => expect(removeApi).toHaveBeenCalledWith(7))
    expect(success).toHaveBeenCalledWith('common.deleteSuccess')
    app.unmount()
  })

  it('handleDelete 取消确认不调 removeApi', async () => {
    confirm.mockRejectedValue('cancel')
    const { result, app } = setup()
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())

    result.handleDelete({ id: 7, name: 'foo' })
    await new Promise((r) => setTimeout(r, 0))
    expect(removeApi).not.toHaveBeenCalled()
    app.unmount()
  })

  it('删除确认文案带实体标签与行名', async () => {
    const { result, app } = setup({ label: '参数' })
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())

    result.handleDelete({ id: 7, name: '系统标题' })
    expect(confirm.mock.calls[0][0]).toContain('系统标题')
    expect(confirm.mock.calls[0][0]).toContain('参数')
    app.unmount()
  })

  it('无 name 字段时删除文案回落到主键', async () => {
    const { result, app } = setup({ idKey: 'menuId' })
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())

    result.handleDelete({ menuId: 99 })
    expect(confirm.mock.calls[0][0]).toContain('99')
    await vi.waitFor(() => expect(removeApi).toHaveBeenCalledWith(99))
    app.unmount()
  })

  it('rowName 自定义取名优先于默认字段', async () => {
    const { result, app } = setup({ rowName: (row: any) => `${row.firstName}·${row.lastName}` })
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())

    result.handleDelete({ id: 1, name: 'ignored', firstName: '张', lastName: '三' })
    expect(confirm.mock.calls[0][0]).toContain('张·三')
    app.unmount()
  })

  it('删除后走 refreshRemove：当前页删空则回退上一页', async () => {
    // useCrud 默认 pageSize=20，总数须够 3 页否则页码会被夹到最大页
    listApi.mockResolvedValue(page(rows(1), 41, 3, 20))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))

    listApi.mockReset()
    listApi
      .mockResolvedValueOnce(page([], 40, 3, 20))
      .mockResolvedValueOnce(page(rows(20), 40, 2, 20))

    result.handleDelete({ id: 1, name: 'last' })
    await vi.waitFor(() => expect(listApi).toHaveBeenCalledTimes(2))
    expect(listApi.mock.calls[1][0]).toMatchObject({ pageNum: 2 })
    app.unmount()
  })

  it('新增保存后回首页刷新', async () => {
    listApi.mockResolvedValue(page(rows(1), 100, 3, 20))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))
    listApi.mockClear()

    result.showDialog('add')
    await result.handleSubmit({ name: 'new' })

    expect(saveApi).toHaveBeenCalledWith({ name: 'new' })
    expect(result.dialogVisible.value).toBe(false)
    expect(success).toHaveBeenCalledWith('common.saveSuccess')
    expect(listApi.mock.calls.at(-1)?.[0]).toMatchObject({ pageNum: 1 })
    app.unmount()
  })

  it('编辑保存后停在当前页刷新', async () => {
    listApi.mockResolvedValue(page(rows(1), 100, 3, 20))
    const { result, app } = setup()
    await vi.waitFor(() => expect(result.pagination.current).toBe(3))
    listApi.mockClear()

    result.showDialog('edit', { id: 1, name: 'a' })
    await result.handleSubmit({ id: 1, name: 'b' })

    expect(listApi.mock.calls.at(-1)?.[0]).toMatchObject({ pageNum: 3 })
    app.unmount()
  })

  it('只读页（未传 saveApi）提交仅关弹窗，不提示保存成功', async () => {
    const { result, app } = setup({ saveApi: undefined })
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())

    await result.handleSubmit({ name: 'x' })
    expect(result.dialogVisible.value).toBe(false)
    expect(success).not.toHaveBeenCalled()
    app.unmount()
  })

  it('自定义分页字段映射透传到列表请求', async () => {
    const { app } = setup({
      apiParams: { pageNo: 1, limit: 15 },
      paginationKey: { current: 'pageNo', size: 'limit' }
    })
    await vi.waitFor(() => expect(listApi).toHaveBeenCalled())
    expect(listApi.mock.calls[0][0]).toMatchObject({ pageNo: 1, limit: 15 })
    app.unmount()
  })
})
