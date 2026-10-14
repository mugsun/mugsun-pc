/**
 * 请求语言：把 vue-i18n 的语言码映射为 Accept-Language（后端据此返回 name_en 等本地化字段）。
 * zh → zh-CN，en → en，其他原样透传；空值回退 zh-CN。
 */
export function toAcceptLanguage(locale: unknown): string {
  const v = String(locale ?? '').trim()
  if (!v) return 'zh-CN'
  if (v === 'zh' || v.toLowerCase() === 'zh-cn') return 'zh-CN'
  if (v.toLowerCase().startsWith('en')) return 'en'
  return v
}
