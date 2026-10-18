import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import { withSetup } from '../helpers/withSetup'

vi.mock('@/locales', () => ({ $t: (k: string) => k }))
const httpGet = vi.fn()
vi.mock('@/utils/http', () => ({ default: { get: (...a: unknown[]) => httpGet(...a) } }))
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ accessToken: '' }) }))

import { HttpError } from '@/utils/http/error'
import { useMcpList } from '../../../modules/ai/views/mcp/useMcpList'
import { fetchAiMcpPage } from '../../../modules/ai/api'

const root = resolve(__dirname, '../../../')
const read = (f: string) => readFileSync(resolve(root, f), 'utf-8')
const get = (pack: any, key: string) => key.split('.').reduce((o, k) => o?.[k], pack)
const fill = (s: string, named?: Record<string, unknown>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(named?.[k] ?? ''))
const t = (k: string, named?: Record<string, unknown>) => fill(get(zh, k), named)
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

function setup(fetchPage: any, init: { category?: string; keyword?: string } = {}) {
  const category = ref(init.category ?? '')
  const keyword = ref(init.keyword ?? '')
  const { result, app } = withSetup(() => useMcpList({ fetchPage, category, keyword, t }))
  return { ...result, category, keyword, app }
}

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  httpGet.mockReset()
})

describe('MCP 工具列表：错误态', () => {
  it('加载失败：显示错误态和错误编号（即请求的 X-Trace-Id），不上抛，后端原文只进 console', async () => {
    const err = new HttpError('java.lang.NullPointerException at Foo.bar(Foo.java:1)', 500)
    const fetchPage = vi.fn().mockRejectedValue(err)
    const s = setup(fetchPage)
    await expect(s.reload()).resolves.toBeUndefined()

    const sentId = fetchPage.mock.calls[0][1].traceId
    expect(sentId).toMatch(HEX32)
    expect(s.loadError.value).toBe(sentId)
    expect(s.records.value).toEqual([])
    expect(s.loading.value).toBe(false)
    expect(s.loadErrorText.value).toBe(`MCP 工具列表加载失败，请稍后重试（错误编号：${sentId}）`)
    expect(s.loadErrorText.value).not.toContain('NullPointerException')
    expect(consoleError).toHaveBeenCalledWith('[AiMcp] list failed', {
      traceId: sentId,
      error: err
    })
    s.app.unmount()
  })

  it('重试：再失败时错误编号刷新；成功后清掉错误并恢复列表', async () => {
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('x', 500))
      .mockRejectedValueOnce(new HttpError('x', 502))
      .mockResolvedValueOnce({ records: [{ id: 1, name: 'A' }] })
    const s = setup(fetchPage)
    await s.reload()
    const first = s.loadError.value
    await s.reload()
    const second = s.loadError.value
    expect(first).toMatch(HEX32)
    expect(second).toMatch(HEX32)
    expect(second).not.toBe(first)

    const p = s.reload()
    expect(s.loading.value).toBe(true) // 重试按钮 :loading="loading"
    expect(s.loadError.value).toBe(second) // 重试中错误态保留，按钮转圈
    await p
    expect(s.loadError.value).toBeNull()
    expect(s.records.value).toEqual([{ id: 1, name: 'A' }])
    expect(fetchPage).toHaveBeenCalledTimes(3)
    s.app.unmount()
  })

  it('live region：每次失败只写入一次，开始加载时清空', async () => {
    const d = deferred<any>()
    const fetchPage = vi.fn().mockReturnValueOnce(d.promise).mockResolvedValueOnce({ records: [] })
    const s = setup(fetchPage)
    const p = s.reload()
    expect(s.liveText.value).toBe('')
    d.reject(new HttpError('x', 500))
    await p
    expect(s.liveText.value).toBe(s.loadErrorText.value)
    const q = s.reload()
    expect(s.liveText.value).toBe('')
    await q
    expect(s.liveText.value).toBe('')
    s.app.unmount()
  })

  it('切 tab / 搜索：旧请求的结果（成功或失败）都不会覆盖新结果', async () => {
    const slow = deferred<any>()
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ records: [{ id: 2, name: 'map' }] })
    const s = setup(fetchPage)
    const p1 = s.reload()
    s.category.value = 'map'
    await s.reload()
    slow.reject(new HttpError('x', 500))
    await p1
    expect(s.loadError.value).toBeNull()
    expect(s.records.value).toEqual([{ id: 2, name: 'map' }])
    expect(s.loading.value).toBe(false)
    expect(fetchPage.mock.calls[1][0].category).toBe('map')
    s.app.unmount()
  })

  it('请求被取消（路由切换）不算错误', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new HttpError('canceled', -1, { canceled: true }))
    const s = setup(fetchPage)
    await s.reload()
    expect(s.loadError.value).toBeNull()
    expect(s.liveText.value).toBe('')
    s.app.unmount()
  })

  it('不弹全局 toast：列表请求带 showErrorMessage:false 和 X-Trace-Id 头', async () => {
    httpGet.mockResolvedValue({ records: [] })
    await fetchAiMcpPage({ pageNum: 1 }, { traceId: 'abc' })
    expect(httpGet).toHaveBeenCalledWith({
      url: '/api/system/ai/mcp/page',
      params: { pageNum: 1 },
      showErrorMessage: false,
      headers: { 'X-Trace-Id': 'abc' }
    })
    expect(read('modules/ai/views/mcp/useMcpList.ts')).not.toMatch(/ElMessage/)
  })
})

