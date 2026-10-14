<template>
  <ElTooltip :content="$t('aiDrawer.closeAssistant')" placement="bottom">
    <ElButton
      text
      class="ai-dclose"
      data-testid="ai-drawer-close"
      :aria-label="$t('aiDrawer.closeAssistant')"
      @click="$emit('close')"
    >
      <ElIcon :size="20"><Close /></ElIcon>
    </ElButton>
  </ElTooltip>
</template>

<script setup lang="ts">
  /**
   * 抽屉关闭按钮：加载中 / 加载失败 / 正常三种状态共用这一个组件，
   * 始终在 48px 顶栏最右侧同一位置（体验设计官 pc#71 规格）。
   */
  import { Close } from '@element-plus/icons-vue'

  defineEmits<{ close: [] }>()
</script>

<style scoped>
  .ai-dclose.el-button {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    color: var(--el-text-color-regular);
    border-radius: 8px;
  }

  .ai-dclose.el-button:hover,
  .ai-dclose.el-button:focus-visible {
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
  }

  /* --el-color-primary 即 #5D87FF；暗色沿用同一组变量 */
  .ai-dclose.el-button:focus-visible {
    outline: 2px solid var(--el-color-primary) !important;
    outline-offset: 2px;
  }

  /* 窄屏触控：点击区域 44×44 */
  @media screen and (width <= 640px) {
    .ai-dclose.el-button {
      width: 44px;
      height: 44px;
    }

    /* 44px 按钮放在 48px 顶栏里，外偏描边会被抽屉 overflow 裁掉，窄屏改为内偏 */
    .ai-dclose.el-button:focus-visible {
      outline-offset: -2px;
    }
  }
</style>
