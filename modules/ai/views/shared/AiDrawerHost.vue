<template>
  <div class="ai-drawer-host">
    <button
      ref="fabRef"
      class="ai-fab"
      type="button"
      :title="$t('aiShared.assistant')"
      :aria-label="$t('aiShared.assistant')"
      @click="$emit('open')"
    >
      <span>AI</span>
    </button>
    <ElDrawer
      :model-value="visible"
      direction="rtl"
      :size="drawerSize"
      :with-header="false"
      append-to-body
      class="ai-drawer"
      :class="{ 'is-resizing': resizing }"
      @update:model-value="$emit('update:visible', $event)"
      @closed="fabRef?.focus()"
    >
      <div class="ai-drawer__wrap">
        <div
          v-if="resizable"
          class="ai-drawer__resizer"
          role="separator"
          aria-orientation="vertical"
          :aria-label="$t('aiDrawer.resize')"
          :aria-valuenow="width"
          :aria-valuemin="DRAWER_WIDTH_MIN"
          :aria-valuemax="DRAWER_WIDTH_MAX"
          @pointerdown.prevent="startResize"
        />
        <component
          :is="AiDrawerChat"
          v-if="visible"
          :key="chatKey"
          :fullscreen="isFullscreen"
          :can-fullscreen="!forcedFullscreen"
          @toggle-fullscreen="fullscreen = !fullscreen"
          @close="$emit('update:visible', false)"
        />
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, defineAsyncComponent, defineComponent, h, ref, shallowRef } from 'vue'
  import { ElButton, ElIcon } from 'element-plus'
  import { Loading, WarningFilled } from '@element-plus/icons-vue'
  import { useI18n } from 'vue-i18n'
  import { useEventListener, useStorage, useWindowSize } from '@vueuse/core'
  import {
    DRAWER_FULLSCREEN_BREAKPOINT,
    DRAWER_WIDTH_DEFAULT,
    DRAWER_WIDTH_MAX,
    DRAWER_WIDTH_MIN,
    DRAWER_WIDTH_STORAGE_KEY,
    clampDrawerWidth
  } from '../assistant/drawer/drawerLayout'
  import {
    buildRetryUrl,
    decideOnFailure,
    parseFailedUrl,
    stripRetryParam
  } from '../assistant/drawer/chatChunkRetry'

  /** chunk 加载超过这个时间按失败处理，显示「重试」 */
  const CHAT_LOAD_TIMEOUT = 15_000

  const ChatLoading = defineComponent({
    name: 'AiDrawerChatLoading',
    setup() {
      const { t } = useI18n()
      return () =>
        h('div', { class: 'ai-drawer__state', role: 'status', 'aria-live': 'polite' }, [
          h(ElIcon, { class: 'is-loading', size: 20 }, () => h(Loading)),
          h('span', t('aiDrawer.loading'))
        ])
    }
  })

  const ChatError = defineComponent({
    name: 'AiDrawerChatError',
    setup() {
      const { t } = useI18n()
      return () =>
        h('div', { class: 'ai-drawer__state is-error', role: 'alert' }, [
          h(ElIcon, { size: 20 }, () => h(WarningFilled)),
          h('span', t('aiDrawer.loadFailed')),
          h(ElButton, { type: 'primary', size: 'small', onClick: reloadChat }, () =>
            t('aiDrawer.retry')
          )
        ])
    }
  })

  /**
   * 抽屉内容（含 vue-element-plus-x）按需加载：首屏和插件 chunk 都不带它。
   * 浏览器会缓存失败的动态 import（同一 URL 再 import 直接复用失败结果），
   * 所以入口 .js 失败时从报错里取出 URL，重试时加 ?retry=N 重新请求。
   * CSS、嵌套 chunk 失败或连续失败 MAX_CHAT_LOAD_FAILURES 次，改用整页刷新兜底，
   * 同一会话只自动刷新一次（见 chatChunkRetry.ts）。
   */
  let failedUrl: string | null = null
  let attempt = 0
  let consecutiveFailures = 0
  function sessionStore(): Storage | null {
    try {
      return window.sessionStorage
    } catch {
      return null
    }
  }
  function loadChat(): Promise<any> {
    const retryUrl = buildRetryUrl(failedUrl, attempt)
    const p = retryUrl
      ? import(/* @vite-ignore */ retryUrl)
      : import('../assistant/drawer/AiDrawerChat.vue')
    return p.then(
      (mod) => {
        consecutiveFailures = 0
        return mod
      },
      (e: unknown) => {
        consecutiveFailures++
        const url = parseFailedUrl(e)
        if (url) failedUrl = stripRetryParam(url)
        if (decideOnFailure(url, consecutiveFailures, sessionStore()) === 'reload') {
          window.location.reload()
        }
        throw e
      }
    )
  }

  function createChat() {
    return defineAsyncComponent({
      loader: loadChat,
      loadingComponent: ChatLoading,
      errorComponent: ChatError,
      delay: 200,
      timeout: CHAT_LOAD_TIMEOUT
    })
  }
  const AiDrawerChat = shallowRef(createChat())
  const chatKey = ref(0)
  function reloadChat() {
    attempt++
    AiDrawerChat.value = createChat()
    chatKey.value++
  }

  defineProps<{ visible: boolean }>()
  defineEmits<{ 'update:visible': [boolean]; open: [] }>()

  const { width: viewportWidth } = useWindowSize()
  const stored = useStorage(DRAWER_WIDTH_STORAGE_KEY, DRAWER_WIDTH_DEFAULT)
  const width = computed(() => clampDrawerWidth(stored.value, viewportWidth.value))
  const fullscreen = ref(false)
  const forcedFullscreen = computed(() => viewportWidth.value <= DRAWER_FULLSCREEN_BREAKPOINT)
  const isFullscreen = computed(() => forcedFullscreen.value || fullscreen.value)
  const resizable = computed(() => !isFullscreen.value)
  const drawerSize = computed(() => (isFullscreen.value ? '100%' : `${width.value}px`))

  /** 关闭（含 Esc）后焦点回到触发按钮 */
  const fabRef = ref<HTMLButtonElement | null>(null)

  const resizing = ref(false)
  function startResize() {
    resizing.value = true
  }
  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!resizing.value) return
    stored.value = clampDrawerWidth(viewportWidth.value - e.clientX, viewportWidth.value)
  })
  useEventListener(window, 'pointerup', () => {
    resizing.value = false
  })
