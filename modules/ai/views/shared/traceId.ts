/**
 * 前端生成的链路编号（32 位十六进制，与后端 IdUtil.fastSimpleUUID 同格式）。
 *
 * 请求时放进 X-Trace-Id 头：后端 TraceIdFilter 收到合法值（非空、≤64 字符）会沿用它，
 * 写进日志 MDC 并回写响应头。所以页面上显示的「错误编号」能直接对上后端日志；
 * 网络不通、没有响应时也有编号可报。
 *
 * 用 crypto.getRandomValues 而不是 randomUUID：后者只在安全上下文（HTTPS / localhost）可用，
 * 内网 HTTP 部署会拿不到。
 */
export const TRACE_HEADER = 'X-Trace-Id'

export function newTraceId(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
