import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

const NS = ['aiChannelList', 'aiDatasetList', 'aiDatasourceList', 'aiShared']
const FILES = [
  'modules/ai/views/channel/index.vue',
  'modules/ai/views/dataset/index.vue',
  'modules/ai/views/datasource/index.vue',
  'modules/ai/views/shared/AiDrawerHost.vue',
  'modules/ai/views/shared/AiNotFound.vue',
  'modules/ai/views/knowledge/detail.vue'
]
const HAN = /[\u4e00-\u9fff]/
const get = (pack: any, key: string) => key.split('.').reduce((o, k) => o?.[k], pack)
const src = (f: string) => readFileSync(resolve(__dirname, '../../..', f), 'utf8')
/** 去掉注释后的代码 */
const code = (s: string) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('i18n 第 6 批：渠道/问数/数据源列表、AI 助手入口、不存在占位', () => {
  it('命名空间在 zh / en 都存在且 key 一一对应，en 不含中文', () => {
    for (const ns of NS) {
      const z = (zh as any)[ns]
      const e = (en as any)[ns]
      expect(z, ns).toBeTypeOf('object')
      expect(Object.keys(e).sort()).toEqual(Object.keys(z).sort())
      for (const [k, v] of Object.entries(e)) {
        expect(typeof v, `${ns}.${k}`).toBe('string')
        expect(HAN.test(v as string), `${ns}.${k}`).toBe(false)
      }
    }
  })

  it('页面里引用的 key 都存在', () => {
    const re = /\bt\(\s*'((?:ai[A-Za-z]+)\.[A-Za-z0-9]+)'/g
    for (const f of FILES) {
      const keys = [...src(f).matchAll(re)].map((m) => m[1])
      expect(keys.length, f).toBeGreaterThan(0)
      for (const k of keys) {
        expect(get(zh, k), `${f}: ${k}`).toBeTypeOf('string')
        expect(get(en, k), `${f}: ${k}`).toBeTypeOf('string')
      }
    }
  })

  it('页面代码里不再有写死的中文', () => {
    // knowledge/detail.vue 只改了传给 AiNotFound 的 what，其余文案不在本批范围
    for (const f of FILES.filter((x) => !x.includes('knowledge/')))
      expect(HAN.test(code(src(f))), f).toBe(false)
  })

  it('插值占位在中英文里一致', () => {
    for (const ns of NS)
      for (const k of Object.keys((zh as any)[ns])) {
        const ph = (s: string) => (s.match(/\{\w+\}/g) || []).sort()
        expect(ph((en as any)[ns][k]), `${ns}.${k}`).toEqual(ph((zh as any)[ns][k]))
      }
  })
})

describe('AI 助手悬浮入口挂在独立 app 上', () => {
  it('独立 app 装了 i18n（否则 $t / useI18n 会直接报错）', () => {
    const s = src('modules/ai/plugin.ts')
    expect(s).toMatch(/import i18n from '@\/locales'/)
    expect(s).toMatch(/\.use\(i18n\)/)
  })
})
