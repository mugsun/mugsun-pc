import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'
import { initRouter } from './router'
import language from './locales'
import { bindElementLocale } from './locales/element'
import '@styles/core/tailwind.css'
import '@styles/index.scss'
import '@utils/sys/console.ts'
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { installTrackApi, setupTrack } from './plugins/track'
import { enableAi, enableTrack } from '@/modules/flags'

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

  // Element Plus 自带文案（MessageBox 等组件树外的也算）跟随界面语言
  bindElementLocale(app)

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
