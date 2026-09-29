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
  .ai-fab {
    position: fixed;
    right: 28px;
    bottom: 28px;
    z-index: 3000;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border: none;
    border-radius: 50%;
    box-shadow: 0 4px 14px rgb(0 0 0 / 18%);
  }

  .ai-fab:hover {
    filter: brightness(1.05);
  }
</style>
