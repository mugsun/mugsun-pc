/**
 * 审批流 AI 节点本地 mock（AiApp 下拉）。
 * 仅由 loadPublishedAiFlows 在 DEV && VITE_FLOW_AI_MOCK=true 时动态 import；生产产物不含。
 */
export interface FlowAiAppOption {
  id: number | string
  name: string
  appType: string
  status: number
  description?: string
}

export function isFlowAiMockOn(
  env: { DEV?: boolean; VITE_FLOW_AI_MOCK?: string } = import.meta.env as {
    DEV?: boolean
    VITE_FLOW_AI_MOCK?: string
  }
): boolean {
  return (
    !!env.DEV &&
    String(env.VITE_FLOW_AI_MOCK ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}

export function buildFlowAiAppMock(): FlowAiAppOption[] {
  return [
    {
      id: 90001,
      name: '预审助手（mock）',
      appType: 'workflow',
      status: 1,
      description: 'DEV mock · workflow'
    },
    {
      id: 90002,
      name: '合规对话流（mock）',
      appType: 'chatflow',
      status: 1,
      description: 'DEV mock · chatflow'
    }
  ]
}
