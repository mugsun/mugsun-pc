/**
 * 后端 Java 回落路径会跳过极区（|纬度| > 85°）或跨 180° 经线、算不出米制结果的要素，
 * 响应里用 skipped 报数量（mugsun-boot#48）。这里只负责读数和给出文档链接。
 */
export const GIS_LIMITS_DOC_ZH = 'https://docs.mugsun.com/pc/gis#metric-limits'
export const GIS_LIMITS_DOC_EN = 'https://docs.mugsun.com/en/pc/gis#metric-limits'

/** 从图层查询或空间分析的响应里取 skipped；缺失、非数字、≤0 都视为 0 */
export function skippedCount(resp: unknown): number {
  if (!resp || typeof resp !== 'object') {
    return 0
  }
  const n = (resp as { skipped?: unknown }).skipped
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function skippedDocUrl(locale: string | undefined): string {
  return (locale || '').toLowerCase().startsWith('zh') ? GIS_LIMITS_DOC_ZH : GIS_LIMITS_DOC_EN
}
