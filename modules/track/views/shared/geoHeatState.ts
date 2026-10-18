import { enableGis, isGisRuntimeOn } from '@/modules/flags'

/**
 * 概览「访问热力」卡片状态：
 * - noBuild：构建期开关关闭（VITE_ENABLE_GIS=false）
 * - serviceOff：构建开关打开，但 /auth/info 的 gisEnabled 不是 true
 * - noData：GIS 可用，但没有精确坐标点
 * - ready：显示热力图
 */
export type GeoHeatState = 'noBuild' | 'serviceOff' | 'noData' | 'ready'

export function geoHeatState(
  info: { gisEnabled?: boolean } | null | undefined,
  pointCount: number,
  buildFlag: boolean = enableGis
): GeoHeatState {
  if (!buildFlag) return 'noBuild'
  if (!isGisRuntimeOn(info, buildFlag)) return 'serviceOff'
  return pointCount > 0 ? 'ready' : 'noData'
}

/** 空态文案的 i18n key（ready 不显示空态） */
export const GEO_HEAT_EMPTY_KEY: Record<Exclude<GeoHeatState, 'ready'>, string> = {
  noBuild: 'pages.track.overview.geoEmptyNoBuild',
  serviceOff: 'pages.track.overview.geoEmptyServiceOff',
  noData: 'pages.track.overview.geoEmptyNoData'
}

/** 标题旁「精确坐标 N 条」：N=0 时一律隐藏（不论卡片处于哪种状态） */
export function showGeoCount(geoCount: number | null | undefined): boolean {
  return Number(geoCount) > 0
}
