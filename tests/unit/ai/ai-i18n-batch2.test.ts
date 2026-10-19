import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

// AI 页面 i18n 第 2 批：扫描本批组件里用到的 i18n key，确认中英文都有，且英文词条与界面代码不含中文
const FILES = [
  'modules/ai/views/app/design.vue',
  'modules/ai/views/gen/GenLayout.vue',
  'modules/ai/views/gen/article.vue',
  'modules/ai/views/gen/layout.vue',
  'modules/ai/views/gen/marketing.vue',
  'modules/ai/views/gen/mindmap.vue',
  'modules/ai/views/gen/poster.vue',
  'modules/ai/views/gen/product.vue',
  'modules/ai/views/gen/svg.vue',
  'modules/ai/views/knowledge/detail.vue'
]
const CJK = /[\u4e00-\u9fff]/
const KEY_RE = /(?<![\w.])\$?t\(\s*'([\w.]+)'/g

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

describe('AI 页面 i18n 第 2 批', () => {
  for (const file of FILES) {
    const src = readFileSync(resolve(__dirname, '../../../', file), 'utf-8')
    const keys = [...new Set([...src.matchAll(KEY_RE)].map((m) => m[1]))]

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
      const leaked = keys.filter((k) => CJK.test(String(lookup(en, k))))
      expect(leaked).toEqual([])
    })

    it(`${file}：界面代码（去掉注释）不含中文硬编码`, () => {
      const lines = stripComments(src)
        .split('\n')
        .filter((l) => CJK.test(l))
      expect(lines).toEqual([])
    })
  }
})
