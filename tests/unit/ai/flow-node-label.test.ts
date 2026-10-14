import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  displayLabel,
  LEGACY_DEFAULT_LABELS,
  NODE_LABEL_KEYS,
  storedLabel
} from '../../../modules/ai/views/app/flowNodes'

const tOf = (pack: any) => (key: string) => key.split('.').reduce((o, k) => o?.[k], pack)
const tZh = tOf(zh)
const tEn = tOf(en)

describe('应用编排节点名的存储与显示', () => {
  it('没改过名的节点不存 label', () => {
    expect(storedLabel('llm', '')).toBe('')
    expect(storedLabel('llm', undefined)).toBe('')
    expect(storedLabel('llm', '   ')).toBe('')
  })

  it('旧流程里的默认中文名视为没改过名', () => {
    for (const [type, label] of Object.entries(LEGACY_DEFAULT_LABELS)) {
      expect(storedLabel(type, label)).toBe('')
    }
  })

  it('用户改过的名字原样保存和显示，不随语言变', () => {
    expect(storedLabel('llm', '客服回答')).toBe('客服回答')
    expect(displayLabel('llm', '客服回答', tEn)).toBe('客服回答')
    expect(displayLabel('llm', '客服回答', tZh)).toBe('客服回答')
    // 别的类型的默认名不算本类型默认名
    expect(storedLabel('llm', '开始')).toBe('开始')
  })

  it('默认名按 type 实时翻译', () => {
    expect(displayLabel('start', '', tZh)).toBe('开始')
    expect(displayLabel('start', '', tEn)).toBe('Start')
    expect(displayLabel('start', '开始', tEn)).toBe('Start')
    expect(displayLabel('http', '', tEn)).toBe('HTTP')
    expect(displayLabel('unknownType', '', tEn)).toBe('unknownType')
  })

  it('每个类型的显示 key 在 zh / en 都存在，en 不含中文', () => {
    for (const [type, key] of Object.entries(NODE_LABEL_KEYS)) {
      expect(typeof tZh(key)).toBe('string')
      const e = tEn(key)
      expect(typeof e).toBe('string')
      expect(/[\u4e00-\u9fff]/.test(e)).toBe(false)
      expect(tZh(key)).toBe(LEGACY_DEFAULT_LABELS[type])
    }
  })
})
