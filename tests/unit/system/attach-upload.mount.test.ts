import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus, { ElMessage } from 'element-plus'
import zh from '@/locales/langs/zh.json'

/**
 * 接线测试：真实挂载附件管理页，只 mock 接口、表格数据和发往存储的 PUT 请求。
 * 选中文件后先申请直传，申请时要带文件大小：后端把它绑进签名，没带会直接拒绝，
 * 本地存储也一样。当前存储不支持直传就改走普通上传；支持就 PUT 到存储，再凭 ticket 登记。
 */
const fetchPresignedPut = vi.fn()
const fetchUploadFile = vi.fn()
const fetchCreateAttach = vi.fn()
const refreshData = vi.fn()
vi.mock('@/locales', () => ({ $t: (k: string) => k }))
vi.mock('@/api/system-manage', () => ({
  fetchPresignedPut: (...a: unknown[]) => fetchPresignedPut(...a),
  fetchUploadFile: (...a: unknown[]) => fetchUploadFile(...a),
  fetchCreateAttach: (...a: unknown[]) => fetchCreateAttach(...a),
  fetchRemoveAttach: () => Promise.resolve()
}))
vi.mock('@/api/attach', () => ({ fetchAttachPage: () => Promise.resolve({ records: [] }) }))
vi.mock('@/utils/http', () => ({
  default: { request: () => Promise.resolve(), download: () => Promise.resolve() }
}))
vi.mock('@/hooks/core/useTable', async () => {
  const { ref } = await import('vue')
  return {
    useTable: () => ({
      columns: ref([]),
      columnChecks: ref([]),
      data: ref([]),
      loading: ref(false),
      pagination: ref({ current: 1, size: 20, total: 0 }),
      handleSizeChange: () => {},
      handleCurrentChange: () => {},
      refreshData: (...a: unknown[]) => refreshData(...a),
      fetchData: () => Promise.resolve(),
      replaceSearchParams: () => {},
      resetSearchParams: () => {}
    })
  }
})
vi.mock('@/components/core/forms/art-search-bar/index.vue', () => ({
  default: { inheritAttrs: false, render: () => null }
}))
vi.mock('@/views/system/attach/row-actions', () => ({ renderAttachRowActions: () => null }))

import AttachPage from '@/views/system/attach/index.vue'

/** 顶替浏览器的 XMLHttpRequest：记下页面发往存储的请求，按 nextStatus 应答 */
class FakeXhr {
  static sent: FakeXhr[] = []
  static nextStatus = 200
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown = null
  status = 0
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value
  }

  send(body: unknown) {
    this.body = body
    this.status = FakeXhr.nextStatus
    FakeXhr.sent.push(this)
    queueMicrotask(() => this.onload?.())
  }
}

/** 表头只需要把左侧插槽画出来：上传按钮和文件选择框在里面 */
const TableHeaderStub = defineComponent({
  inheritAttrs: false,
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.left?.())
})
const EmptyStub = defineComponent({ inheritAttrs: false, render: () => null })

const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve()
    await nextTick()
  }
}

let app: App | null = null

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  app = createApp(AttachPage)
  app.use(ElementPlus).use(createI18n({ legacy: false, locale: 'zh', messages: { zh } }))
  app.component('ArtTableHeader', TableHeaderStub)
  app.component('ArtTable', EmptyStub)
  app.directive('ripple', {})
  app.directive('perm', {})
  app.mount(host)
}

/** 模拟在文件选择框里选中一个文件 */
async function choose(file: File) {
  const input = document.body.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change'))
  await flush()
}

const png = () => new File(['abc'], 'a.png', { type: 'image/png' })

beforeEach(() => {
  FakeXhr.sent = []
  FakeXhr.nextStatus = 200
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})
afterEach(() => {
  ElMessage.closeAll()
  app?.unmount()
  app = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('附件管理：上传附件', () => {
  it('申请上传时带上文件大小；存储不支持直传就改走普通上传', async () => {
    fetchPresignedPut.mockResolvedValue({ supported: false })
    fetchUploadFile.mockResolvedValue({ id: '1' })
    mount()
    await flush()
    const file = png()
    await choose(file)

    expect(fetchPresignedPut).toHaveBeenCalledWith({
      filename: 'a.png',
      size: 3,
      access: 'private'
    })
    expect(fetchUploadFile).toHaveBeenCalledWith(file)
    expect(fetchCreateAttach).not.toHaveBeenCalled()
    expect(FakeXhr.sent).toHaveLength(0)
    expect(document.body.textContent).toContain('上传成功')
    expect(refreshData).toHaveBeenCalledTimes(1)
  })

  it('存储支持直传：按签发的地址和请求头 PUT 文件，再凭 ticket 登记', async () => {
    fetchPresignedPut.mockResolvedValue({
      supported: true,
      uploadUrl: 'https://oss.example.com/staging/9f.png?sig=1',
      headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment' },
      ticket: 't-1'
    })
    fetchCreateAttach.mockResolvedValue({ id: '2' })
    mount()
    await flush()
    const file = png()
    await choose(file)

    expect(fetchPresignedPut).toHaveBeenCalledWith({
      filename: 'a.png',
      size: 3,
      access: 'private'
    })
    expect(FakeXhr.sent).toHaveLength(1)
    const put = FakeXhr.sent[0]
    expect(put.method).toBe('PUT')
    expect(put.url).toBe('https://oss.example.com/staging/9f.png?sig=1')
    expect(put.headers).toEqual({
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment'
    })
    expect(put.body).toBe(file)
    expect(fetchCreateAttach).toHaveBeenCalledWith({ ticket: 't-1', size: 3 })
    expect(fetchUploadFile).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('上传成功')
    expect(refreshData).toHaveBeenCalledTimes(1)
  })

  it('存储拒绝了直传：提示去检查存储配置，不登记，也不改走普通上传', async () => {
    FakeXhr.nextStatus = 403
    fetchPresignedPut.mockResolvedValue({
      supported: true,
      uploadUrl: 'https://oss.example.com/staging/9f.png?sig=1',
      headers: {},
      ticket: 't-2'
    })
    mount()
    await flush()
    await choose(png())

    expect(FakeXhr.sent).toHaveLength(1)
    expect(fetchCreateAttach).not.toHaveBeenCalled()
    expect(fetchUploadFile).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('文件没有传到存储')
    expect(document.body.textContent).not.toContain('上传成功')
    expect(refreshData).not.toHaveBeenCalled()
  })

  it('空文件：不申请上传，提示换一个有内容的文件', async () => {
    mount()
    await flush()
    await choose(new File([], 'empty.txt', { type: 'text/plain' }))

    expect(fetchPresignedPut).not.toHaveBeenCalled()
    expect(fetchUploadFile).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('这个文件是空的')
  })
})
