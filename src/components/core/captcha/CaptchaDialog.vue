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
    <div ref="outerRef" class="captcha-outer" :style="outerStyle">
      <div
        ref="wrapRef"
        class="captcha-box"
        :class="{ 'is-shaking': shaking }"
        :data-status="status"
        :data-type="challenge?.type || ''"
        :style="boxStyle"
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
            v-if="status === 'noAccessible'"
            type="button"
            class="cp-btn cp-btn--primary"
            @click="switchMode('pointer', true)"
          >
            {{ t('pages.auth.slider.usePointer') }}
          </button>
          <button
            v-else-if="status === 'error' || status === 'limited'"
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
            v-show="status !== 'noAccessible'"
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
    classifyCaptchaError,
    classifyVerifyError,
    resolvePanel,
    shellLayout,
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

  type Status =
    | 'loading'
    | 'ready'
    | 'verifying'
    | 'success'
    | 'failed'
    | 'limited'
    | 'error'
    | 'noAccessible'
    | 'unavailable'
  const status = ref<Status>('loading')
  const challenge = ref<CaptchaChallenge | null>(null)
  const shaking = ref(false)
  const announce = ref('')
  const retryLeft = ref(0)
  const displayWidth = ref(320)
  /** 容器 < 260px 时整体缩放（上报宽度仍 ≥ 260，v0.6.1 #7） */
  const shellScale = ref(1)
  const boxHeight = ref(0)
  const wrapRef = ref<HTMLElement>()
  const outerRef = ref<HTMLElement>()
  let boxObserver: ResizeObserver | null = null
  const boxStyle = computed(() =>
    shellScale.value < 1
      ? {
          width: `${displayWidth.value}px`,
          transform: `scale(${shellScale.value})`,
          transformOrigin: 'top left'
        }
      : undefined
  )
  const outerStyle = computed(() =>
    shellScale.value < 1 && boxHeight.value
      ? { height: `${Math.ceil(boxHeight.value * shellScale.value)}px` }
      : undefined
  )
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
    const w = outerRef.value?.clientWidth
    if (!w) return
    const layout = shellLayout(w)
    displayWidth.value = layout.width
    shellScale.value = layout.scale
    if (!boxObserver && wrapRef.value && typeof ResizeObserver !== 'undefined') {
      boxObserver = new ResizeObserver(() => {
        boxHeight.value = wrapRef.value?.offsetHeight || 0
      })
      boxObserver.observe(wrapRef.value)
    }
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
          // 正在校验：交给校验结果处理（超过 TTL 时服务端回 40010 → 自动换题）
          if (status.value === 'verifying') return
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
      case 'unavailable':
        // 40016：验证方式暂不可用（素材缺失），不自动重试
        clearTimers()
        challenge.value = null
        status.value = 'unavailable'
        announce.value = t('pages.auth.slider.unavailable')
        return
      case 'noAccessible':
        // 40015：租户未启用键盘可操作题型，不自动重试，提示改用鼠标 / 触屏
        clearTimers()
        challenge.value = null
        status.value = 'noAccessible'
        announce.value = t('pages.auth.slider.noAccessible')
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
      // 等待期间本地 TTL 计时器已换题：旧题的 40010 / 40011 不再触发第二次取题
      if (challenge.value?.captchaId !== c.captchaId) return
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
      case 'noAccessible':
        return t('pages.auth.slider.noAccessible')
      case 'unavailable':
        return t('pages.auth.slider.unavailable')
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
    boxObserver?.disconnect()
    boxObserver = null
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

  .captcha-outer {
    width: 100%;
    overflow: hidden;
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

  .captcha-box .cp-rotate-piece {
    position: absolute;
    pointer-events: none;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgb(0 0 0 / 18%);
  }

  .captcha-box .cp-prompt-img {
    flex-shrink: 1;
    min-width: 0;
    max-width: calc(100% - 100px);
    height: auto;
    max-height: 36px;
    pointer-events: none;
    object-fit: contain;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
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
    padding: 0 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
    text-align: center;
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

  /* 旋转精调提示（无文字）：滑块外圈 2px #5D87FF 光环 + 轨道淡刻度；进入即显示，退出 150ms 淡出 */
  .captcha-box .cp-rotate-track {
    overflow: visible;
  }

  .captcha-box .cp-rotate-track .cp-fill {
    border-radius: inherit;
  }

  .captcha-box .cp-rotate-track::before {
    position: absolute;
    inset: 8px 0;
    pointer-events: none;
    content: '';
    background: repeating-linear-gradient(
      to right,
      var(--el-text-color-placeholder) 0 1px,
      transparent 1px 12px
    );
    opacity: 0;
    transition: opacity 150ms ease-out;
  }

  .captcha-box .cp-rotate-track .cp-handle {
    box-shadow:
      0 0 0 2px transparent,
      0 0 0 4px rgb(93 135 255 / 0%);
    transition: box-shadow 150ms ease-out;
  }

  .captcha-box .cp-rotate-track.is-fine::before {
    opacity: 0.35;
    transition: none;
  }

  .captcha-box .cp-rotate-track.is-fine .cp-handle {
    box-shadow:
      0 0 0 2px var(--el-bg-color),
      0 0 0 4px #5d87ff;
    transition: none;
  }

  html.dark .captcha-box .cp-rotate-track.is-fine .cp-handle {
    box-shadow:
      0 0 0 2px var(--el-bg-color),
      0 0 0 4px rgb(93 135 255 / 70%);
  }

  /* 2–4 字（含 4 字成语）在 260px 下也不换行：标签与提示图 / 字块都可收缩 */
  .captcha-box .cp-click-hint {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    font-size: 14px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  .captcha-box .cp-click-label {
    flex-shrink: 0;
    font-size: 13px;
  }

  .captcha-box .cp-chip {
    display: inline-flex;
    flex-shrink: 1;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 34px;
    padding: 0 4px;
    font-size: 20px;
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

  /* 服务端命中圈（itemSize 换算），提示点击精度 */
  .captcha-box .cp-marker::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--cp-hit, 44px);
    height: var(--cp-hit, 44px);
    pointer-events: none;
    content: '';
    border: 1px dashed rgb(255 255 255 / 85%);
    border-radius: 50%;
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
    .captcha-box .cp-tile,
    .captcha-box .cp-rotate-track::before,
    .captcha-box .cp-rotate-track .cp-handle {
      transition: none;
      animation: none;
    }
  }
</style>
