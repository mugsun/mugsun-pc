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
const aiRouteMods = import.meta.glob<{
  aiRoutes: AppRouteRecord
  aiMenuGroupTitles?: Record<string, string>
}>('../../../modules/ai/routes.ts', { eager: true })

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

/**
 * 只做分组、自己没有页面的菜单目录：全路径 → menus.* 文案键。
 * 目录不在路由里，后端菜单按路径对齐标题时要从这里取，否则英文界面显示后端的中文名。
 */
export const menuGroupTitles: Record<string, string> = {
  ...(enableAi ? Object.values(aiRouteMods)[0]?.aiMenuGroupTitles : undefined)
}
