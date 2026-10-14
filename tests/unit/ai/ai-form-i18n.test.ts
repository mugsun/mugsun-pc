import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

const CJK = /[\u4e00-\u9fff]/

describe('aiForm i18n 词条', () => {
  it('中英文 key 一致', () => {
    expect(Object.keys(en.aiForm).sort()).toEqual(Object.keys(zh.aiForm).sort())
  })

  it('英文词条不含中文', () => {
    const leaked = Object.entries(en.aiForm).filter(([, v]) => CJK.test(v))
    expect(leaked).toEqual([])
  })
})
