<template>
  <!-- 抽屉内容 chunk 加载中 / 加载失败时的顶栏：与正式顶栏同高同位，关闭按钮始终可用 -->
  <header class="ai-dchat__hd ai-dshell__hd" :data-state="state">
    <span
      v-if="state === 'loading'"
      class="ai-dshell__skeleton"
      data-testid="ai-drawer-title-skeleton"
      aria-hidden="true"
    />
    <span v-else class="ai-dshell__title">{{ $t('aiDrawer.title') }}</span>
    <div class="ai-dchat__tools">
      <template v-if="state === 'loading'">
        <ElButton text disabled class="ai-dshell__icon-btn" :aria-label="$t('aiDrawer.newChat')">
          <ElIcon :size="20"><Plus /></ElIcon>
        </ElButton>
        <ElButton
          v-if="canFullscreen"
          text
          disabled
          class="ai-dshell__icon-btn"
          :aria-label="$t('aiDrawer.fullscreen')"
        >
          <ElIcon :size="16"><FullScreen /></ElIcon>
        </ElButton>
      </template>
      <AiDrawerCloseButton @close="$emit('close')" />
    </div>
  </header>
</template>

<script setup lang="ts">
  import { FullScreen, Plus } from '@element-plus/icons-vue'
  import AiDrawerCloseButton from './AiDrawerCloseButton.vue'

  defineProps<{ state: 'loading' | 'error'; canFullscreen?: boolean }>()
  defineEmits<{ close: [] }>()
</script>

<style scoped>
  .ai-dchat__hd {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 8px 0 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .ai-dchat__tools {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    align-items: center;
  }

  .ai-dshell__skeleton {
    width: 120px;
    height: 16px;
    background: var(--el-border-color);
    border-radius: 4px;
    animation: ai-dshell-pulse 1.4s ease-in-out infinite;
  }

  .ai-dshell__title {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .ai-dshell__icon-btn.el-button {
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    color: var(--el-text-color-regular);
    border-radius: 8px;
  }

  @keyframes ai-dshell-pulse {
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-dshell__skeleton {
      animation: none;
    }
  }
</style>
