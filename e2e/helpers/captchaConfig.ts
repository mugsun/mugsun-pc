/**
 * 解析 /api/auth/captcha/config 的响应，只认两种结果：enabled=true / enabled=false。
 * 其余一律 throw（HTTP 非 2xx、响应不是 JSON、R.code≠200、data 为空、enabled 不是布尔），
 * 避免环境异常被当成「验证码关闭」静默跳过。纯函数，单测见 tests/unit/e2e/captchaConfig.test.ts。
 */
export interface ConfigResponseLike {
  status: number
  ok: boolean
  text: string
}

export function parseCaptchaEnabled(resp: ConfigResponseLike, scene: string): boolean {
  const where = `/auth/captcha/config（${scene}）`
  if (!resp.ok) {
    throw new Error(`${where} 请求失败：HTTP ${resp.status}，响应开头：${resp.text.slice(0, 120)}`)
  }
  let json: { code?: unknown; data?: { enabled?: unknown } | null } | null
  try {
    json = JSON.parse(resp.text)
  } catch {
    throw new Error(
      `${where} 返回的不是 JSON：HTTP ${resp.status}，响应开头：${resp.text.slice(0, 120)}`
    )
  }
  if (json?.code !== 200) {
    throw new Error(`${where} 业务失败：HTTP ${resp.status}，code=${String(json?.code)}`)
  }
  const enabled = json.data?.enabled
  if (typeof enabled !== 'boolean') {
    throw new Error(
      `${where} 响应缺少布尔 data.enabled：HTTP ${resp.status}，data=${JSON.stringify(json.data ?? null)}`
    )
  }
  return enabled
}
