<!-- 系统 logo（Mugsun 自有标记：层叠模块 + 节点） -->
<template>
  <div class="art-logo flex-cc" :style="logoStyle" role="img" aria-label="Mugsun">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" class="art-logo__svg">
      <rect width="64" height="64" rx="18" fill="currentColor" opacity="0.1" />
      <!-- 底层模块 -->
      <rect x="20" y="28" width="30" height="22" rx="6" fill="currentColor" opacity="0.28" />
      <!-- 中层模块 -->
      <rect x="14" y="20" width="30" height="22" rx="6" fill="currentColor" opacity="0.55" />
      <!-- 顶层模块 -->
      <rect x="20" y="12" width="30" height="22" rx="6" fill="currentColor" />
      <!-- 顶层高光条 -->
      <rect x="26" y="18" width="14" height="3.5" rx="1.75" class="art-logo__core" opacity="0.9" />
      <!-- 连接节点 -->
      <circle cx="46" cy="46" r="7" fill="currentColor" />
      <circle cx="46" cy="46" r="2.8" class="art-logo__core" />
    </svg>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'ArtLogo' })

  interface Props {
    /** logo 大小 */
    size?: number | string
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 36
  })

  const logoStyle = computed(() => {
    const n = typeof props.size === 'number' ? props.size : Number.parseFloat(String(props.size))
    const px = Number.isFinite(n) ? `${n}px` : String(props.size)
    return { width: px, height: px }
  })
</script>

<style scoped>
  .art-logo {
    flex-shrink: 0;
    color: var(--el-color-primary);
  }

  .art-logo__svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .art-logo__core {
    fill: var(--default-box-color, #fff);
  }
</style>
