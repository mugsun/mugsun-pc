<!--
  行为验证码弹层（多题型）：按 challenge.type 分发到 Slider / Rotate / Click / Jigsaw 面板。
  壳负责取题、过期换题、校验、失败 / 过期 / 限流 / skip(40014) 与 inputMode 切换；面板只负责交互与 answer 构造。
  未知题型 → emit('fallback')，由页面回退旧数字码。
-->
<template>
  <ElDialog
    :model-value="visible"
    :title="t('pages.auth.slider.title')"
    width="min(360px, calc(100vw - 16px))"
    class="captcha-dialog"
    append-to-body
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => !v && handleClose()"
    @opened="onOpened"
  >
    <div
      ref="wrapRef"
      class="captcha-box"
      :class="{ 'is-shaking': shaking }"
      :data-status="status"
      :data-type="challenge?.type || ''"
    >
      <component
        :is="panel"
        v-if="panel && challenge && status !== 'loading'"
        ref="panelRef"
        :key="challenge.captchaId + ':' + displayWidth"
        :challenge="challenge"
        :width="displayWidth"
        :disabled="!interactive"
        :input-mode="declaredMode"
        @submit="submit"
        @want-mode="switchMode"
      >
        <template #overlay>
          <div v-if="status === 'success'" class="cp-mask cp-mask--ok" aria-hidden="true">✓</div>
          <div v-else-if="status === 'limited' || status === 'error'" class="cp-mask">
            <span>{{ statusText }}</span>
            <button v-if="status === 'error'" type="button" class="cp-btn" @click="load()">
              {{ t('pages.auth.slider.retry') }}
            </button>
          </div>
          <div v-else-if="status === 'verifying'" class="cp-mask cp-mask--soft">{{
            statusText
          }}</div>
        </template>
      </component>
      <div v-else class="cp-skeleton" :style="{ width: `${displayWidth}px` }">
        <span>{{ statusText }}</span>
        <button
          v-if="status === 'error' || status === 'limited'"
          type="button"
          class="cp-btn"
          :disabled="status === 'limited'"
          @click="load()"
        >
          {{ t('pages.auth.slider.retry') }}
        </button>
      </div>

      <div class="cp-toolbar" :style="{ width: `${displayWidth}px` }">
        <button
          type="button"
          class="cp-link"
          :disabled="status === 'loading' || status === 'verifying' || status === 'limited'"
          @click="switchMode(declaredMode === 'keyboard' ? 'pointer' : 'keyboard', true)"
        >
          {{
            declaredMode === 'keyboard'
              ? t('pages.auth.slider.usePointer')
              : t('pages.auth.slider.useKeyboard')
          }}
        </button>
        <button
          type="button"
          class="cp-link"
          :aria-label="t('pages.auth.slider.refresh')"
          :disabled="status === 'verifying' || status === 'limited' || status === 'loading'"
          @click="load()"
        >
          ↻ {{ t('pages.auth.slider.refresh') }}
        </button>
      </div>
      <div class="cp-sr-only" aria-live="polite" role="status">{{ announce }}</div>
    </div>
  </ElDialog>
</template>

