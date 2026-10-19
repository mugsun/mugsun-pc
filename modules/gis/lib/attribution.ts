import type { GisProviderStatus } from '../api'

/**
 * 底图版权归属：由 /status 下发（xyz 为部署 / 租户配置的文本，厂商底图为固定署名），
 * 地图右下角 Attribution 控件原样以纯文本显示。
 */
const byProvider: Record<string, string> = {}

export function rememberAttributions(rows: GisProviderStatus[] | undefined): void {
  for (const row of rows || []) {
    byProvider[row.provider] = row.attribution || ''
  }
}

export function attributionOf(provider: string): string {
  return byProvider[provider] || ''
}

/** OpenLayers 会把字符串当 HTML 插入，这里先转义，防止配置里夹带标签 */
export function escapeAttribution(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
