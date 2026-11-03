import { describe, expect, it } from 'vitest'
import { parseApiKey } from '@/utils/crypto/apiKey'

describe('parseApiKey', () => {
  it('缺失时报 missing', () => {
    expect(parseApiKey(undefined)).toEqual({ ok: false, error: 'missing' })
    expect(parseApiKey('')).toEqual({ ok: false, error: 'missing' })
    expect(parseApiKey('   ')).toEqual({ ok: false, error: 'missing' })
  })

  it('格式无效时报 invalid，不回落', () => {
    expect(parseApiKey('abcdefghijklmnop')).toEqual({ ok: false, error: 'invalid' })
    expect(parseApiKey('0'.repeat(31))).toEqual({ ok: false, error: 'invalid' })
    expect(parseApiKey('g'.repeat(32))).toEqual({ ok: false, error: 'invalid' })
    expect(parseApiKey(btoa('x'.repeat(15)))).toEqual({ ok: false, error: 'invalid' })
    expect(parseApiKey(btoa('x'.repeat(24)))).toEqual({ ok: false, error: 'invalid' })
    expect(parseApiKey('!!!!')).toEqual({ ok: false, error: 'invalid' })
  })

  it('32 位 hex 合法', () => {
    const r = parseApiKey('00112233445566778899aabbccddeeFF')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.bytes).toHaveLength(16)
      expect(r.bytes[0]).toBe(0x00)
      expect(r.bytes[15]).toBe(0xff)
    }
  })

  it('解码后 16 字节的 base64 合法', () => {
    const bytes = Array.from({ length: 16 }, (_, i) => i * 7)
    const b64 = btoa(String.fromCharCode(...bytes))
    expect(parseApiKey(b64)).toEqual({ ok: true, bytes })
  })

  it('末尾比特位不规范的 base64 判为 invalid', () => {
    const canonical = btoa(String.fromCharCode(...new Array(16).fill(0)))
    expect(canonical).toBe('AAAAAAAAAAAAAAAAAAAAAA==')
    expect(parseApiKey(canonical).ok).toBe(true)
    expect(atob('AAAAAAAAAAAAAAAAAAAAAB==')).toBe(atob(canonical))
    expect(parseApiKey('AAAAAAAAAAAAAAAAAAAAAB==')).toEqual({ ok: false, error: 'invalid' })
  })

  describe('边界写法', () => {
    const b16 = btoa(String.fromCharCode(...Array.from({ length: 16 }, (_, i) => 250 - i)))

    it('全大写、全小写 hex 都合法且结果相同', () => {
      const lower = parseApiKey('abcdef0123456789abcdef0123456789')
      const upper = parseApiKey('ABCDEF0123456789ABCDEF0123456789')
      expect(lower.ok).toBe(true)
      expect(upper).toEqual(lower)
    })

    it('前后带空格的合法值去空格后接受', () => {
      expect(parseApiKey('  abcdef0123456789abcdef0123456789\n').ok).toBe(true)
      expect(parseApiKey(` ${b16} `).ok).toBe(true)
    })

    it('中间夹空格判 invalid', () => {
      expect(parseApiKey('abcdef0123456789 abcdef0123456789').ok).toBe(false)
    })

    it('base64url 写法（- _）判 invalid', () => {
      const url = b16.replace(/\+/g, '-').replace(/\//g, '_')
      expect(url).not.toBe(b16)
      expect(parseApiKey(url).ok).toBe(false)
    })

    it('不带 padding 判 invalid', () => {
      expect(parseApiKey(b16.replace(/=+$/, '')).ok).toBe(false)
    })
  })

  describe('前后空白对齐 Java String.strip()', () => {
    const hex = '000102030405060708090a0b0c0d0e0f'

    it('带 BOM 的密钥判 invalid（与后端一致，不去掉 BOM）', () => {
      expect(parseApiKey('\uFEFF' + hex)).toEqual({ ok: false, error: 'invalid' })
      expect(parseApiKey(hex + '\uFEFF')).toEqual({ ok: false, error: 'invalid' })
    })

    it('NBSP（U+00A0）不去掉，判 invalid', () => {
      expect(parseApiKey('\u00A0' + hex)).toEqual({ ok: false, error: 'invalid' })
    })

    it('ASCII 空白与 Java 视为空白的字符会去掉', () => {
      expect(parseApiKey(' \t\r\n' + hex).ok).toBe(true)
      expect(parseApiKey('\u3000' + hex).ok).toBe(true)
    })
  })
})