<script setup lang="ts">
  import { type Component } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    fetchCaptchaChallenge,
    fetchCaptchaVerify,
    type CaptchaChallenge,
    type CaptchaScene
  } from '@/api/captcha'
  import {
    buildPayload,
    clampDisplayWidth,
    classifyCaptchaError,
    classifyVerifyError,
    resolvePanel,
    type CaptchaPanelKind,
    type InputMode,
    type PanelSubmit
  } from '@/utils/captcha'
  import SliderPanel from './SliderPanel.vue'
  import RotatePanel from './RotatePanel.vue'
  import ClickPanel from './ClickPanel.vue'
  import JigsawPanel from './JigsawPanel.vue'

  defineOptions({ name: 'CaptchaDialog' })

  const props = withDefaults(
    defineProps<{
      scene: CaptchaScene
      clientId?: string
      tenantId?: string
      visible?: boolean
    }>(),
    { clientId: 'web', tenantId: undefined, visible: false }
  )
  const emit = defineEmits<{
    success: [captchaToken: string]
    /** challenge 返回 40014：当前无需验证，调用方直接提交 */
    skip: []
    /** challenge 返回前端不认识的题型：调用方回退旧数字码 */
    fallback: []
    close: []
    'update:visible': [value: boolean]
  }>()

  const { t } = useI18n()

  const PANELS: Record<CaptchaPanelKind, Component> = {
    slider: SliderPanel,
    rotate: RotatePanel,
    click: ClickPanel,
    jigsaw: JigsawPanel
  }

  type Status = 'loading' | 'ready' | 'verifying' | 'success' | 'failed' | 'limited' | 'error'
  const status = ref<Status>('loading')
  const challenge = ref<CaptchaChallenge | null>(null)
  const shaking = ref(false)
  const announce = ref('')
  const retryLeft = ref(0)
  const displayWidth = ref(320)
  const wrapRef = ref<HTMLElement>()
  const panelRef = ref<{ focus?: () => void } | null>(null)
  const declaredMode = ref<InputMode>('pointer')
  let wantedMode: InputMode = 'pointer'
  let expireTimer: ReturnType<typeof setTimeout> | null = null
  let limitTimer: ReturnType<typeof setInterval> | null = null
  let alive = false
  let seq = 0

  const panel = computed(() => {
    const kind = resolvePanel(challenge.value?.type)
    return kind ? PANELS[kind] : null
  })
  const interactive = computed(() => status.value === 'ready' && !!challenge.value)

  const clearTimers = () => {
    if (expireTimer) clearTimeout(expireTimer)
    if (limitTimer) clearInterval(limitTimer)
    expireTimer = limitTimer = null
  }

  const measure = () => {
    const w = wrapRef.value?.clientWidth
    if (w) displayWidth.value = clampDisplayWidth(w)
  }

  async function load(mode: InputMode = wantedMode) {
    wantedMode = mode
    const my = ++seq
    clearTimers()
    status.value = 'loading'
    try {
      const data = await fetchCaptchaChallenge({
        scene: props.scene,
        clientId: props.clientId,
        tenantId: props.scene === 'sms' ? undefined : props.tenantId || undefined,
        inputMode: mode
      })
      if (!alive || my !== seq) return
      if (!resolvePanel(data?.type)) {
        // 未知题型：回退旧数字码
        clearTimers()
        emit('fallback')
        emit('update:visible', false)
        return
      }
      challenge.value = data
      declaredMode.value = data.inputMode || mode
      wantedMode = declaredMode.value
      status.value = 'ready'
      expireTimer = setTimeout(
        () => {
          announce.value = t('pages.auth.slider.expired')
          load(wantedMode)
        },
        Math.max(5, data.expireSeconds || 120) * 1000
      )
      if (mode === 'keyboard') nextTick(() => panelRef.value?.focus?.())
    } catch (err) {
      if (my === seq) handleError(err)
    }
  }

  /** 切换 pointer↔keyboard：作废当前题并重新取题（keyboard 题只会是 SLIDER / ROTATE） */
  async function switchMode(mode: InputMode, force = false) {
    if (!force && declaredMode.value === mode && status.value === 'ready') return
    await load(mode)
    announce.value = t('pages.auth.slider.modeSwitched')
  }

  function startLimit(seconds: number) {
    clearTimers()
    status.value = 'limited'
    retryLeft.value = seconds
    announce.value = t('pages.auth.slider.limited', { s: seconds })
    limitTimer = setInterval(() => {
      retryLeft.value--
      if (retryLeft.value % 10 === 0 && retryLeft.value > 0) {
        announce.value = t('pages.auth.slider.limited', { s: retryLeft.value })
      }
      if (retryLeft.value <= 0) {
        clearTimers()
        load(wantedMode)
      }
    }, 1000)
  }

  function handleError(err: unknown, verifying = false) {
    if (!alive) return
    // v0.4：verify 阶段 40012 直接倒计时；连接错误按 40011 处理
    const info = verifying ? classifyVerifyError(err) : classifyCaptchaError(err)
    switch (info.kind) {
      case 'failed':
        announce.value = t('pages.auth.slider.failed')
        status.value = 'failed'
        shaking.value = true
        setTimeout(() => {
          shaking.value = false
          if (alive && status.value === 'failed') load(wantedMode)
        }, 700)
        return
      case 'expired':
        announce.value = t('pages.auth.slider.expired')
        load(wantedMode)
        return
      case 'rateLimited':
        startLimit(info.retryAfter ?? 60)
        return
      case 'disabled':
        clearTimers()
        emit('skip')
        emit('update:visible', false)
        return
    }
    status.value = 'error'
    announce.value = info.msg || t('pages.auth.slider.networkError')
  }

  async function submit(part: PanelSubmit) {
    const c = challenge.value
    if (!c || status.value !== 'ready') return
    status.value = 'verifying'
    try {
      const res = await fetchCaptchaVerify(
        buildPayload({
          captchaId: c.captchaId,
          displayWidth: displayWidth.value,
          inputMode: declaredMode.value,
          part
        })
      )
      if (!alive) return
      clearTimers()
      status.value = 'success'
      announce.value = t('pages.auth.slider.success')
      setTimeout(() => {
        if (!alive) return
        emit('success', res.captchaToken)
        emit('update:visible', false)
      }, 600)
    } catch (err) {
      handleError(err, true)
    }
  }

  const statusText = computed(() => {
    switch (status.value) {
      case 'loading':
        return t('pages.auth.slider.loading')
      case 'verifying':
        return t('pages.auth.slider.verifying')
      case 'success':
        return t('pages.auth.slider.success')
      case 'failed':
        return t('pages.auth.slider.failed')
      case 'limited':
        return t('pages.auth.slider.limited', { s: retryLeft.value })
      case 'error':
        return t('pages.auth.slider.networkError')
      default:
        return ''
    }
  })

  function handleClose() {
    emit('update:visible', false)
    emit('close')
  }

  function onOpened() {
    measure()
  }

  function start() {
    alive = true
    wantedMode = 'pointer'
    challenge.value = null
    nextTick(measure)
    load('pointer')
  }
  function stop() {
    alive = false
    seq++
    clearTimers()
  }

  watch(
    () => props.visible,
    (v) => (v ? start() : stop())
  )
  onMounted(() => {
    if (props.visible) start()
  })
  onBeforeUnmount(stop)

  defineExpose({ refresh: () => load() })
