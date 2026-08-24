import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'                 // Store
import { initRouter } from './router'               // Router
import language from './locales'                    // 国际化
import ElementPlus from 'element-plus'              // form-create 动态渲染需全局注册
import 'element-plus/dist/index.css'                // element-plus 基础样式（置于主题前，主题覆盖生效）
import formCreate from '@form-create/element-ui'    // 低代码表单运行时渲染
import FcDesigner from '@form-create/designer'      // 低代码表单设计器
import '@styles/core/tailwind.css'                  // tailwind
import '@styles/index.scss'                         // 样式
import '@utils/sys/console.ts'                      // 控制台输出内容
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { setupTrack } from './plugins/track'         // 埋点（自监控）
import { registerGisPick } from '@/components/gis/registerGisPick'

document.addEventListener(
  'touchstart',
  function () {},
  { passive: false }
)

const app = createApp(App)
initStore(app)
initRouter(app)
setupGlobDirectives(app)
setupErrorHandle(app)
// 埋点须在 setupErrorHandle 之后挂接（errorHandler 链式保留既有处理），且 router 就绪、mount 之前
setupTrack(app)

app.use(ElementPlus)
app.use(formCreate)
app.use(FcDesigner)
registerGisPick()
app.use(language)
app.mount('#app')