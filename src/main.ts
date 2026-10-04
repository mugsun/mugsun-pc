import App from './App.vue'
import { createApp, watch } from 'vue'
import { initStore } from './store'
import { initRouter } from './router'
import language from './locales'
import ElementPlus, { provideGlobalConfig } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import 'element-plus/dist/index.css'
import formCreate from '@form-create/element-ui'
import FcDesigner from '@form-create/designer'
import '@styles/core/tailwind.css'
import '@styles/index.scss'
import '@utils/sys/console.ts'
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { installTrackApi, setupTrack } from './plugins/track'
import { enableAi, enableGis, enableTrack } from '@/modules/flags'
import { useUserStore } from './store/modules/user'

/** MessageBox 渲染在组件树外，读的是 app.use 写入的全局 locale，不读 ConfigProvider。 */
function elementLocale(lang: string) {
  return lang === 'en' ? en : zhCn
}

const trackPluginMods = import.meta.glob<{
  setupTrack: (app: ReturnType<typeof createApp>) => void
  trackIdentify: (...args: unknown[]) => void
  trackReset: () => void
}>('../modules/track/plugin.ts')

const gisPickMods = import.meta.glob<{ registerGisPick: () => void }>(
  '../modules/gis/components/registerGisPick.ts'
)

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
  app.use(ElementPlus, { locale: elementLocale(userStore.language) })
  watch(
    () => userStore.language,
    (lang) => {
      provideGlobalConfig({ locale: elementLocale(lang) }, app, true)
    }
  )
  app.use(formCreate)
  app.use(FcDesigner)

  if (enableGis) {
    const loaders = Object.values(gisPickMods)
    if (loaders[0]) {
      const { registerGisPick } = await loaders[0]()
      registerGisPick()
    }
  }

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
