import type { GisStatus } from '@/api/gis'

/**
 * 底图可用性：以后端 /system/gis/status 为准。
 * - ready：至少一个底图「已配置且启用」（含部署白名单允许的默认 OSM 预设）
 * - unconfigured：状态取到了，但没有任何可用底图
 * - moduleOff：GIS 模块被关闭
 * - error：状态没取到（网络或服务端错误），与「未配置」区分
 */
export type GisBasemapState = 'loading' | 'ready' | 'unconfigured' | 'moduleOff' | 'error'
export type GisBasemapErrorKind = 'network' | 'server'

export const GIS_PROVIDER_ROUTE = '/gis/provider'
export const GIS_PROVIDER_ROUTE_NAME = 'GisProvider'
export const GIS_PROVIDER_PERM = 'gis:provider:list'
export const GIS_BASEMAP_DOC_ZH = 'https://docs.mugsun.com/pc/gis-basemap'
export const GIS_BASEMAP_DOC_EN = 'https://docs.mugsun.com/en/pc/gis-basemap'

export function basemapStateOf(status: GisStatus | null | undefined): GisBasemapState {
  if (!status) {
    return 'error'
  }
  if (!status.enabled) {
    return 'moduleOff'
  }
  return (status.providers || []).some((p) => p.configured && p.enabled) ? 'ready' : 'unconfigured'
}

/** 无响应（断网、超时、被拦截）记为 network；有响应的 4xx/5xx 记为 server */
export function basemapErrorKind(err: unknown): GisBasemapErrorKind {
  if (err && typeof err === 'object') {
    // HttpError：只有拿到响应时才带 data（见 utils/http/error.ts handleError）
    const e = err as { data?: unknown; response?: unknown }
    if (e.data !== undefined || e.response !== undefined) {
      return 'server'
    }
  }
  return 'network'
}

export function isCanceled(err: unknown): boolean {
  return !!(err && typeof err === 'object' && (err as { canceled?: boolean }).canceled)
}

export function basemapDocUrl(locale: string | undefined): string {
  return (locale || '').toLowerCase().startsWith('zh') ? GIS_BASEMAP_DOC_ZH : GIS_BASEMAP_DOC_EN
}
