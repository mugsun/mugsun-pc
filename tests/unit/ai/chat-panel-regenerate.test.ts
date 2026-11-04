import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import zh from '@/locales/langs/zh.json'
import {
  applyChatRetry,
  pickAssistantMessageId
} from '../../../modules/ai/views/assistant/drawer/chatRegenerate'

const panel = readFileSync(
  resolve(__dirname, '../../../modules/ai/views/assistant/ChatPanel.vue'),
  'utf8'
)

const get = (pack: Record<string, unknown>, key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], pack)

describe('ChatPanel regenerate 对齐抽屉', () => {
  it('失败重试复用 chatRegenerate 并调 fetchAiChatRegenerate', () => {
    expect(panel).toMatch(/pickAssistantMessageId,\s*applyChatRetry/)
    expect(panel).toMatch(/from ['"]\.\/drawer\/chatRegenerate['"]/)
    expect(panel).toMatch(/fetchAiChatRegenerate/)
    expect(panel).toMatch(/async function retry\(/)
    expect(panel).toMatch(/async function regenerate\(/)
    expect(panel).toMatch(/await applyChatRetry\(/)
  })

  it('重试不重复 push 用户提问，只清本条助手内容', () => {
    const retryFn = panel.slice(
      panel.indexOf('async function retry('),
      panel.indexOf('async function replayMessage(')
    )
    expect(retryFn).toMatch(/target\.content = ''/)
    expect(retryFn).not.toMatch(/messages\.value\.push\(\s*\{\s*uid:.*role:\s*['"]user['"]/)
    expect(retryFn).toMatch(/await applyChatRetry\(/)
  })

  it('出错展示重试按钮，文案走 aiDrawer.retry', () => {
    expect(panel).toMatch(/v-if="msg\.error"/)
    expect(panel).toMatch(/@click="retry\(msg\)"/)
    expect(panel).toMatch(/\$t\(['"]aiDrawer\.retry['"]\)/)
  })

  it('发送时记录 question，并在 onEvent 标 persisted / 捕获 messageId', () => {
    expect(panel).toMatch(/question:\s*text/)
    expect(panel).toMatch(/msg\.persisted = true/)
    expect(panel).toMatch(/parsed\?\.messageId/)
  })

  it('stream onError 只写行内 error，不叠 ElMessage.error', () => {
    const bind = panel.slice(
      panel.indexOf('function bindStreamHandlers('),
      panel.indexOf('async function stream(')
    )
    expect(bind).toMatch(/msg\.error = m/)
    expect(bind).not.toMatch(/ElMessage\.error/)
  })

  it('已入库但解析不到 messageId → onNeedRefresh（retryNeedRefresh i18n + 状态）', async () => {
    const refreshText = get(zh as Record<string, unknown>, 'aiDrawer.retryNeedRefresh')
    const genFailed = get(zh as Record<string, unknown>, 'aiChat.genFailed')
    expect(typeof refreshText).toBe('string')
    expect(String(refreshText).length).toBeGreaterThan(0)

    const target: {
      persisted: boolean
      requestId: string
      pending: boolean
      question: string
      error?: string
    } = {
      persisted: true,
      requestId: 'r-no-row',
      pending: true,
      question: '你好'
    }
    const warn = vi.fn()
    const regenerate = vi.fn()
    const stream = vi.fn()
    // 模拟 ChatPanel onNeedRefresh：清 pending、写失败、toast 刷新提示
    const onNeedRefresh = vi.fn(() => {
      target.pending = false
      target.error = String(genFailed)
      warn(String(refreshText))
    })

    const messageId = pickAssistantMessageId(target, [])
    expect(messageId).toBeNull()
    const action = await applyChatRetry(target, messageId, true, {
      regenerate,
      stream,
      onNeedRefresh
    })

    expect(action).toBe('needRefresh')
    expect(onNeedRefresh).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(refreshText)
    expect(target.pending).toBe(false)
    expect(target.error).toBe(genFailed)
    expect(regenerate).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
    // 全页仍接线到同一 i18n key
    expect(panel).toContain("t('aiDrawer.retryNeedRefresh')")
  })
})
