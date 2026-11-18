import { watch, type App } from 'vue'
import { provideGlobalConfig } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import { useUserStore } from '@/store/modules/user'

/** Element Plus 弹层的 z-index 起算值：App.vue 的 ConfigProvider 和组件树外的全局配置必须是同一个数 */
export const ELEMENT_Z_INDEX = 3000

/** 界面语言 → Element Plus 自带文案的 locale（主应用与 AI 抽屉共用这一份映射） */
export function elementLocale(lang: string) {
  return lang === 'en' ? en : zhCn
}

/**
 * 给一个 Vue app 写入 Element Plus 的 app 级全局配置（locale + 弹层 z-index），并跟随用户语言切换。
 * MessageBox / Message / Notification 渲染在组件树外，不读 App.vue 的 ConfigProvider，所以要走 provideGlobalConfig。
 * provideGlobalConfig 每次整份替换全局配置：少了 zIndex，这些弹层会按默认的 2000 起算，
 * 落到按 ELEMENT_Z_INDEX 起算的对话框下面，提示和确认框被对话框盖住。
 * 依赖：调用前 pinia 必须已经激活（主应用 initStore 里 setActivePinia），这里直接 useUserStore()。
 */
export function bindElementLocale(app: App): void {
  const userStore = useUserStore()
  const config = (lang: string) => ({ locale: elementLocale(lang), zIndex: ELEMENT_Z_INDEX })
  provideGlobalConfig(config(userStore.language), app, true)
  watch(
    () => userStore.language,
    (lang) => provideGlobalConfig(config(lang), app, true)
  )
}
