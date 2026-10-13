/**
 * form-create / FcDesigner 按需注册
 *
 * 仅由表单设计器、审批表单等页面引入，使这两个大包随对应路由 chunk 懒加载，
 * 不再进入 main 入口包。首次调用时向当前 app 全局注册（幂等）。
 *
 * @module plugins/form-create
 * @author Mugsun
 */
import { getCurrentInstance, type App } from 'vue'
import formCreate from '@form-create/element-ui'
import FcDesigner from '@form-create/designer'

const installed = new WeakMap<App, { formCreate?: boolean; designer?: boolean }>()

function currentApp(): App {
  const app = getCurrentInstance()?.appContext.app
  if (!app) throw new Error('[form-create] must be called inside setup()')
  return app
}

/** 注册 form-create 运行时（<FormCreate> 渲染） */
export function useFormCreate(): void {
  const app = currentApp()
  const state = installed.get(app) ?? {}
  if (!state.formCreate) {
    app.use(formCreate)
    state.formCreate = true
    installed.set(app, state)
  }
}

/** 注册 form-create 运行时 + FcDesigner 设计器 */
export function useFcDesigner(): void {
  useFormCreate()
  const app = currentApp()
  const state = installed.get(app)!
  if (!state.designer) {
    app.use(FcDesigner)
    state.designer = true
  }
}
