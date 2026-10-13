/**
 * 头像地址解析
 *
 * - 空值：返回 fallback（默认 ''，由调用方显示默认头像）
 * - http(s):// / data: / blob:：旧值或本地预览，原样返回
 * - 相对路径（如 /auth/avatar/raw/{id}）：按与 http 层相同的规则拼前缀，
 *   即 baseURL(VITE_API_URL) + 接口前缀 /api（仓库所有接口均以 /api 开头，
 *   dev/preview 代理与网关会去掉 /api），结果如 /api/auth/avatar/raw/{id}
 * - 图片走 <img> 直链，不带 token
 *
 * @module utils/avatar
 * @author Mugsun
 */
const ABSOLUTE_RE = /^(https?:)?\/\/|^(data|blob):/i
/** 与 src/api 中各接口 url 的 /api 前缀保持一致 */
const API_PREFIX = '/api'

function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .join('/')
}

export function resolveAvatarUrl(avatar?: string | null, fallback = ''): string {
  const value = avatar?.trim()
  if (!value) return fallback
  if (ABSOLUTE_RE.test(value)) return value
  const path = value.startsWith('/') ? value : `/${value}`
  const withPrefix =
    path === API_PREFIX || path.startsWith(`${API_PREFIX}/`) ? path : API_PREFIX + path
  const base = import.meta.env.VITE_API_URL || ''
  const url = joinPath(base, withPrefix)
  return url.startsWith('/') || /^https?:/i.test(url) ? url : `/${url}`
}
