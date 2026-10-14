<template>
  <div class="ai-drawer-host">
    <button class="ai-fab" type="button" title="AI 助手" @click="$emit('open')">
      <span>AI</span>
    </button>
    <ElDrawer
      :model-value="visible"
      title="AI 助手"
      direction="rtl"
      size="420px"
      append-to-body
      @update:model-value="$emit('update:visible', $event)"
    >
      <ChatPanel v-if="visible" compact />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import ChatPanel from '../assistant/ChatPanel.vue'

  defineProps<{ visible: boolean }>()
  defineEmits<{ 'update:visible': [boolean]; open: [] }>()
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

  /* 窄屏（UX-017）：缩小并贴边、半透明，少挡卡片内容 */
  @media screen and (width <= 640px) {
    .ai-fab {
      right: 12px;
      bottom: 16px;
      width: 40px;
      height: 40px;
      font-size: 13px;
      opacity: 0.75;
    }
  }
</style>
