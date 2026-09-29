/**
 * 组件加载器
 *
 * 负责动态加载 Vue 组件。核心页在 src/views；GIS / 埋点 / AI 页在 modules 下对应 views。
 *
 * @module router/core/ComponentLoader
 * @author Mugsun
 */

import { h } from 'vue'

export class ComponentLoader {
  private modules: Record<string, () => Promise<any>>

  constructor() {
    const core = import.meta.glob('../../views/**/*.vue')
    const gis = import.meta.glob('../../../modules/gis/views/**/*.vue')
    const track = import.meta.glob('../../../modules/track/views/**/*.vue')
    const ai = import.meta.glob('../../../modules/ai/views/**/*.vue')
    this.modules = { ...core }
    for (const [k, loader] of Object.entries(gis)) {
      const rel = k.replace('../../../modules/gis/views', '../../views/gis')
      this.modules[rel] = loader
    }
    for (const [k, loader] of Object.entries(track)) {
      const rel = k.replace('../../../modules/track/views', '../../views/track')
      this.modules[rel] = loader
    }
    for (const [k, loader] of Object.entries(ai)) {
      const rel = k.replace('../../../modules/ai/views', '../../views/ai')
      this.modules[rel] = loader
    }
  }

  /**
   * 加载组件
   */
  load(componentPath: string): () => Promise<any> {
    if (!componentPath) {
      return this.createEmptyComponent()
    }

    const fullPath = `../../views${componentPath}.vue`
    const fullPathWithIndex = `../../views${componentPath}/index.vue`
    const module = this.modules[fullPath] || this.modules[fullPathWithIndex]

    if (!module) {
      console.error(
        `[ComponentLoader] 未找到组件: ${componentPath}，尝试过的路径: ${fullPath} 和 ${fullPathWithIndex}`
      )
      return this.createErrorComponent(componentPath)
    }

    return module
  }

  loadLayout(): () => Promise<any> {
    return () => import('@/views/index/index.vue')
  }

  loadIframe(): () => Promise<any> {
    return () => import('@/views/outside/Iframe.vue')
  }

  private createEmptyComponent(): () => Promise<any> {
    return () =>
      Promise.resolve({
        render() {
          return h('div', {})
        }
      })
  }

  private createErrorComponent(componentPath: string): () => Promise<any> {
    return () =>
      Promise.resolve({
        render() {
          return h('div', { class: 'route-error' }, `组件未找到: ${componentPath}`)
        }
      })
  }
}
