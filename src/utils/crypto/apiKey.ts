/**
 * 接口加解密（SM4）密钥解析：只接受 32 位 hex，或解码后正好 16 字节的 base64。
 * 规则与后端一致：先按 Java String.strip() 去掉前后空白，中间有空白即拒绝；hex 大小写均可；
 * base64 只接受标准字母表且必须带填充（不接受 base64url），解码后重新编码须与输入一致。
 * 缺失或格式无效时返回错误原因，调用方必须报错，不得回落到任何默认值。
 */
export type ApiKeyError = 'missing' | 'invalid'

export type ApiKeyResult = { ok: true; bytes: number[] } | { ok: false; error: ApiKeyError }

const HEX_RE = /^[0-9a-fA-F]{32}$/
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * 对齐 Java String.strip()：只去掉 Character.isWhitespace 为真的字符。
 * 即 TAB/LF/VT/FF/CR、U+001C–U+001F，以及 Unicode 空格类（Zs/Zl/Zp），
 * 但不含 NBSP（U+00A0、U+2007、U+202F）。BOM（U+FEFF）不是空白，保留，随后判 invalid。
 * 不用 String.prototype.trim()：它会去掉 NBSP 和 BOM，和后端不一致。
 */
export function isJavaWhitespace(ch: string): boolean {
  const cp = ch.codePointAt(0)
  if (cp === undefined) return false
  if (cp === 0x09 || cp === 0x0a || cp === 0x0b || cp === 0x0c || cp === 0x0d) return true
  if (cp >= 0x1c && cp <= 0x1f) return true
  if (cp === 0x20 || cp === 0x1680) return true
  if (cp >= 0x2000 && cp <= 0x200a && cp !== 0x2007) return true
  if (cp === 0x2028 || cp === 0x2029 || cp === 0x205f || cp === 0x3000) return true
  return false
}

export function javaStrip(s: string): string {
  let a = 0
  let b = s.length
  while (a < b && isJavaWhitespace(s[a]!)) a++
  while (b > a && isJavaWhitespace(s[b - 1]!)) b--
  return s.slice(a, b)
}

function decodeBase64(s: string): number[] | null {
  if (!B64_RE.test(s) || s.length % 4 !== 0) return null
  try {
    const bin = atob(s)
    // 重新编码后须与输入一致，拒掉末尾比特位不规范（非规范编码）的写法
    if (btoa(bin) !== s) return null
    return Array.from(bin, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

export function parseApiKey(raw: string | undefined | null): ApiKeyResult {
  const s = javaStrip(raw ?? '')
  if (!s) return { ok: false, error: 'missing' }
  if (HEX_RE.test(s)) {
    const bytes: number[] = []
    for (let i = 0; i < 32; i += 2) bytes.push(parseInt(s.slice(i, i + 2), 16))
    return { ok: true, bytes }
  }
  const b64 = decodeBase64(s)
  if (b64 && b64.length === 16) return { ok: true, bytes: b64 }
  return { ok: false, error: 'invalid' }
}
