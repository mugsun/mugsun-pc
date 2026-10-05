import request from '@/utils/http'

/** 工作台概览：统计计数 + 图表聚合数据 */
export function fetchWorkbenchOverview() {
  return request.get<any>({ url: '/api/system/workbench/overview' })
}

/** 当前用户快捷入口 JSON（无则 null） */
export function fetchWorkbenchShortcuts() {
  return request.get<string | null>({ url: '/api/system/workbench/shortcuts' })
}

/** 保存当前用户快捷入口（原子 upsert） */
export function saveWorkbenchShortcuts(configJson: string) {
  return request.post<void>({
    url: '/api/system/workbench/shortcuts',
    data: { configJson },
    showSuccessMessage: true
  })
}
