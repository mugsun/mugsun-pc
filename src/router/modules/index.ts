import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { systemRoutes } from './system'
import { openPlatformRoutes } from './openPlatform'
import { saasRoutes } from './saas'
import { enableAi, enableGis, enableTrack } from '@/modules/flags'

/**
 * 可选模块路由：用 glob 探测，目录不存在时为空（可整目录删除 modules/gis|track|ai）。
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
const aiRouteMods = import.meta.glob<{ aiRoutes: AppRouteRecord }>(
  '../../../modules/ai/routes.ts',
  { eager: true }
)

const gisRoutes = Object.values(gisRouteMods)[0]?.gisRoutes
const trackRoutes = Object.values(trackRouteMods)[0]?.trackRoutes
const aiRoutes = Object.values(aiRouteMods)[0]?.aiRoutes

export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  ...(enableGis && gisRoutes ? [gisRoutes] : []),
  ...(enableTrack && trackRoutes ? [trackRoutes] : []),
  ...(enableAi && aiRoutes ? [aiRoutes] : []),
  systemRoutes,
  openPlatformRoutes,
  saasRoutes
]
