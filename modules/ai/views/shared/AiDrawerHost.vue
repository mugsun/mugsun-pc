<template>
  <div class="ai-drawer-host">
    <button
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
        <AiDrawerChat
          v-if="visible"
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
  import { computed, defineAsyncComponent, ref } from 'vue'
  import { useEventListener, useStorage, useWindowSize } from '@vueuse/core'
  import {
    DRAWER_FULLSCREEN_BREAKPOINT,
    DRAWER_WIDTH_DEFAULT,
    DRAWER_WIDTH_MAX,
    DRAWER_WIDTH_MIN,
    DRAWER_WIDTH_STORAGE_KEY,
    clampDrawerWidth
  } from '../assistant/drawer/drawerLayout'

  /** 抽屉内容（含 vue-element-plus-x）按需加载：首屏和插件 chunk 都不带它 */
  const AiDrawerChat = defineAsyncComponent(() => import('../assistant/drawer/AiDrawerChat.vue'))

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
