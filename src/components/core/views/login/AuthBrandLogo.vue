<!-- 授权页品牌标：方标随主题色 + 亮暗切换（规则见 utils/brand/themeLogo），字标 MUGSUN 为 Saira 600 实时文字 -->
<template>
  <div class="auth-brand-logo" :class="{ 'is-dark': isDark }" aria-label="mugsun" role="img">
    <img
      class="auth-brand-logo__icon"
      :class="{ 'is-outlined': choice.outlined }"
      :src="iconSrc"
      :data-logo="choice.file"
      alt=""
      draggable="false"
    />
    <span class="auth-brand-logo__word" aria-hidden="true">MUGSUN</span>
  </div>
</template>

<script setup lang="ts">
  import fallbackIcon from '@/assets/brand/mugsun-icon-dark.svg'
  import { useSettingStore } from '@/store/modules/setting'
  import { resolveThemeLogo } from '@/utils/brand/themeLogo'

  defineOptions({ name: 'AuthBrandLogo' })

  const themeIcons = import.meta.glob<string>('@/assets/brand/theme/*-icon.svg', {
    eager: true,
    import: 'default'
  })
  const iconByFile: Record<string, string> = Object.fromEntries(
    Object.entries(themeIcons).map(([path, url]) => [path.split('/').pop() as string, url])
  )

  const { isDark, systemThemeColor } = storeToRefs(useSettingStore())

  const choice = computed(() => resolveThemeLogo(systemThemeColor.value, isDark.value))
  const iconSrc = computed(() => iconByFile[choice.value.file] ?? fallbackIcon)
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

  .auth-brand-logo {
    --auth-logo-size: 32px;

    display: flex;
    flex-shrink: 0;
    gap: 10px;
    align-items: center;
    width: fit-content;
    line-height: 1;
  }

  .auth-brand-logo__icon {
    display: block;
    flex-shrink: 0;
    width: var(--auth-logo-size);
    height: var(--auth-logo-size);
    user-select: none;

    /* 与素材圆角一致：rx 260 / 1024 */
    border-radius: 25.39%;
  }

  .auth-brand-logo__icon.is-outlined {
    box-shadow: 0 0 0 1px var(--el-border-color-lighter);
  }

  .auth-brand-logo__word {
    font-family:
      'Mugsun Saira',
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      'Helvetica Neue',
      Arial,
      sans-serif;
    font-size: 20px;
    font-weight: 600;
    color: #1f2329;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .auth-brand-logo.is-dark .auth-brand-logo__word {
    color: #fff;
  }

  @media (width <= 640px) {
    .auth-brand-logo {
      --auth-logo-size: 28px;
    }

    .auth-brand-logo__word {
      font-size: 18px;
    }
  }

  @media (width < 360px) {
    .auth-brand-logo__word {
      display: none;
    }
  }
</style>
