<!--
  结果提示：后端跳过了极区或跨 180° 的要素（响应 skipped > 0）时显示数量，并链到文档的限制说明。
-->
<template>
  <p v-if="count > 0" class="gis-skipped-hint" role="status" data-test="gis-skipped-hint">
    <span>{{ $t('pages.gis.skippedHint', { n: count }) }}</span>
    <a :href="docUrl" target="_blank" rel="noopener noreferrer" data-test="gis-skipped-doc">
      {{ $t('pages.gis.skippedHintDoc') }}
    </a>
  </p>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { skippedDocUrl } from '@/gis/skippedHint'

  defineOptions({ name: 'GisSkippedHint' })

  defineProps<{ count: number }>()

  const { locale } = useI18n()
  const docUrl = computed(() => skippedDocUrl(String(locale.value)))
</script>

<style scoped>
  .gis-skipped-hint {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--el-color-warning);
  }

  .gis-skipped-hint a {
    margin-left: 6px;
    color: var(--el-color-primary);
  }
</style>
