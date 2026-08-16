import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RouteEntry {
  path: string
  name: string
}

const routerModulesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../src/router/modules'
)

/** 参与巡访的应用路由模块（顶级应用分组） */
const MODULE_FILES = [
  'dashboard.ts',
  'gis.ts',
  'track.ts',
  'system.ts',
  'saas.ts',
  'openPlatform.ts'
]

/**
 * 从 src/router/modules 静态解析路由清单——巡访范围随路由文件自动保持同步，
 * 不手工维护列表（防漂移）。
 */
export function collectAdminRoutes(): RouteEntry[] {
  const routes: RouteEntry[] = []
  for (const file of MODULE_FILES) {
    const src = readFileSync(path.join(routerModulesDir, file), 'utf-8')
    const topPath = src.match(/path:\s*'(\/[^']+)'/)?.[1]
    if (!topPath) throw new Error(`无法解析顶级 path: ${file}`)
    const childRe = /path:\s*'([^'/][^']*)',\s*\n\s*name:\s*'([^']+)'/g
    let m: RegExpExecArray | null
    while ((m = childRe.exec(src)) !== null) {
      routes.push({ path: `${topPath}/${m[1]}`, name: m[2] })
    }
  }
  if (routes.length === 0) throw new Error('未解析到任何路由，检查 router/modules 结构')
  return routes
}
