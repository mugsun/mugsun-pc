<!--
  全局空状态（UX-118）：图标 + 一句标题 / 引导 + 主操作（actions 插槽）。
  视觉与 GIS 底图空状态 GisBasemapEmpty（pc#20）对齐：40px 主色图标、17px 标题、13px 说明、按钮间距 12px。
  列表空、图表无数据、筛选无结果都用它；error 态用红色图标。
-->
<template>
  <div class="art-empty-state" :class="[`is-${size}`, { 'is-error': error }]" role="status">
    <ArtSvgIcon :icon="error ? 'ri:error-warning-line' : icon" class="art-empty-state__icon" />
    <h3 v-if="title" class="art-empty-state__title">{{ title }}</h3>
    <p v-if="description" class="art-empty-state__desc">{{ description }}</p>
    <div v-if="$slots.actions" class="art-empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  defineOptions({ name: 'ArtEmptyState' })

  withDefaults(
    defineProps<{
      /** Iconify 图标名，默认收件箱 */
      icon?: string
      title?: string
      description?: string
      /** page：列表 / 整块区域；compact：图表、卡片内 */
      size?: 'page' | 'compact'
      error?: boolean
    }>(),
    { icon: 'ri:inbox-2-line', title: '', description: '', size: 'page', error: false }
  )
</script>

<style scoped>
  .art-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
  }

  .art-empty-state.is-compact {
    padding: 16px;
  }

  .art-empty-state__icon {
    font-size: 40px;
    color: var(--el-color-primary);
    opacity: 0.85;
  }

  .is-compact .art-empty-state__icon {
    font-size: 32px;
  }

  .is-error .art-empty-state__icon {
    color: var(--el-color-danger);
  }

  .art-empty-state__title {
    margin: 8px 0 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .is-compact .art-empty-state__title {
    font-size: 15px;
  }

  .art-empty-state__desc {
    max-width: 460px;
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  .art-empty-state__actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
  }
</style>
