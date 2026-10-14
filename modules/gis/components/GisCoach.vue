<!-- 地图页底部操作提示：宽屏贴右下，窄屏改为整行横条并可收起（UX-114）。 -->
<template>
  <p v-if="!closed" class="gis-hud gis-hud-status gis-coach" data-test="gis-coach">
    <span class="gis-coach-text"><slot /></span>
    <button
      type="button"
      class="gis-coach-close"
      data-test="gis-coach-close"
      :aria-label="$t('pages.gis.coachClose')"
      :title="$t('pages.gis.coachClose')"
      @click="closed = true"
    >
      ×
    </button>
  </p>
</template>

<script setup lang="ts">
  import { ref } from 'vue'

  defineOptions({ name: 'GisCoach' })

  const closed = ref(false)
</script>

<style scoped>
  .gis-coach {
    margin: 0;
    line-height: 1.5;
  }

  .gis-coach-text {
    flex: 1;
    min-width: 0;
  }

  .gis-coach-close {
    display: none;
    flex-shrink: 0;
    align-self: flex-start;
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 16px;
    line-height: 20px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 4px;
  }

  .gis-coach-close:hover {
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }

  @media (width <= 768px) {
    .gis-coach-close {
      display: inline-block;
    }
  }
</style>
