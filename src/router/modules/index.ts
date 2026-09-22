import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { systemRoutes } from './system'
import { openPlatformRoutes } from './openPlatform'
import { saasRoutes } from './saas'
import { enableGis, enableTrack } from '@/modules/flags'

/**
 * 可选模块路由：用 glob 探测，目录不存在时为空（可整目录删除 modules/gis|track）。
 * VITE_ENABLE_*=false 时即使源码仍在也不注册。
 */
const gisRouteMods = import.meta.glob<{ gisRoutes: AppRouteRecord }>(
  '../../../modules/gis/routes.ts',
  { eager: true }
)
const trackRouteMods = import.meta.glob<{ trackRoutes: AppRouteRecord }>(
  '../../../modules/track/routes.ts',
  { eager: true }
)

const gisRoutes = Object.values(gisRouteMods)[0]?.gisRoutes
const trackRoutes = Object.values(trackRouteMods)[0]?.trackRoutes

export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  ...(enableGis && gisRoutes ? [gisRoutes] : []),
  ...(enableTrack && trackRoutes ? [trackRoutes] : []),
  systemRoutes,
  openPlatformRoutes,
  saasRoutes
]
