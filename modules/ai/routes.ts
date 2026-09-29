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
    title: 'AI 中心',
    icon: 'ri:robot-2-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    // —— AI 应用 ——
    {
      path: 'assistant',
      name: 'AiAssistant',
      component: '/ai/assistant',
      meta: { title: '机器人助手', icon: 'ri:chat-smile-ai-line', keepAlive: true }
    },
    {
      path: 'app',
      name: 'AiApp',
      component: '/ai/app',
      meta: { title: '机器人应用', icon: 'ri:flow-chart', keepAlive: true }
    },
    {
      path: 'app/design/:id',
      name: 'AiAppDesign',
      component: '/ai/app/design',
      meta: {
        title: '应用编排',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/app'
      }
    },
    {
      path: 'knowledge',
      name: 'AiKnowledge',
      component: '/ai/knowledge',
      meta: { title: '知识库中心', icon: 'ri:book-open-line', keepAlive: true }
    },
    {
      path: 'knowledge/detail/:id',
      name: 'AiKnowledgeDetail',
      component: '/ai/knowledge/detail',
      meta: {
        title: '知识库详情',
        isHide: true,
        keepAlive: false,
        activePath: '/ai/knowledge'
      }
    },
    {
      path: 'dataset',
      name: 'AiDataset',
      component: '/ai/dataset',
      meta: { title: '智能体问数', icon: 'ri:bar-chart-box-line', keepAlive: true }
    },
    {
      path: 'dataset/config/:id',
      name: 'AiDatasetConfig',
      component: '/ai/dataset/config',
      meta: {
        title: '问数配置',
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
        title: '问数对话',
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
        title: '仪表盘设计',
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
      meta: { title: '大模型配置', icon: 'ri:cpu-line', keepAlive: true }
    },
    {
      path: 'prompt',
      name: 'AiPrompt',
      component: '/ai/prompt',
      meta: { title: '提示词配置', icon: 'ri:file-text-line', keepAlive: true }
    },
    {
      path: 'mcp',
      name: 'AiMcp',
      component: '/ai/mcp',
      meta: { title: 'MCP 工具箱', icon: 'ri:plug-line', keepAlive: true }
    },
    {
      path: 'vector',
      name: 'AiVector',
      component: '/ai/vector',
      meta: { title: '向量库配置', icon: 'ri:database-2-line', keepAlive: true }
    },
    {
      path: 'datasource',
      name: 'AiDatasource',
      component: '/ai/datasource',
      meta: { title: '数据库配置', icon: 'ri:database-line', keepAlive: true }
    },
    {
      path: 'channel',
      name: 'AiChannel',
      component: '/ai/channel',
      meta: { title: '消息渠道', icon: 'ri:message-3-line', keepAlive: true }
    },
    // —— AI 运维 ——
    {
      path: 'secret',
      name: 'AiSecret',
      component: '/ai/secret',
      meta: { title: '超级密钥', icon: 'ri:key-2-line', keepAlive: true }
    },
    {
      path: 'conversation',
      name: 'AiConversation',
      component: '/ai/conversation',
      meta: { title: '对话记录', icon: 'ri:chat-history-line', keepAlive: true }
    },
    {
      path: 'billing',
      name: 'AiBilling',
      component: '/ai/billing',
      meta: { title: '账单记录', icon: 'ri:bill-line', keepAlive: true }
    },
    {
      path: 'quota',
      name: 'AiQuota',
      component: '/ai/quota',
      meta: { title: '配额与预警', icon: 'ri:speed-line', keepAlive: true }
    },
    // —— 智能体集合 ——
    {
      path: 'gen/mindmap',
      name: 'AiGenMindmap',
      component: '/ai/gen/mindmap',
      meta: { title: '思维导图', icon: 'ri:mind-map', keepAlive: false }
    },
    {
      path: 'gen/poster',
      name: 'AiGenPoster',
      component: '/ai/gen/poster',
      meta: { title: '海报生成', icon: 'ri:image-line', keepAlive: false }
    },
    {
      path: 'gen/article',
      name: 'AiGenArticle',
      component: '/ai/gen/article',
      meta: { title: '文章生成', icon: 'ri:article-line', keepAlive: false }
    },
    {
      path: 'gen/product',
      name: 'AiGenProduct',
      component: '/ai/gen/product',
      meta: { title: '产品描述', icon: 'ri:shopping-bag-line', keepAlive: false }
    },
    {
      path: 'gen/marketing',
      name: 'AiGenMarketing',
      component: '/ai/gen/marketing',
      meta: { title: '营销文案', icon: 'ri:megaphone-line', keepAlive: false }
    },
    {
      path: 'gen/svg',
      name: 'AiGenSvg',
      component: '/ai/gen/svg',
      meta: { title: 'SVG 生成', icon: 'ri:shape-line', keepAlive: false }
    },
    {
      path: 'gen/layout',
      name: 'AiGenLayout',
      component: '/ai/gen/layout',
      meta: { title: '自动排版', icon: 'ri:layout-line', keepAlive: false }
    }
  ]
}
