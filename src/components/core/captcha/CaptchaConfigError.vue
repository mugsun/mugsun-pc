<!--
  验证码配置错误态：config 拉取失败（网络错误 / 非 2xx / 未知类型）时显示在表单的验证码位置。
  一句话说明 + 「重试」+ 错误编号（本次请求的 X-Trace-Id）；不弹 toast，polite live region 只播报一次。
  不回落任何旧验证码，配置就绪前页面的提交按钮保持不可用。
-->
<template>
  <div class="captcha-config">
    <div
      v-if="shown"
      class="captcha-config-error"
      data-test="captcha-config-error"
      :data-scene="scene"
    >
      <ElIcon class="captcha-config-error__icon" aria-hidden="true"><WarningFilled /></ElIcon>
      <div class="captcha-config-error__body">
        <p class="captcha-config-error__text" data-test="captcha-config-error-text">
          {{ gate.errorLead.value
          }}<span class="captcha-config-error__id" data-test="captcha-config-error-id">{{
            gate.errorIdPart.value
          }}</span>
        </p>
        <ElButton
          class="captcha-config-error__retry"
          size="small"
          :loading="gate.status.value === 'loading'"
          data-test="captcha-config-retry"
          @click="gate.loadConfig()"
        >
          {{ $t('pages.auth.captchaConfig.retry') }}
        </ElButton>
      </div>
    </div>
    <!-- 读屏：失败时 polite 读一次（不用 role=alert） -->
    <div class="captcha-config__sr" aria-live="polite" data-test="captcha-config-live">{{
      gate.liveText.value
    }}</div>
  </div>
</template>

<script setup lang="ts">
  import { WarningFilled } from '@element-plus/icons-vue'
  import type { CaptchaGate } from '@/hooks/core/useCaptchaGate'

  defineOptions({ name: 'CaptchaConfigError' })

  const props = defineProps<{ gate: CaptchaGate; scene?: string }>()

  /** 出错后保持显示到重新就绪（重试加载中不闪掉，按钮显示 loading） */
  const shown = ref(false)
  watch(
    () => props.gate.status.value,
    (s) => {
      if (s === 'error') shown.value = true
      else if (s === 'ready') shown.value = false
    },
    { immediate: true }
  )
</script>

<style lang="scss" scoped>
  .captcha-config-error {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px 12px;
    margin-bottom: 18px;
    color: var(--el-text-color-primary);
    background: var(--el-color-danger-light-9);
    border: 1px solid var(--el-color-danger-light-7);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-config-error__icon {
    flex-shrink: 0;
    margin-top: 2px;
    font-size: 16px;
    color: var(--el-color-danger);
  }

  .captcha-config-error__body {
    flex: 1;
    min-width: 0;
  }

  .captcha-config-error__text {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  /* 编号段整段换行，不在「（错误编号：」和编号之间断开；超长时才在编号内折行 */
  .captcha-config-error__id {
    display: inline-block;
    max-width: 100%;
    color: var(--el-text-color-regular);
    overflow-wrap: anywhere;
  }

  .captcha-config__sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
</style>
