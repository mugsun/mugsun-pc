import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'
import { initRouter } from './router'
import language from './locales'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import formCreate from '@form-create/element-ui'
import FcDesigner from '@form-create/designer'
import '@styles/core/tailwind.css'
import '@styles/index.scss'
import '@utils/sys/console.ts'
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { installTrackApi, setupTrack } from './plugins/track'
import { enableGis, enableTrack } from '@/modules/flags'

const trackPluginMods = import.meta.glob<{
  setupTrack: (app: ReturnType<typeof createApp>) => void
  trackIdentify: (...args: unknown[]) => void
  trackReset: () => void
}>('../modules/track/plugin.ts')

const gisPickMods = import.meta.glob<{ registerGisPick: () => void }>(
  '../modules/gis/components/registerGisPick.ts'
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

  app.use(ElementPlus)
  app.use(formCreate)
  app.use(FcDesigner)

  if (enableGis) {
    const loaders = Object.values(gisPickMods)
    if (loaders[0]) {
      const { registerGisPick } = await loaders[0]()
      registerGisPick()
    }
  }

  app.use(language)
  app.mount('#app')
}

void bootstrap()
