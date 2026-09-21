import { AppRouteRecord } from '@/types/router'

/**
 * 地理信息：地图 / 示例 / 图层 / 底图。场景与分析走隐藏路由。
 */
export const gisRoutes: AppRouteRecord = {
  path: '/gis',
  name: 'Gis',
  component: '/index/index',
  meta: {
    title: 'menus.gis.title',
    icon: 'ri:earth-line'
  },
  children: [
    {
      path: 'workspace',
      name: 'GisWorkspace',
      component: '/gis/workspace',
      meta: {
        title: 'menus.gis.workspace',
        icon: 'ri:map-2-line',
        keepAlive: false
      }
    },
    {
      path: 'lab',
      name: 'GisLab',
      component: '/gis/lab',
      meta: {
        title: 'menus.gis.lab',
        icon: 'ri:play-circle-line',
        keepAlive: false
      }
    },
    {
      path: 'layer',
      name: 'GisLayer',
      component: '/gis/layer',
      meta: {
        title: 'menus.gis.layer',
        icon: 'ri:stack-line',
        keepAlive: false
      }
    },
    {
      path: 'scene',
      name: 'GisScene',
      component: '/gis/scene',
      meta: {
        title: 'menus.gis.scene',
        icon: 'ri:landscape-line',
        keepAlive: false
      }
    },
    {
      path: 'analyze',
      name: 'GisAnalyze',
      component: '/gis/analyze',
      meta: {
        title: 'menus.gis.analyze',
        icon: 'ri:shape-line',
        keepAlive: false
      }
    },
    {
      path: 'provider',
      name: 'GisProvider',
      component: '/gis/provider',
      meta: {
        title: 'menus.gis.provider',
        icon: 'ri:key-2-line',
        keepAlive: false
      }
    }
  ]
}
