<!-- 登录、注册、忘记密码左侧品牌区（Mugsun） -->
<template>
  <div class="login-left-view">
    <div class="logo">
      <ArtLogo class="icon" size="40" />
      <h1 class="title">{{ AppConfig.systemInfo.name }}</h1>
    </div>

    <div class="hero">
      <div class="hero-glow" aria-hidden="true" />
      <div class="left-img">
        <ThemeSvg :src="loginIcon" size="100%" />
      </div>
    </div>

    <div class="text-wrap">
      <h2>{{ $t('login.leftView.title') }}</h2>
      <p>{{ $t('login.leftView.subTitle') }}</p>
    </div>

    <div class="mesh" aria-hidden="true">
      <span class="mesh-orb mesh-orb-a" />
      <span class="mesh-orb mesh-orb-b" />
      <span class="mesh-grid" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import loginIcon from '@imgs/svg/login_icon.svg'

  defineProps<{
    hideContent?: boolean
  }>()
</script>

<style lang="scss" scoped>
  $primary-light-7: var(--el-color-primary-light-7);
  $primary-light-8: var(--el-color-primary-light-8);
  $primary-light-9: var(--el-color-primary-light-9);
  $primary-base: var(--el-color-primary);
  $main-bg: var(--default-box-color);

  $bg-mix: color-mix(in srgb, $primary-light-9 88%, $main-bg);

  .login-left-view {
    position: relative;
    box-sizing: border-box;
    width: 58vw;
    height: 100%;
    padding: 28px 32px;
    overflow: hidden;
    background: $bg-mix;

    .logo {
      position: relative;
      z-index: 20;
      display: flex;
      gap: 12px;
      align-items: center;

      .title {
        margin: 0;
        font-size: 22px;
        font-weight: 650;
        color: var(--art-gray-900);
        letter-spacing: 0.02em;
      }
    }

    .hero {
      position: absolute;
      inset: 12% 8% 22%;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .hero-glow {
      position: absolute;
      width: min(72%, 420px);
      aspect-ratio: 1;
      pointer-events: none;
      background: radial-gradient(
        circle,
        color-mix(in srgb, $primary-base 22%, transparent) 0%,
        transparent 70%
      );
      filter: blur(8px);
      animation: glowPulse 5s ease-in-out infinite;
    }

    .left-img {
      position: relative;
      z-index: 1;
      width: min(78%, 560px);
      aspect-ratio: 4 / 3;
      animation: riseIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;

      :deep(.theme-svg) {
        width: 100%;
        height: 100%;
      }
    }

    .text-wrap {
      position: absolute;
      right: 0;
      bottom: 56px;
      left: 0;
      z-index: 20;
      padding: 0 48px;
      text-align: center;
      animation: riseIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;

      h2 {
        margin: 0;
        font-size: 26px;
        font-weight: 650;
        line-height: 1.35;
        color: var(--art-gray-900) !important;
      }

      p {
        max-width: 420px;
        margin: 12px auto 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--art-gray-600) !important;
      }
    }

    .mesh {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }

    .mesh-orb {
      position: absolute;
      filter: blur(2px);
      border-radius: 50%;
    }

    .mesh-orb-a {
      top: -8%;
      right: -6%;
      width: 320px;
      height: 320px;
      background: color-mix(in srgb, $primary-light-8 70%, transparent);
      animation: floatA 12s ease-in-out infinite;
    }

    .mesh-orb-b {
      bottom: -10%;
      left: -8%;
      width: 280px;
      height: 280px;
      background: color-mix(in srgb, $primary-light-7 45%, transparent);
      animation: floatB 14s ease-in-out infinite;
    }

    .mesh-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(color-mix(in srgb, $primary-base 12%, transparent) 1px, transparent 1px),
        linear-gradient(
          90deg,
          color-mix(in srgb, $primary-base 12%, transparent) 1px,
          transparent 1px
        );
      background-size: 48px 48px;
      opacity: 0.35;
      mask-image: radial-gradient(ellipse 70% 60% at 50% 42%, #000 20%, transparent 75%);
    }

    @keyframes riseIn {
      from {
        opacity: 0;
        transform: translateY(18px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes glowPulse {
      0%,
      100% {
        opacity: 0.75;
        transform: scale(1);
      }

      50% {
        opacity: 1;
        transform: scale(1.06);
      }
    }

    @keyframes floatA {
      0%,
      100% {
        transform: translate(0, 0);
      }

      50% {
        transform: translate(-18px, 22px);
      }
    }

    @keyframes floatB {
      0%,
      100% {
        transform: translate(0, 0);
      }

      50% {
        transform: translate(16px, -14px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero-glow,
      .mesh-orb-a,
      .mesh-orb-b,
      .left-img,
      .text-wrap {
        animation: none !important;
      }
    }

    @media only screen and (width <= 1600px) {
      width: 54vw;

      .text-wrap {
        bottom: 40px;

        h2 {
          font-size: 22px;
        }
      }
    }

    @media only screen and (width <= 1180px) {
      width: auto;
      height: auto;
      padding: 0;
      background: transparent;

      .hero,
      .text-wrap,
      .mesh {
        display: none;
      }

      .logo {
        display: none;
      }
    }
  }

  .dark .login-left-view {
    background: color-mix(in srgb, $primary-light-9 45%, #070707);

    @media only screen and (width <= 1180px) {
      background: transparent;
    }

    .mesh-orb-a {
      background: color-mix(in srgb, $primary-base 18%, transparent);
    }

    .mesh-orb-b {
      background: color-mix(in srgb, $primary-light-7 22%, transparent);
    }
  }
</style>
