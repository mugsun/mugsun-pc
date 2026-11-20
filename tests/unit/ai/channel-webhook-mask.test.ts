import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import { toChannelForm } from '../../../modules/ai/views/channel/channelForm'

const view = readFileSync(
  resolve(__dirname, '../../../modules/ai/views/channel/index.vue'),
  'utf-8'
)

const MASKED = 'https://qyapi.weixin.qq.com/****5aaa'

describe('渠道的 Webhook 地址：列表给的是打码后的，编辑时不放进输入框', () => {
  it('编辑：输入框留空，打码后的地址只留给提示用', () => {
    const row = { id: '7', name: '发布通知群', channelType: 'wecom', webhookUrl: MASKED, status: 1 }
    expect(toChannelForm(row)).toEqual({ ...row, webhookUrl: '', savedWebhook: MASKED })
  })

  it('编辑还没填过地址的渠道：没有「已保存的地址」', () => {
    const form = toChannelForm({ id: '8', name: '新群', channelType: 'feishu', webhookUrl: '' })
    expect(form.webhookUrl).toBe('')
    expect(form.savedWebhook).toBe('')
  })

  it('新增：默认 Webhook 类型、启用', () => {
    expect(toChannelForm()).toEqual({ channelType: 'webhook', status: 1 })
  })

  it('页面用这个转换打开编辑窗；有已保存的地址时换占位文字，并在输入框下面显示打码后的地址', () => {
    expect(view).toContain('Object.assign(form, toChannelForm(row))')
    expect(view).toContain(
      "form.savedWebhook ? $t('aiForm.phWebhookKeep') : $t('aiForm.phWebhook')"
    )
    expect(view).toContain("$t('aiForm.phWebhookSaved', { addr: form.savedWebhook })")
    // 保存时原样提交输入框里的内容：留空就是不改
    expect(view).toContain("paramsSample: form.webhookUrl || ''")
  })

  it('两种语言的文案', () => {
    expect(zh.aiForm.phWebhookKeep).toBe('留空表示不修改；要换就填完整的新地址')
    expect(en.aiForm.phWebhookKeep).toBe('Leave blank to keep the saved address')
    expect(zh.aiForm.phWebhookSaved).toBe('已保存的地址：{addr}（中间部分不显示）')
    expect(en.aiForm.phWebhookSaved).toBe('Saved address: {addr} (middle part hidden)')
  })
})
