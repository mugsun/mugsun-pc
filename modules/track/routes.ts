import { AppRouteRecord } from '@/types/router'

/**
 * 埋点分析应用（顶级应用分组）：数据概览、事件分析、性能分析、错误监控、错误问题单、会话回放与接入管理。
 */
export const trackRoutes: AppRouteRecord = {
  path: '/track',
  name: 'Track',
  component: '/index/index',
  meta: {
    title: 'menus.track.title',
    icon: 'ri:line-chart-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'overview',
      name: 'TrackOverview',
      component: '/track/overview',
      meta: {
        title: 'menus.track.overview',
        icon: 'ri:bar-chart-box-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      // 问数据：中文提问 → 指标/图/表 → 相关回放；读 sys:track-ask:list
      // 图标对齐 boot V19 种子 ri:chat-search-line（勿自编其它权限码）
      path: 'ask',
      name: 'TrackAsk',
      component: '/track/ask',
      meta: {
        title: 'menus.track.ask',
        icon: 'ri:chat-search-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'event',
      name: 'TrackEvent',
      component: '/track/event',
      meta: {
        title: 'menus.track.event',
        icon: 'ri:cursor-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'perf',
      name: 'TrackPerf',
      component: '/track/perf',
      meta: {
        title: 'menus.track.perf',
        icon: 'ri:speed-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'error',
      name: 'TrackError',
      component: '/track/error',
      meta: {
        title: 'menus.track.error',
        icon: 'ri:bug-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      // 错误问题单：release 筛 + 指派/解决闭环；读 sys:track-error:list，写 sys:track-error-issue:edit
      // 菜单种子/权限码合入 boot 前超管可测，合入时对齐 boot 种子（勿自编其它权限码）
      path: 'error-issue',
      name: 'TrackErrorIssue',
      component: '/track/error-issue',
      meta: {
        title: 'menus.track.errorIssue',
        icon: 'ri:file-list-3-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'replay',
      name: 'TrackReplay',
      component: '/track/replay',
      meta: {
        title: 'menus.track.replay',
        icon: 'ri:play-circle-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'user',
      name: 'TrackUser',
      component: '/track/user',
      meta: {
        title: 'menus.track.user',
        icon: 'ri:user-search-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'funnel',
      name: 'TrackFunnel',
      component: '/track/funnel',
      meta: {
        title: 'menus.track.funnel',
        icon: 'ri:filter-3-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'retention',
      name: 'TrackRetention',
      component: '/track/retention',
      meta: {
        title: 'menus.track.retention',
        icon: 'ri:user-heart-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'app',
      name: 'TrackApp',
      component: '/track/app',
      meta: {
        title: 'menus.track.app',
        icon: 'ri:plug-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    }
  ]
}
