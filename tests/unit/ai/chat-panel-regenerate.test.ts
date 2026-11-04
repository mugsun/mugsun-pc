import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const panel = readFileSync(
  resolve(__dirname, '../../../modules/ai/views/assistant/ChatPanel.vue'),
  'utf8'
)

describe('ChatPanel regenerate 对齐抽屉', () => {
  it('失败重试复用 chatRegenerate 并调 fetchAiChatRegenerate', () => {
    expect(panel).toMatch(/pickAssistantMessageId,\s*shouldRegenerate/)
    expect(panel).toMatch(/from ['"]\.\/drawer\/chatRegenerate['"]/)
    expect(panel).toMatch(/fetchAiChatRegenerate/)
    expect(panel).toMatch(/async function retry\(/)
    expect(panel).toMatch(/async function regenerate\(/)
    expect(panel).toMatch(/shouldRegenerate\(target,\s*messageId\)/)
    expect(panel).toMatch(/await regenerate\(target,\s*messageId\)/)
  })

  it('重试不重复 push 用户提问，只清本条助手内容', () => {
    // retry 路径不应再 messages.push user
    const retryFn = panel.slice(
      panel.indexOf('async function retry('),
      panel.indexOf('async function replayMessage(')
    )
    expect(retryFn).toMatch(/target\.content = ''/)
    expect(retryFn).not.toMatch(/messages\.value\.push\(\s*\{\s*uid:.*role:\s*['"]user['"]/)
    expect(retryFn).toMatch(/await stream\(target\)/)
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
})
