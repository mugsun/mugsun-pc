import type { FormItemRule } from 'element-plus'
import { $t } from '@/locales'

/**
 * 卡片上的工具数：后端 toolCount 优先，没有就数 toolsJson。
 * 返回 null 表示未知：toolCount 不是有限的非负数（null / undefined / 负数 / NaN），
 * 且 toolsJson 缺失、解析失败或不是数组。0 是已知值，照常显示。
 */
export function toolCountOf(row: { toolCount?: unknown; toolsJson?: unknown }): number | null {
  const raw = row.toolCount
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n)
  }
  const json = row.toolsJson
  if (Array.isArray(json)) return json.length
  if (typeof json !== 'string' || !json.trim()) return null
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.length : null
  } catch {
    return null
  }
}

/**
 * 卡片说明行：「工具数 N · 描述」。
 * 工具数未知就不显示工具数和分隔点，只留描述；描述也为空时返回空串（整行不显示）。
 */
export function cardMetaOf(
  row: { toolCount?: unknown; toolsJson?: unknown; description?: unknown },
  t: (key: string, named?: Record<string, unknown>) => string
): string {
  const n = toolCountOf(row)
  const desc = typeof row.description === 'string' ? row.description.trim() : ''
  return [n == null ? '' : t('aiMcpList.toolCount', { n }), desc].filter(Boolean).join(' · ')
}

/**
 * 这个弹窗专用的必填规则：英文提示用完整句子（「Enter a protocol name.」）。
 * AI 中心共用的 requiredRule 文案是「Please enter {label}」，改它会影响其他页面，所以这里单独给 key。
 */
export function mcpRequired(messageKey: string): FormItemRule[] {
  return [{ required: true, whitespace: true, message: () => $t(messageKey), trigger: 'blur' }]
}