describe('MCP 工具列表：空态', () => {
  it('没有搜索词和分类时是「暂无」，有任一筛选时是「没有符合条件」', () => {
    const fetchPage = vi.fn()
    const s = setup(fetchPage)
    expect(s.filtered.value).toBe(false)
    s.keyword.value = '   '
    expect(s.filtered.value).toBe(false)
    s.keyword.value = 'amap'
    expect(s.filtered.value).toBe(true)
    s.keyword.value = ''
    s.category.value = 'chat'
    expect(s.filtered.value).toBe(true)
    s.app.unmount()
  })

  it('空态与错误态文案按约定取值', () => {
    expect(get(zh, 'aiMcpList.empty')).toBe('暂无 MCP 工具，点击「添加 MCP 工具」开始配置。')
    expect(get(en, 'aiMcpList.empty')).toBe(
      'No MCP tools yet. Click "Add MCP tool" to get started.'
    )
    // 英文空态里引用的按钮名与按钮实际文案一致
    expect(get(en, 'aiMcpList.empty')).toContain(`"${get(en, 'aiMcpList.add')}"`)
    expect(get(zh, 'aiMcpList.empty')).toContain(`「${get(zh, 'aiMcpList.add')}」`)
    expect(get(zh, 'aiMcpList.emptySearched')).toBe('没有符合条件的 MCP 工具')
    expect(get(en, 'aiMcpList.emptySearched')).toBe('No MCP tools match your search.')
    expect(get(zh, 'aiMcpList.loadFailed')).toBe(
      'MCP 工具列表加载失败，请稍后重试（错误编号：{id}）'
    )
    expect(get(en, 'aiMcpList.loadFailed')).toBe(
      'Failed to load MCP tools. Try again later (Error ID: {id}).'
    )
    expect(get(zh, 'aiMcpList.retry')).toBe('重试')
    expect(get(en, 'aiMcpList.retry')).toBe('Retry')
  })
})

describe('MCP 页模板', () => {
  const src = read('modules/ai/views/mcp/index.vue')

  it('错误态：只有一个 polite live region，不用 role=alert，重试按钮绑定 loading', () => {
    expect(src.match(/aria-live="polite"/g)).toHaveLength(1)
    expect(src).not.toMatch(/role="alert"/)
    expect(src).toMatch(/<ElEmpty v-if="loadError"/)
    expect(src).toMatch(/<ElButton :loading="loading" data-test="mcp-retry" @click="reload">/)
    // 添加按钮不受加载 / 错误状态影响
    expect(src).toMatch(/<ElButton type="primary" @click="openEdit\(\)">/)
  })

  it('锁定卡片：状态标签用「已锁定」，隐藏编辑和删除，保留调试、设为默认、解锁，并显示说明', () => {
    expect(src).toMatch(/\$t\('aiMcpList\.locked'\)/)
    expect(src).toMatch(/v-if="row\.lockFlag !== 1" link type="primary" @click="openEdit\(row\)"/)
    expect(src).toMatch(/v-if="row\.lockFlag !== 1" link type="danger" @click="remove\(row\)"/)
    expect(src).toMatch(/<ElButton link @click="debug\(row\)">/)
    expect(src).toMatch(/<ElButton link @click="setDefault\(row\)">/)
    expect(src).toMatch(/<ElButton link @click="toggleLock\(row\)">/)
    expect(src).toMatch(/v-if="row\.lockFlag === 1" class="locked-hint"/)
    expect(get(zh, 'aiMcpList.locked')).toBe('已锁定')
    expect(get(en, 'aiMcpList.locked')).toBe('Locked')
    // 操作按钮「锁定」仍用原 key，不受标签改名影响
    expect(get(zh, 'aiMcpList.lock')).toBe('锁定')
    expect(get(en, 'aiMcpList.lock')).toBe('Lock')
    expect(get(zh, 'aiMcpList.lockedHint')).toBe('已锁定，解锁后可编辑或删除')
    expect(get(en, 'aiMcpList.lockedHint')).toBe('Locked. Unlock to edit or delete.')
  })
})