</script>

<style scoped>
  /*
   * 右缘贴边小标签，叠在「帮助」标签上方（UX-110）：
   * 原来的 52px 圆钮在右下角，1440 宽下压住列表分页器和地图坐标读数。
   */
  .ai-fab {
    position: fixed;
    right: 0;
    bottom: 180px;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    padding: 10px 0;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border: none;
    border-radius: 8px 0 0 8px;
    box-shadow: 0 2px 12px rgb(0 0 0 / 15%);
    transition: opacity 0.2s;
  }

  .ai-fab:hover {
    opacity: 0.88;
  }

  /* 窄屏（UX-017）：与缩小后的帮助细条对齐、半透明 */
  @media screen and (width <= 640px) {
    .ai-fab {
      bottom: 120px;
      width: 24px;
      padding: 8px 0;
      font-size: 11px;
      opacity: 0.6;
    }
  }

  .ai-drawer__wrap {
    position: relative;
    height: 100%;
  }

  /* 左缘 6px 拖拽热区，悬停/拖动时显示 2px 品牌色竖线 */
  .ai-drawer__resizer {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 10;
    width: 6px;
    touch-action: none;
    cursor: col-resize;
  }

  .ai-drawer__resizer::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 2px;
    content: '';
    background: var(--el-color-primary);
    opacity: 0;
  }

  .ai-drawer__state {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .ai-drawer__state.is-error :deep(.el-icon) {
    color: var(--el-color-danger);
  }

  .ai-drawer__resizer:hover::after,
  .is-resizing .ai-drawer__resizer::after {
    opacity: 1;
  }
</style>

<style>
  /* 抽屉 append-to-body，scoped 选不到 */
  .ai-drawer.el-drawer .el-drawer__body {
    padding: 0;
    overflow: hidden;
  }

  .ai-drawer.is-resizing {
    user-select: none;
  }
</style>
