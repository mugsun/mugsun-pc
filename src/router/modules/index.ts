import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { gisRoutes } from './gis'
import { trackRoutes } from './track'
import { systemRoutes } from './system'
import { openPlatformRoutes } from './openPlatform'
import { saasRoutes } from './saas'

/**
 * 导出所有模块化路由（仅真实功能模块，已移除模板演示路由）
 * dashboard 置于首位，作为登录后落地页；其余为并列的顶级应用分组（多应用）
 */
export const routeModules: AppRouteRecord[] = [
  dashboardRoutes,
  gisRoutes,
  trackRoutes,
  systemRoutes,
  openPlatformRoutes,
  saasRoutes
]
