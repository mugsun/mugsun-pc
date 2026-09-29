import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RouteEntry {
  path: string
  name: string
}

const pcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * 参与巡访的路由文件。GIS / 埋点 / AI 已迁到 modules/，系统管理仍在 src/router/modules。
 * 动态段（含 :id）不进巡访，那些页要带真实主键另测。
 */
const MODULE_FILES = [
  'src/router/modules/dashboard.ts',
  'modules/gis/routes.ts',
  'modules/track/routes.ts',
  'modules/ai/routes.ts',
  'src/router/modules/system.ts',
  'src/router/modules/saas.ts',
  'src/router/modules/openPlatform.ts'
]

/**
 * 从路由源码静态解析清单——巡访范围随路由文件自动保持同步，不手工维护列表。
 */
export function collectAdminRoutes(): RouteEntry[] {
  const routes: RouteEntry[] = []
  for (const file of MODULE_FILES) {
    const src = readFileSync(path.join(pcRoot, file), 'utf-8')
    const topPath = src.match(/path:\s*'(\/[^']+)'/)?.[1]
    if (!topPath) throw new Error(`无法解析顶级 path: ${file}`)
    const childRe = /path:\s*'([^'/][^']*)',\s*\n\s*name:\s*'([^']+)'/g
    let m: RegExpExecArray | null
    while ((m = childRe.exec(src)) !== null) {
      if (m[1].includes(':')) continue
      routes.push({ path: `${topPath}/${m[1]}`, name: m[2] })
    }
  }
  if (routes.length === 0) throw new Error('未解析到任何路由，检查路由文件结构')
  return routes
}
