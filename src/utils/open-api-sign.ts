import CryptoJS from 'crypto-js'

/** 与后端 OpenApiSignService 一致的 HMAC-SHA256 签名头 */
export function buildOpenApiSignHeaders(
  method: string,
  uri: string,
  query: string,
  body: string,
  clientSecret: string
): Record<string, string> {
  const timestamp = String(Date.now())
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const bodyHash = body ? CryptoJS.SHA256(body).toString(CryptoJS.enc.Hex) : ''
  const signBase = [method.toUpperCase(), uri, query || '', timestamp, nonce, bodyHash].join('\n')
  const sign = CryptoJS.HmacSHA256(signBase, clientSecret).toString(CryptoJS.enc.Hex)
  return {
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Sign': sign
  }
}
