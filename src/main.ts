import App from './App.vue'
import { createApp, watch } from 'vue'
import { initStore } from './store'
import { initRouter } from './router'
import language from './locales'
import { provideGlobalConfig } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import '@styles/core/tailwind.css'
import '@styles/index.scss'
import '@utils/sys/console.ts'
import '@utils/ui/iconify-loader'
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { installTrackApi, setupTrack } from './plugins/track'
import { enableAi, enableTrack } from '@/modules/flags'
import { useUserStore } from './store/modules/user'

/**
 * MessageBox 渲染在组件树外，不读 App.vue 的 ConfigProvider，
 * 因此通过 provideGlobalConfig 写入 app 级全局 locale（组件与样式由 unplugin 按需引入）。
 */
function elementLocale(lang: string) {
  return lang === 'en' ? en : zhCn
}

const trackPluginMods = import.meta.glob<{
  setupTrack: (app: ReturnType<typeof createApp>) => void
  trackIdentify: (...args: unknown[]) => void
  trackReset: () => void
}>('../modules/track/plugin.ts')

const aiPluginMods = import.meta.glob<{ setupAi: (app: ReturnType<typeof createApp>) => void }>(
  '../modules/ai/plugin.ts'
)

async function bootstrap() {
  document.addEventListener('touchstart', function () {}, { passive: false })

  const app = createApp(App)
  initStore(app)
  initRouter(app)
  setupGlobDirectives(app)
  setupErrorHandle(app)

  if (enableTrack) {
    const loaders = Object.values(trackPluginMods)
    if (loaders[0]) {
      const track = await loaders[0]()
      installTrackApi({
        setupTrack: track.setupTrack,
        trackIdentify: track.trackIdentify,
        trackReset: track.trackReset
      })
      setupTrack(app)
    }
  }

  const userStore = useUserStore()
  provideGlobalConfig({ locale: elementLocale(userStore.language) }, app, true)
  watch(
    () => userStore.language,
    (lang) => {
      provideGlobalConfig({ locale: elementLocale(lang) }, app, true)
    }
  )

  if (enableAi) {
    const loaders = Object.values(aiPluginMods)
    if (loaders[0]) {
      const { setupAi } = await loaders[0]()
      setupAi(app)
    }
  }

  app.use(language)
  app.mount('#app')
}

void bootstrap()
