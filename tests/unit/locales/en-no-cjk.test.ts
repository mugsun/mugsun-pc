import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'

// CJK 统一表意文字（含扩展 A、兼容）、CJK 符号与标点（、。「」等）、全角形式（，：；（）等）
const CJK_OR_ZH_PUNCT = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/

function collect(node: unknown, path: string, out: Array<[string, string]>) {
  if (typeof node === 'string') {
    if (CJK_OR_ZH_PUNCT.test(node)) out.push([path, node])
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collect(v, path ? `${path}.${k}` : k, out)
  }
}

describe('en.json', () => {
  it('values contain no CJK characters or Chinese punctuation', () => {
    const hits: Array<[string, string]> = []
    collect(en, '', hits)
    expect(hits).toEqual([])
  })
})