describe('MCP 卡片：工具数', () => {
  it('toolCount 优先；未知（null / undefined / 负数 / NaN / 空串）时退回 toolsJson；0 是已知值', async () => {
    const { toolCountOf } = await import('../../../modules/ai/views/mcp/mcpCard')
    expect(toolCountOf({ toolCount: 12 })).toBe(12)
    expect(toolCountOf({ toolCount: 0 })).toBe(0)
    expect(toolCountOf({ toolCount: '3' })).toBe(3)
    expect(toolCountOf({ toolCount: null })).toBeNull()
    expect(toolCountOf({})).toBeNull()
    expect(toolCountOf({ toolCount: -1 })).toBeNull()
    expect(toolCountOf({ toolCount: 'abc' })).toBeNull()
    expect(toolCountOf({ toolCount: '' })).toBeNull()
    expect(toolCountOf({ toolCount: -1, toolsJson: '[{"name":"a"},{"name":"b"}]' })).toBe(2)
    expect(toolCountOf({ toolsJson: '[]' })).toBe(0)
    expect(toolCountOf({ toolsJson: [{ name: 'a' }] })).toBe(1)
    expect(toolCountOf({ toolsJson: 'not json' })).toBeNull()
    expect(toolCountOf({ toolsJson: '{"a":1}' })).toBeNull()
    expect(toolCountOf({ toolsJson: '  ' })).toBeNull()
  })

  it('说明行：未知时不显示工具数和分隔点；描述也空时整行为空', async () => {
    const { cardMetaOf } = await import('../../../modules/ai/views/mcp/mcpCard')
    const tEn = (k: string, named?: Record<string, unknown>) => fill(get(en, k), named)
    expect(cardMetaOf({ toolCount: 12, description: '地理编码' }, t)).toBe('工具数 12 · 地理编码')
    expect(cardMetaOf({ toolCount: 0, description: '地理编码' }, t)).toBe('工具数 0 · 地理编码')
    expect(cardMetaOf({ toolCount: null, description: '地理编码' }, t)).toBe('地理编码')
    expect(cardMetaOf({ toolCount: null, description: 'Geocoding' }, tEn)).toBe('Geocoding')
    expect(cardMetaOf({ toolCount: 5, description: '  ' }, t)).toBe('工具数 5')
    expect(cardMetaOf({ toolCount: null, description: '' }, t)).toBe('')
    expect(cardMetaOf({ toolCount: undefined, description: null }, tEn)).toBe('')
    const src = read('modules/ai/views/mcp/index.vue')
    expect(src).toMatch(/<div v-if="cardMetaOf\(row, t\)" class="meta"/)
    expect(src).not.toMatch(/toolCount\(row\)/)
  })
})

describe('MCP 添加 / 编辑弹窗', () => {
  it('必填提示用这个弹窗专用的 key，英文是完整句子；共用模板不变', async () => {
    const { mcpRequired } = await import('../../../modules/ai/views/mcp/mcpCard')
    const [rule] = mcpRequired('aiMcpList.requiredName') as any[]
    expect(rule).toMatchObject({ required: true, whitespace: true, trigger: 'blur' })
    expect(rule.message()).toBe('aiMcpList.requiredName') // $t 在本文件被 mock 成返回 key
    const pairs: Array<[string, string, string]> = [
      ['requiredName', '请输入协议名称', 'Enter a protocol name.'],
      ['requiredDesc', '请输入协议描述', 'Enter a protocol description.'],
      ['requiredSseUrl', '请输入 SSE 地址', 'Enter an SSE URL.'],
      ['requiredCommand', '请输入命令行', 'Enter a command.']
    ]
    for (const [k, zhText, enText] of pairs) {
      expect(get(zh, `aiMcpList.${k}`)).toBe(zhText)
      expect(get(en, `aiMcpList.${k}`)).toBe(enText)
    }
    const src = read('modules/ai/views/mcp/index.vue')
    for (const k of ['requiredName', 'requiredDesc', 'requiredSseUrl', 'requiredCommand']) {
      expect(src).toContain(`:rules="mcpRequired('aiMcpList.${k}')"`)
    }
    // 共用模板没动，其他 AI 表单不受影响
    expect(get(en, 'formRules.requiredInput')).toBe('Please enter {label}')
  })

  it('768 以下标签放到上方', () => {
    const src = read('modules/ai/views/mcp/index.vue')
    expect(src).toMatch(/:label-position="narrowForm \? 'top' : 'right'"/)
    expect(src).toMatch(/narrowForm = computed\(\(\) => viewportWidth\.value < 768\)/)
  })
})
