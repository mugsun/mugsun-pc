import { AppRouteRecord } from '@/types/router'

export const systemRoutes: AppRouteRecord = {
  path: '/system',
  name: 'System',
  component: '/index/index',
  meta: {
    title: 'menus.system.title',
    icon: 'ri:user-3-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'user',
      name: 'User',
      component: '/system/user',
      meta: {
        title: 'menus.system.user',
        icon: 'ri:user-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'role',
      name: 'Role',
      component: '/system/role',
      meta: {
        title: 'menus.system.role',
        icon: 'ri:user-settings-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'dept',
      name: 'Dept',
      component: '/system/dept',
      meta: {
        title: 'menus.system.dept',
        icon: 'ri:organization-chart',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'post',
      name: 'Post',
      component: '/system/post',
      meta: {
        title: 'menus.system.post',
        icon: 'ri:contacts-book-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'param',
      name: 'SysParam',
      component: '/system/param',
      meta: {
        title: 'menus.system.param',
        icon: 'ri:settings-3-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'crypto',
      name: 'CryptoDemo',
      component: '/system/crypto',
      meta: {
        title: 'menus.system.crypto',
        icon: 'ri:shield-keyhole-line',
        keepAlive: true,
        // 接口加密能力在线自检工具：仅开发环境显示，生产构建隐藏菜单
        isHide: import.meta.env.PROD,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'serial-number',
      name: 'SerialNumber',
      component: '/system/serial-number',
      meta: {
        title: 'menus.system.serialNumber',
        icon: 'ri:hashtag',
        keepAlive: true
      }
    },
    {
      path: 'mail-template',
      name: 'MailTemplate',
      component: '/system/mail-template',
      meta: {
        title: 'menus.system.mailTemplate',
        icon: 'ri:mail-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'dict',
      name: 'Dict',
      component: '/system/dict',
      meta: {
        title: 'menus.system.dict',
        icon: 'ri:book-2-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'dict-biz',
      name: 'DictBiz',
      component: '/system/dict-biz',
      meta: {
        title: 'menus.system.dictBiz',
        icon: 'ri:book-marked-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'notice',
      name: 'Notice',
      component: '/system/notice',
      meta: {
        title: 'menus.system.notice',
        icon: 'ri:notification-2-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'my-notice',
      name: 'MyNotice',
      component: '/system/my-notice',
      meta: {
        title: 'menus.system.myNotice',
        icon: 'ri:mail-open-line',
        keepAlive: true
      }
    },
    {
      path: 'attach',
      name: 'Attach',
      component: '/system/attach',
      meta: {
        title: 'menus.system.attach',
        icon: 'ri:folder-2-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'oss',
      name: 'Oss',
      component: '/system/oss',
      meta: {
        title: 'menus.system.oss',
        icon: 'ri:cloud-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'sms',
      name: 'Sms',
      component: '/system/sms',
      meta: {
        title: 'menus.system.sms',
        icon: 'ri:message-2-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'gen',
      name: 'Gen',
      component: '/system/gen',
      meta: {
        title: 'menus.system.gen',
        icon: 'ri:code-box-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'gen-datasource',
      name: 'GenDatasource',
      component: '/system/gen-datasource',
      meta: {
        title: 'menus.system.genDatasource',
        icon: 'ri:database-2-line',
        keepAlive: true
      }
    },
    {
      path: 'gen-scheme',
      name: 'GenScheme',
      component: '/system/gen-scheme',
      meta: {
        title: 'menus.system.genScheme',
        icon: 'ri:settings-4-line',
        keepAlive: true
      }
    },
    {
      path: 'online-form',
      name: 'OnlineForm',
      component: '/system/online-form',
      meta: {
        title: 'menus.system.onlineForm',
        icon: 'ri:table-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'gen-modeling',
      name: 'GenModeling',
      component: '/system/gen-modeling',
      meta: {
        title: 'menus.system.genModeling',
        icon: 'ri:database-2-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'form-designer',
      name: 'FormDesigner',
      component: '/system/form-designer',
      meta: {
        title: 'menus.system.formDesigner',
        icon: 'ri:file-edit-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'flow-def',
      name: 'FlowDef',
      component: '/system/flow-def',
      meta: {
        title: 'menus.system.flowDef',
        icon: 'ri:git-branch-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'flow-todo',
      name: 'FlowTodo',
      component: '/system/flow-todo',
      meta: {
        title: 'menus.system.flowTodo',
        icon: 'ri:task-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'flow-center',
      name: 'FlowCenter',
      component: '/system/flow-center',
      meta: {
        title: 'menus.system.flowCenter',
        icon: 'ri:inbox-archive-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'flow-running',
      name: 'FlowRunning',
      component: '/system/flow-running',
      meta: {
        title: 'menus.system.flowRunning',
        icon: 'ri:git-commit-line',
        keepAlive: true
      }
    },
    {
      path: 'flow-graph',
      name: 'FlowGraph',
      component: '/system/flow-graph',
      meta: {
        title: 'menus.system.flowGraph',
        icon: 'ri:node-tree',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'job',
      name: 'Job',
      component: '/system/job',
      meta: {
        title: 'menus.system.job',
        icon: 'ri:timer-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'job-server',
      name: 'JobServer',
      component: '/system/job-server',
      meta: {
        title: 'menus.system.jobServer',
        icon: 'ri:server-line',
        keepAlive: true
      }
    },
    {
      path: 'report',
      name: 'Report',
      component: '/system/report',
      meta: {
        title: 'menus.system.report',
        icon: 'ri:bar-chart-2-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'login-log',
      name: 'LoginLog',
      component: '/system/login-log',
      meta: {
        title: 'menus.system.loginLog',
        icon: 'ri:shield-keyhole-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'online',
      name: 'Online',
      component: '/system/online',
      meta: {
        title: 'menus.system.online',
        icon: 'ri:computer-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'client',
      name: 'Client',
      component: '/system/client',
      meta: {
        title: 'menus.system.client',
        icon: 'ri:device-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'region',
      name: 'Region',
      component: '/system/region',
      meta: {
        title: 'menus.system.region',
        icon: 'ri:map-pin-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'log',
      name: 'OperLog',
      component: '/system/log',
      meta: {
        title: 'menus.system.log',
        icon: 'ri:file-list-3-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'api-log',
      name: 'ApiLog',
      component: '/system/api-log',
      meta: {
        title: 'menus.system.apiLog',
        icon: 'ri:global-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'error-log',
      name: 'ErrorLog',
      component: '/system/error-log',
      meta: {
        title: 'menus.system.errorLog',
        icon: 'ri:error-warning-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'usual-log',
      name: 'UsualLog',
      component: '/system/usual-log',
      meta: {
        title: 'menus.system.usualLog',
        icon: 'ri:file-list-2-line',
        keepAlive: true
      }
    },
    {
      path: 'monitor',
      name: 'ServerMonitor',
      component: '/system/monitor',
      meta: {
        title: 'menus.system.monitor',
        icon: 'ri:line-chart-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'data-audit',
      name: 'DataAudit',
      component: '/system/data-audit',
      meta: {
        title: 'menus.system.dataAudit',
        icon: 'ri:history-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'help-doc',
      name: 'HelpDoc',
      component: '/system/help-doc',
      meta: {
        title: 'menus.system.helpDoc',
        icon: 'ri:question-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'changelog',
      name: 'ChangeLog',
      component: '/system/changelog',
      meta: {
        title: 'menus.system.changelog',
        icon: 'ri:git-branch-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'feedback',
      name: 'Feedback',
      component: '/system/feedback',
      meta: {
        title: 'menus.system.feedback',
        icon: 'ri:feedback-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'message',
      name: 'Message',
      component: '/system/message',
      meta: {
        title: 'menus.system.message',
        icon: 'ri:notification-2-line',
        keepAlive: true
      }
    },
    {
      path: 'message-send',
      name: 'MessageSend',
      component: '/system/message-send',
      meta: {
        title: 'menus.system.messageSend',
        icon: 'ri:send-plane-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'message-template',
      name: 'MessageTemplate',
      component: '/system/message-template',
      meta: {
        title: 'menus.system.messageTemplate',
        icon: 'ri:mail-settings-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'cache',
      name: 'Cache',
      component: '/system/cache',
      meta: {
        title: 'menus.system.cache',
        icon: 'ri:database-2-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'user-center',
      name: 'UserCenter',
      component: '/system/user-center',
      meta: {
        title: 'menus.system.userCenter',
        icon: 'ri:user-line',
        isHide: true,
        keepAlive: true,
        isHideTab: true
      }
    },
    {
      path: 'menu',
      name: 'Menus',
      component: '/system/menu',
      meta: {
        title: 'menus.system.menu',
        icon: 'ri:menu-line',
        keepAlive: true,
        roles: ['R_SUPER'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'top-menu',
      name: 'TopMenu',
      component: '/system/top-menu',
      meta: {
        title: 'menus.system.topMenu',
        icon: 'ri:layout-top-line',
        keepAlive: true
      }
    },
    {
      path: 'data-scope',
      name: 'DataScope',
      component: '/system/data-scope',
      meta: {
        title: 'menus.system.dataScope',
        icon: 'ri:shield-keyhole-line',
        keepAlive: true
      }
    },
    {
      path: 'api-scope',
      name: 'ApiScope',
      component: '/system/api-scope',
      meta: {
        title: 'menus.system.apiScope',
        icon: 'ri:route-line',
        keepAlive: true
      }
    }
  ]
}
