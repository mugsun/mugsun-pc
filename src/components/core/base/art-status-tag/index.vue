<!-- 状态标签：字典码 + 值 → 圆点 + 文字（状态指示风格，字典运行时驱动） -->
<template>
  <span class="art-status-tag">
    <span class="art-status-tag__dot" :style="{ backgroundColor: dotColor }" />
    <span class="art-status-tag__text">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
  import { computed, watchEffect } from 'vue'
  import { useDictStore } from '@/store/modules/dict'

  defineOptions({ name: 'ArtStatusTag' })

  const props = defineProps<{
    /** 字典码 */
    code: string
    /** 业务字段值 */
    value?: string | number | null
  }>()

  const store = useDictStore()
  // 字典码变化即确保加载；并发去重由 store 统一兜底
  watchEffect(() => {
    if (props.code) store.ensure([props.code])
  })

  const item = computed(() => store.getItem(props.code, props.value))
  const label = computed(
    () => item.value?.dictValue ?? (props.value == null ? '' : String(props.value))
  )
  const dotColor = computed(() => item.value?.color || 'var(--el-color-info)')
</script>

<style lang="scss" scoped>
  .art-status-tag {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    white-space: nowrap;

    &__dot {
      display: inline-block;
      flex-shrink: 0;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    &__text {
      line-height: 1;
    }
  }
</style>
