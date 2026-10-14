import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import { analyzeQuestion, predictQuestion } from '../../../modules/ai/views/dataset/askText'
import {
  displaySessionTitle,
  newSessionTitle
} from '../../../modules/ai/views/assistant/sessionTitle'

// AI 页面 i18n 第 4 批：路由标题、api 错误文案、ChatPanel、dataset/run
const FILES = [
  'modules/ai/routes.ts',
  'modules/ai/api.ts',
  'modules/ai/views/assistant/ChatPanel.vue',
  'modules/ai/views/dataset/run.vue'
]
const CJK = /[\u4e00-\u9fff]/
const KEY_RES = [/(?<![\w.])\$?t\(\s*'([\w.]+)'/g, /title: '(menus\.ai\.\w+)'/g]

function lookup(pack: any, key: string): unknown {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), pack)
}

function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
}

const tOf =
  (pack: any) =>
  (key: string, params: Record<string, unknown> = {}) =>
    String(lookup(pack, key)).replace(/\{(\w+)\}/g, (_, k) => String(params[k]))

describe('AI 页面 i18n 第 4 批', () => {
  for (const file of FILES) {
    const src = readFileSync(resolve(__dirname, '../../../', file), 'utf-8')
    const keys = [...new Set(KEY_RES.flatMap((re) => [...src.matchAll(re)].map((m) => m[1])))]

    it(`${file}：用到了 i18n key`, () => {
      expect(keys.length).toBeGreaterThan(0)
    })

    it(`${file}：key 在 zh 和 en 里都存在`, () => {
      const missing = keys.filter(
        (k) => typeof lookup(zh, k) !== 'string' || typeof lookup(en, k) !== 'string'
      )
      expect(missing).toEqual([])
    })

    it(`${file}：en 词条不含中文`, () => {
      expect(keys.filter((k) => CJK.test(String(lookup(en, k))))).toEqual([])
    })

    it(`${file}：代码（去掉注释）不含中文硬编码`, () => {
      expect(
        stripComments(src)
          .split('\n')
          .filter((l) => CJK.test(l))
      ).toEqual([])
    })
  }

  it('侧栏「AI 中心」等菜单词条中英都有', () => {
    expect((zh as any).menus.ai.title).toBe('AI 中心')
    expect((en as any).menus.ai.title).toBe('AI Center')
  })
})

describe('发给后端的内容不跟界面语言变', () => {
  it('新会话标题固定中文，显示时按语言翻译', () => {
    expect(newSessionTitle(3)).toBe('新对话 3')
    expect(displaySessionTitle(newSessionTitle(3), tOf(en))).toBe('New chat 3')
    expect(displaySessionTitle(newSessionTitle(3), tOf(zh))).toBe('新对话 3')
    expect(displaySessionTitle('季度复盘', tOf(en))).toBe('季度复盘')
    expect(displaySessionTitle('', tOf(en))).toBe('New chat')
  })

  it('数据分析 / 预测的问题固定中文', () => {
    expect(analyzeQuestion('select 1')).toBe('基于 SQL 分析：select 1')
    expect(predictQuestion('select 1')).toBe('基于 SQL 预测：select 1')
  })
})
