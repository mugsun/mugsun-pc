import type { AppRouteRecord } from '@/types/router'

/** 按方案保留菜单。配置页始终留下，避免配完方案后找不到入口。 */
export function filterMenusByScheme(list: AppRouteRecord[], menuIds: string[]): AppRouteRecord[] {
  const allowed = new Set(menuIds.map((id) => String(id)))
  const walk = (nodes: AppRouteRecord[]): AppRouteRecord[] => {
    const kept: AppRouteRecord[] = []
    for (const node of nodes || []) {
      const children = node.children?.length ? walk(node.children) : []
      const id = node.id == null ? '' : String(node.id)
      const path = String(node.path || '')
      const configPage = path === '/system/top-menu' || path.endsWith('/top-menu')
      if (allowed.has(id) || children.length > 0 || configPage) {
        kept.push({ ...node, children })
      }
    }
    return kept
  }
  return walk(list)
}
