import { AppRouteRecord } from '@/types/router'

/**
 * AI 可选模块路由。
 * 路径对齐计划：/ai/assistant、/ai/model …；二级分组仅作菜单目录。
 */
export const aiRoutes: AppRouteRecord = {
  path: '/ai',
  name: 'Ai',
  component: '/index/index',
  meta: {
    title: 'menus.ai.title',
    icon: 'ri:robot-2-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    // —— AI 应用 ——
    {
      path: 'assistant',
      name: 'AiAssistant',
      component: '/ai/assistant',
      meta: { title: 'menus.ai.assistant', icon: 'ri:chat-smile-ai-line', keepAlive: true }
    },
    {
      path: 'app',
      name: 'AiApp',
      component: '/ai/app',
      meta: { title: 'menus.ai.app', icon: 'ri:flow-chart', keepAlive: true }
    },
    {
      path: 'app/design/:id',
      name: 'AiAppDesign',
      component: '/ai/app/design',
      meta: {
        title: 'menus.ai.appDesign',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/app'
      }
    },
    {
      path: 'knowledge',
      name: 'AiKnowledge',
      component: '/ai/knowledge',
      meta: { title: 'menus.ai.knowledge', icon: 'ri:book-open-line', keepAlive: true }
    },
    {
      path: 'knowledge/detail/:id',
      name: 'AiKnowledgeDetail',
      component: '/ai/knowledge/detail',
      meta: {
        title: 'menus.ai.knowledgeDetail',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/knowledge'
      }
    },
    {
      path: 'dataset',
      name: 'AiDataset',
      component: '/ai/dataset',
      meta: { title: 'menus.ai.dataset', icon: 'ri:bar-chart-box-line', keepAlive: true }
    },
    {
      path: 'dataset/config/:id',
      name: 'AiDatasetConfig',
      component: '/ai/dataset/config',
      meta: {
        title: 'menus.ai.datasetConfig',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/dataset'
      }
    },
    {
      path: 'dataset/run/:id',
      name: 'AiDatasetRun',
      component: '/ai/dataset/run',
      meta: {
        title: 'menus.ai.datasetRun',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/dataset'
      }
    },
    {
      path: 'dashboard/design/:id',
      name: 'AiDashboardDesign',
      component: '/ai/dashboard/design',
      meta: {
        title: 'menus.ai.dashboardDesign',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/dataset'
      }
    },
    // —— AI 工具 ——
    {
      path: 'model',
      name: 'AiModel',
      component: '/ai/model',
      meta: { title: 'menus.ai.model', icon: 'ri:cpu-line', keepAlive: true }
    },
    {
      path: 'prompt',
      name: 'AiPrompt',
      component: '/ai/prompt',
      meta: { title: 'menus.ai.prompt', icon: 'ri:file-text-line', keepAlive: true }
    },
    {
      path: 'mcp',
      name: 'AiMcp',
      component: '/ai/mcp',
      meta: { title: 'menus.ai.mcp', icon: 'ri:plug-line', keepAlive: true }
    },
    {
      path: 'vector',
      name: 'AiVector',
      component: '/ai/vector',
      meta: { title: 'menus.ai.vector', icon: 'ri:database-2-line', keepAlive: true }
    },
    {
      path: 'datasource',
      name: 'AiDatasource',
      component: '/ai/datasource',
      meta: { title: 'menus.ai.datasource', icon: 'ri:database-line', keepAlive: true }
    },
    {
      path: 'channel',
      name: 'AiChannel',
      component: '/ai/channel',
      meta: { title: 'menus.ai.channel', icon: 'ri:message-3-line', keepAlive: true }
    },
    // —— AI 运维 ——
    {
      path: 'secret',
      name: 'AiSecret',
      component: '/ai/secret',
      meta: { title: 'menus.ai.secret', icon: 'ri:key-2-line', keepAlive: true }
    },
    {
      path: 'conversation',
      name: 'AiConversation',
      component: '/ai/conversation',
      meta: { title: 'menus.ai.conversation', icon: 'ri:chat-history-line', keepAlive: true }
    },
    {
      path: 'billing',
      name: 'AiBilling',
      component: '/ai/billing',
      meta: { title: 'menus.ai.billing', icon: 'ri:bill-line', keepAlive: true }
    },
    {
      path: 'quota',
      name: 'AiQuota',
      component: '/ai/quota',
      meta: { title: 'menus.ai.quota', icon: 'ri:speed-line', keepAlive: true }
    },
    // —— 智能体集合 ——
    {
      path: 'gen/mindmap',
      name: 'AiGenMindmap',
      component: '/ai/gen/mindmap',
      meta: { title: 'menus.ai.genMindmap', icon: 'ri:mind-map', keepAlive: false }
    },
    {
      path: 'gen/poster',
      name: 'AiGenPoster',
      component: '/ai/gen/poster',
      meta: { title: 'menus.ai.genPoster', icon: 'ri:image-line', keepAlive: false }
    },
    {
      path: 'gen/article',
      name: 'AiGenArticle',
      component: '/ai/gen/article',
      meta: { title: 'menus.ai.genArticle', icon: 'ri:article-line', keepAlive: false }
    },
    {
      path: 'gen/product',
      name: 'AiGenProduct',
      component: '/ai/gen/product',
      meta: { title: 'menus.ai.genProduct', icon: 'ri:shopping-bag-line', keepAlive: false }
    },
    {
      path: 'gen/marketing',
      name: 'AiGenMarketing',
      component: '/ai/gen/marketing',
      meta: { title: 'menus.ai.genMarketing', icon: 'ri:megaphone-line', keepAlive: false }
    },
    {
      path: 'gen/svg',
      name: 'AiGenSvg',
      component: '/ai/gen/svg',
      meta: { title: 'menus.ai.genSvg', icon: 'ri:shape-line', keepAlive: false }
    },
    {
      path: 'gen/layout',
      name: 'AiGenLayout',
      component: '/ai/gen/layout',
      meta: { title: 'menus.ai.genLayout', icon: 'ri:layout-line', keepAlive: false }
    }
  ]
}
