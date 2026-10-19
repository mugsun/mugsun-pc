import { watch, type App } from 'vue'
import { provideGlobalConfig } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { useUserStore } from '@/store/modules/user'

/** 界面语言 → Element Plus 自带文案的 locale（主应用与 AI 抽屉共用这一份映射） */
export function elementLocale(lang: string) {
  return lang === 'en' ? en : zhCn
}

/**
 * 给一个 Vue app 写入 Element Plus 的 app 级全局 locale，并跟随用户语言切换。
 * MessageBox 等渲染在组件树外，不读 App.vue 的 ConfigProvider，所以要走 provideGlobalConfig。
 * 依赖：调用前 pinia 必须已经激活（主应用 initStore 里 setActivePinia），这里直接 useUserStore()。
 */
export function bindElementLocale(app: App): void {
  const userStore = useUserStore()
  provideGlobalConfig({ locale: elementLocale(userStore.language) }, app, true)
  watch(
    () => userStore.language,
    (lang) => provideGlobalConfig({ locale: elementLocale(lang) }, app, true)
  )
}
