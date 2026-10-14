<!-- 详情 / 编辑页 id 不存在时的统一占位（UX-105）：不渲染可编辑的假页面，只给返回入口 -->
<template>
  <ElCard class="art-table-card ai-not-found" shadow="never">
    <ElResult icon="warning" :title="`${what}不存在或已删除`" :sub-title="`编号 ${id}`">
      <template #extra>
        <ElButton type="primary" @click="$router.push(backPath)">{{ backText }}</ElButton>
      </template>
    </ElResult>
  </ElCard>
</template>

<script setup lang="ts">
  defineProps<{ what: string; id: string; backPath: string; backText: string }>()
</script>

<style scoped>
  .ai-not-found {
    height: 100%;
  }
</style>
