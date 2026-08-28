import { createApp, type App } from 'vue'

/**
 * 在真实组件上下文中运行组合式函数：`onMounted` 等生命周期钩子需要宿主实例才会触发。
 * 返回值与 app 实例，测试结束调用 `app.unmount()` 释放。
 */
export function withSetup<T>(composable: () => T): { result: T; app: App } {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    }
  })
  app.mount(document.createElement('div'))
  return { result, app }
}
