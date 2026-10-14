import { createApp, h, ref, watch } from 'vue'
import ElementPlus from 'element-plus'
import { hasPerm } from '@/utils/permission'
import { useUserStore } from '@/store/modules/user'
import i18n from '@/locales'
import AiDrawerHost from './views/shared/AiDrawerHost.vue'

let mounted = false
const visible = ref(false)
const allowed = ref(false)

/** 打开全局 AI 助手抽屉（无权限时 no-op） */
export function openAiAssistantDrawer(): void {
  if (!hasPerm('ai:assistant:chat')) return
  visible.value = true
}

function refreshAllowed() {
  allowed.value = hasPerm('ai:assistant:chat')
  if (!allowed.value) visible.value = false
}

/** 挂载右下角悬浮按钮 + 抽屉；仅持 ai:assistant:chat（或 *）时显示 */
export function setupAi(): void {
  if (mounted || typeof document === 'undefined') return
  mounted = true
  refreshAllowed()
  const el = document.createElement('div')
  el.id = 'mugsun-ai-drawer-host'
  document.body.appendChild(el)
  createApp({
    setup() {
      const userStore = useUserStore()
      watch(
        () => [userStore.isLogin, userStore.getUserInfo?.buttons],
        () => refreshAllowed(),
        { deep: true, immediate: true }
      )
      return () => {
        if (!allowed.value) return null
        return h(AiDrawerHost, {
          visible: visible.value,
          'onUpdate:visible': (v: boolean) => {
            visible.value = v
          },
          onOpen: () => {
            if (hasPerm('ai:assistant:chat')) visible.value = true
          }
        })
      }
    }
  })
    .use(ElementPlus)
    // 独立 app 也要装同一个 i18n 实例：AiDrawerHost 的 $t 和 ChatPanel 的 useI18n 都依赖它，
    // 且与主应用共用 locale，切换语言时同步
    .use(i18n)
    .mount(el)
}