</script>

<style>
  .captcha-dialog .el-dialog__body {
    padding-right: 4px;
    padding-left: 4px;
    overflow-x: auto;
  }

  .captcha-box,
  .captcha-box .cp-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    width: 100%;
    min-width: 260px;
    user-select: none;
  }

  .captcha-box .cp-stage,
  .captcha-box .cp-rotate-stage {
    position: relative;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-box .cp-img {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .captcha-box .cp-piece {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    filter: drop-shadow(0 0 4px rgb(0 0 0 / 35%));
  }

  .captcha-box .cp-rotate-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .captcha-box .cp-rotate-ring {
    overflow: hidden;
    border: 3px solid var(--el-color-primary-light-5);
    border-radius: 50%;
    box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
  }

  .captcha-box .cp-rotate-img {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .captcha-box .cp-skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    height: 180px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-box[data-status='loading'] .cp-skeleton {
    animation: cp-pulse 1.2s ease-in-out infinite;
  }

  .captcha-box .cp-mask {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    font-size: 14px;
    color: var(--el-text-color-primary);
    text-align: center;
    background: color-mix(in srgb, var(--el-bg-color) 82%, transparent);
  }

  .captcha-box .cp-mask--soft {
    background: color-mix(in srgb, var(--el-bg-color) 45%, transparent);
  }

  .captcha-box .cp-mask--ok {
    font-size: 48px;
    color: var(--el-color-success);
  }

  .captcha-box .cp-track {
    position: relative;
    height: 44px;
    overflow: hidden;
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-box .cp-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--el-color-primary-light-8);
  }

  .captcha-box .cp-track-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 44px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    pointer-events: none;
  }

  .captcha-box .cp-handle {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 42px;
    font-size: 18px;
    color: #fff;
    touch-action: none;
    cursor: grab;
    background: var(--el-color-primary);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-box .cp-handle:active {
    cursor: grabbing;
  }

  .captcha-box[data-status='failed'] .cp-handle {
    background: var(--el-color-danger);
  }

  .captcha-box[data-status='success'] .cp-handle {
    background: var(--el-color-success);
  }

  .captcha-box .cp-handle[aria-disabled='true'] {
    cursor: not-allowed;
  }

  .captcha-box .cp-click-hint {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }

  .captcha-box .cp-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 38px;
    height: 38px;
    padding: 0 6px;
    font-size: 22px;
    font-weight: 600;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: var(--el-border-radius-base);
  }

  .captcha-box .cp-chip--icon {
    width: 38px;
    padding: 4px;
  }

  .captcha-box .cp-chip.is-done {
    opacity: 0.45;
  }

  .captcha-box .cp-click-stage {
    touch-action: manipulation;
    cursor: crosshair;
  }

  .captcha-box .cp-marker {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    background: var(--el-color-primary);
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgb(0 0 0 / 30%);
    transform: translate(-50%, -50%);
  }

  /* 扩大点击热区到 44px */
  .captcha-box .cp-marker::before {
    position: absolute;
    inset: -8px;
    content: '';
  }

  .captcha-box .cp-actions,
  .captcha-box .cp-toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .captcha-box .cp-progress {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .captcha-box .cp-btn,
  .captcha-box .cp-link {
    min-height: 44px;
    padding: 0 14px;
    font-size: 14px;
    cursor: pointer;
    border-radius: var(--el-border-radius-base);
  }

  .captcha-box .cp-btn {
    color: var(--el-color-primary);
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
  }

  .captcha-box .cp-btn--primary {
    color: #fff;
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }

  .captcha-box .cp-link {
    padding: 0 6px;
    color: var(--el-color-primary);
    background: transparent;
    border: 0;
  }

  .captcha-box .cp-btn:disabled,
  .captcha-box .cp-link:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .captcha-box .cp-jigsaw {
    display: grid;
    gap: 2px;
    background: var(--el-border-color-lighter);
  }

  .captcha-box .cp-tile {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    touch-action: none;
    cursor: pointer;
    background-repeat: no-repeat;
    border: 0;
    transition: transform 0.15s;
  }

  .captcha-box .cp-tile.is-selected,
  .captcha-box .cp-tile.is-over {
    outline: 3px solid var(--el-color-primary);
    outline-offset: -3px;
    transform: scale(0.96);
  }

  .captcha-box .cp-handle:focus-visible,
  .captcha-box .cp-btn:focus-visible,
  .captcha-box .cp-link:focus-visible,
  .captcha-box .cp-marker:focus-visible,
  .captcha-box .cp-tile:focus-visible {
    outline: 3px solid var(--el-color-primary-light-3);
    outline-offset: 2px;
  }

  .captcha-box .cp-sr-only {
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

  .captcha-box.is-shaking .cp-stage,
  .captcha-box.is-shaking .cp-rotate-stage,
  .captcha-box.is-shaking .cp-track {
    animation: cp-shake 0.5s;
  }

  @keyframes cp-shake {
    0%,
    100% {
      transform: translateX(0);
    }

    20%,
    60% {
      transform: translateX(-6px);
    }

    40%,
    80% {
      transform: translateX(6px);
    }
  }

  @keyframes cp-pulse {
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .captcha-box.is-shaking .cp-stage,
    .captcha-box.is-shaking .cp-rotate-stage,
    .captcha-box.is-shaking .cp-track,
    .captcha-box .cp-skeleton,
    .captcha-box .cp-tile {
      transition: none;
      animation: none;
    }
  }
</style>
