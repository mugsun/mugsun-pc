<!-- 系统 logo：品牌方标（与 docs.mugsun.com 一致）+ 实时渲染字标 MUGSUN -->
<template>
  <div
    class="art-logo"
    :class="{ 'art-logo--on-dark': onDark }"
    :style="rootStyle"
    role="img"
    aria-label="Mugsun"
  >
    <span v-if="mark" class="art-logo__mark">
      <img :src="markSrc" alt="" draggable="false" />
    </span>
    <span v-if="wordmark" class="art-logo__word" aria-hidden="true">MUGSUN</span>
  </div>
</template>

<script setup lang="ts">
  import markLarge from '@/assets/brand/mugsun-icon-dark.svg'
  import markSmall from '@/assets/brand/mugsun-icon-simple-small.svg'

  defineOptions({ name: 'ArtLogo' })

  interface Props {
    /** 方标边长（px） */
    size?: number | string
    /** 是否显示方标（双栏菜单右栏只显示字标） */
    mark?: boolean
    /** 是否显示字标 */
    wordmark?: boolean
    /** 字标字号（px） */
    wordSize?: number | string
    /** 字标颜色，跟随菜单主题 systemNameColor */
    wordColor?: string
    /** 背景为深色时加 1px 内描边 */
    onDark?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 32,
    mark: true,
    wordmark: false,
    wordSize: 18,
    wordColor: 'var(--art-gray-800)',
    onDark: false
  })

  const toNum = (v: number | string) => {
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v))
    return Number.isFinite(n) ? n : 32
  }

  /** 28px 以下换简版，避免细节糊成一团 */
  const markSrc = computed(() => (toNum(props.size) < 28 ? markSmall : markLarge))

  const rootStyle = computed(() => {
    const size = toNum(props.size)
    return {
      '--art-logo-size': `${size}px`,
      '--art-logo-radius': `${Math.round(size * 0.22)}px`,
      '--art-logo-word-size': `${toNum(props.wordSize)}px`,
      '--art-logo-word-color': props.wordColor
    }
  })
</script>

<style scoped>
  @font-face {
    font-family: 'Mugsun Saira';
    font-style: normal;
    font-weight: 600;
    src: url('@/assets/brand/fonts/mugsun-saira-600.woff2') format('woff2');
    font-display: swap;
    unicode-range: U+0047, U+004D, U+004E, U+0053, U+0055;
  }

  .art-logo {
    display: flex;
    flex-shrink: 0;
    gap: 10px;
    align-items: center;
    width: fit-content;
    line-height: 1;
  }

  .art-logo__mark {
    position: relative;
    display: block;
    flex-shrink: 0;
    width: var(--art-logo-size);
    height: var(--art-logo-size);
    overflow: hidden;
    border-radius: var(--art-logo-radius);
  }

  .art-logo__mark img {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }

  /* 深色背景：1px 内描边，保证方标边缘可辨 */
  .art-logo--on-dark .art-logo__mark::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 12%);
  }

  .art-logo__word {
    font-family:
      'Mugsun Saira',
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
    font-size: var(--art-logo-word-size);
    font-weight: 600;
    color: var(--art-logo-word-color);
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
</style>
