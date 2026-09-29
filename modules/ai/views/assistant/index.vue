<template>
  <div class="ai-assistant-page art-full-height">
    <ElCard class="art-table-card ai-assistant-card" shadow="never">
      <ChatPanel />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ChatPanel from './ChatPanel.vue'
  defineOptions({ name: 'AiAssistant' })
</script>

<style scoped>
  .ai-assistant-card {
    height: 100%;
  }

  .ai-assistant-card :deep(.el-card__body) {
    height: 100%;
    padding: 0;
  }
</style>
