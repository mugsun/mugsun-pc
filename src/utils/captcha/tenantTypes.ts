/**
 * 租户验证码题型配置（POST /system/tenant/captcha，mugsun-boot#35）。
 * ROTATE 为辅助题型、默认关闭，排在最后。
 */
export const TENANT_CAPTCHA_TYPES = [
  'SLIDER',
  'WORD_CLICK',
  'ICON_CLICK',
  'JIGSAW',
  'ROTATE'
] as const
export type TenantCaptchaType = (typeof TENANT_CAPTCHA_TYPES)[number]

/** 解析租户 captchaTypes（逗号分隔；NULL/空 = 平台默认 → []），丢弃未知值并按固定顺序去重 */
export function parseTenantCaptchaTypes(csv: unknown): TenantCaptchaType[] {
  if (typeof csv !== 'string' || !csv.trim()) return []
  const set = new Set(csv.split(',').map((s) => s.trim().toUpperCase()))
  return TENANT_CAPTCHA_TYPES.filter((t) => set.has(t))
}

/** 保存响应里的 data.warning：后端下发的提示文案，原样返回；无提示返回空串 */
export function tenantCaptchaWarning(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const w = (data as { warning?: unknown }).warning
  return typeof w === 'string' ? w.trim() : ''
}

/** 只启用 ROTATE（前端预提示用，最终以后端 warning 为准） */
export function isRotateOnly(types: readonly string[]): boolean {
  return types.length === 1 && types[0] === 'ROTATE'
}
