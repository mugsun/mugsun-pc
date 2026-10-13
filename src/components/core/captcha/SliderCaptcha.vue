<!-- 滑块拼图验证码（弹层 / 内嵌）：pointer events 支持鼠标与触屏，键盘 ←/→ 可达 -->
<template>
  <ElDialog
    v-if="mode === 'dialog'"
    :model-value="visible"
    :title="$t('pages.auth.slider.title')"
    width="min(360px, calc(100vw - 16px))"
    class="slider-captcha-dialog"
    append-to-body
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="(v: boolean) => !v && handleClose()"
    @opened="onOpened"
  >
    <component :is="Body" />
  </ElDialog>
  <div v-else class="slider-captcha-inline">
    <component :is="Body" />
  </div>
</template>

<script setup lang="ts">
  import { h, type VNode } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    fetchCaptchaChallenge,
    fetchCaptchaVerify,
    type CaptchaChallenge,
    type CaptchaScene
  } from '@/api/captcha'
  import {
    TrackRecorder,
    buildVerifyPayload,
    clampDisplayWidth,
    clampOffset,
    classifyCaptchaError,
    keyboardStep,
    maxOffset,
    toDisplay,
    type InputMode
  } from '@/utils/captcha'

  defineOptions({ name: 'SliderCaptcha' })

  const props = withDefaults(
    defineProps<{
      scene: CaptchaScene
      clientId?: string
      tenantId?: string
      /** dialog：弹层（需 v-model:visible）；inline：内嵌 */
      mode?: 'dialog' | 'inline'
      visible?: boolean
    }>(),
    { clientId: 'web', tenantId: undefined, mode: 'dialog', visible: false }
  )
  const emit = defineEmits<{
    success: [captchaToken: string]
    /** challenge 返回 40014：当前无需验证，调用方直接提交 */
    skip: []
    close: []
    'update:visible': [value: boolean]
  }>()

  const { t } = useI18n()

  type Status = 'loading' | 'ready' | 'verifying' | 'success' | 'failed' | 'limited' | 'error'
  const status = ref<Status>('loading')
  const challenge = ref<CaptchaChallenge | null>(null)
  const offset = ref(0)
  const dragging = ref(false)
  const shaking = ref(false)
  const announce = ref('')
  const retryLeft = ref(0)
  const displayWidth = ref(320)
  const wrapRef = ref<HTMLElement>()
  const handleRef = ref<HTMLElement>()

  let recorder: TrackRecorder | null = null
  let inputMode: InputMode = 'pointer'
  let pointerStartX = 0
  let expireTimer: ReturnType<typeof setTimeout> | null = null
  let limitTimer: ReturnType<typeof setInterval> | null = null
  let resizeObs: ResizeObserver | null = null
  let alive = true

  const bgHeight = computed(() => {
    const c = challenge.value
    return c ? Math.round(toDisplay(c.bgHeight, c.bgWidth, displayWidth.value)) : 180
  })
  const pieceWidth = computed(() => {
    const c = challenge.value
    return c ? toDisplay(c.pieceWidth, c.bgWidth, displayWidth.value) : 60
  })
  const max = computed(() => {
    const c = challenge.value
    return c ? maxOffset(c.bgWidth, c.pieceWidth, displayWidth.value) : 0
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

  async function load() {
    clearTimers()
    status.value = 'loading'
    offset.value = 0
    recorder = null
    try {
      const data = await fetchCaptchaChallenge({
        scene: props.scene,
        clientId: props.clientId,
        tenantId: props.tenantId || undefined
      })
      if (!alive) return
      challenge.value = data
      status.value = 'ready'
      // 只用 expireSeconds 倒计时，到期自动换图
      expireTimer = setTimeout(
        () => {
          announce.value = t('pages.auth.slider.expired')
          load()
        },
        Math.max(5, data.expireSeconds || 120) * 1000
      )
    } catch (err) {
      handleError(err)
    }
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
        load()
      }
    }, 1000)
  }

  function handleError(err: unknown) {
    if (!alive) return
    const info = classifyCaptchaError(err)
    switch (info.kind) {
      case 'failed':
        announce.value = t('pages.auth.slider.failed')
        status.value = 'failed'
        shaking.value = true
        setTimeout(() => {
          shaking.value = false
          if (alive && status.value === 'failed') load()
        }, 700)
        return
      case 'expired':
        announce.value = t('pages.auth.slider.expired')
        load()
        return
      case 'rateLimited':
        startLimit(info.retryAfter ?? 60)
        return
      case 'disabled':
        clearTimers()
        emit('skip')
        if (props.mode === 'dialog') emit('update:visible', false)
        return
      default:
        status.value = 'error'
        announce.value = info.msg || t('pages.auth.slider.networkError')
    }
  }

  async function submit() {
    const c = challenge.value
    if (!c || !recorder || status.value !== 'ready') return
    status.value = 'verifying'
    const payload = buildVerifyPayload({
      captchaId: c.captchaId,
      displayWidth: displayWidth.value,
      offset: offset.value,
      inputMode,
      recorder,
      endTime: Date.now()
    })
    try {
      const res = await fetchCaptchaVerify(payload)
      if (!alive) return
      clearTimers()
      status.value = 'success'
      announce.value = t('pages.auth.slider.success')
      setTimeout(() => {
        if (!alive) return
        emit('success', res.captchaToken)
        if (props.mode === 'dialog') emit('update:visible', false)
      }, 600)
    } catch (err) {
      handleError(err)
    }
  }

  // ===== pointer =====
  function onPointerDown(e: PointerEvent) {
    if (!interactive.value || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    inputMode = 'pointer'
    dragging.value = true
    pointerStartX = e.clientX - offset.value
    recorder = new TrackRecorder(Date.now(), e.clientX, e.clientY)
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    e.preventDefault()
    offset.value = clampOffset(e.clientX - pointerStartX, max.value)
    recorder.sample(e.clientX, e.clientY, Date.now())
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    dragging.value = false
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    recorder.sample(e.clientX, e.clientY, Date.now(), true)
    if (offset.value <= 0) {
      recorder = null
      return
    }
    submit()
  }

  // ===== keyboard =====
  function onKeydown(e: KeyboardEvent) {
    if (!interactive.value) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (recorder && offset.value > 0) submit()
      return
    }
    const step = keyboardStep(e.key, e.shiftKey, challenge.value?.keyboardStep)
    if (step === null) return
    e.preventDefault()
    if (!recorder || inputMode !== 'keyboard') {
      inputMode = 'keyboard'
      recorder = new TrackRecorder(Date.now())
    }
    offset.value = clampOffset(offset.value + step, max.value)
    recorder.key(offset.value, Date.now())
  }

  function handleClose() {
    emit('update:visible', false)
    emit('close')
  }

  function onOpened() {
    measure()
    handleRef.value?.focus()
  }

  function start() {
    alive = true
    nextTick(() => {
      measure()
      if (wrapRef.value && typeof ResizeObserver !== 'undefined') {
        resizeObs?.disconnect()
        resizeObs = new ResizeObserver(() => {
          // 拖动中不重算尺寸，避免答案坐标系漂移
          if (!dragging.value && status.value !== 'verifying') measure()
        })
        resizeObs.observe(wrapRef.value)
      }
    })
    load()
  }
  function stop() {
    alive = false
    clearTimers()
    resizeObs?.disconnect()
    resizeObs = null
  }

  watch(
    () => props.visible,
    (v) => {
      if (props.mode !== 'dialog') return
      if (v) start()
      else stop()
    }
  )
  // 尺寸变化后已拖动的偏移按比例失效 → 归零
  watch(displayWidth, () => {
    if (!dragging.value) offset.value = 0
  })

  onMounted(() => {
    if (props.mode === 'inline' || props.visible) start()
  })
  onBeforeUnmount(stop)

  defineExpose({ refresh: load })

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
        return dragging.value ? '' : t('pages.auth.slider.hint')
    }
  })

  // 渲染函数：弹层 / 内嵌共用同一主体
  const Body = (): VNode =>
    h(
      'div',
      {
        ref: wrapRef,
        class: ['slider-captcha', { 'is-shaking': shaking.value }],
        'data-status': status.value
      },
      [
        h(
          'div',
          {
            class: 'sc-stage',
            style: { width: `${displayWidth.value}px`, height: `${bgHeight.value}px` }
          },
          [
            challenge.value && status.value !== 'loading'
              ? [
                  h('img', {
                    class: 'sc-bg',
                    src: challenge.value.background,
                    alt: '',
                    draggable: false
                  }),
                  h('img', {
                    class: 'sc-piece',
                    src: challenge.value.piece,
                    alt: '',
                    draggable: false,
                    style: {
                      width: `${pieceWidth.value}px`,
                      height: `${bgHeight.value}px`,
                      transform: `translateX(${offset.value}px)`
                    }
                  })
                ]
              : h('div', { class: 'sc-skeleton' }, statusText.value),
            status.value === 'success'
              ? h('div', { class: 'sc-mask sc-mask--ok', 'aria-hidden': 'true' }, '✓')
              : null,
            status.value === 'limited' || status.value === 'error'
              ? h('div', { class: 'sc-mask' }, [
                  h('span', statusText.value),
                  status.value === 'error'
                    ? h(
                        'button',
                        { type: 'button', class: 'sc-retry', onClick: load },
                        t('pages.auth.slider.retry')
                      )
                    : null
                ])
              : null,
            h(
              'button',
              {
                type: 'button',
                class: 'sc-refresh',
                'aria-label': t('pages.auth.slider.refresh'),
                title: t('pages.auth.slider.refresh'),
                disabled: status.value === 'verifying' || status.value === 'limited',
                onClick: load
              },
              '↻'
            )
          ]
        ),
        h(
          'div',
          {
            class: ['sc-track', { 'is-active': dragging.value || offset.value > 0 }],
            style: { width: `${displayWidth.value}px` }
          },
          [
            h('div', { class: 'sc-fill', style: { width: `${offset.value + 20}px` } }),
            h('span', { class: 'sc-track-text', 'aria-hidden': 'true' }, statusText.value),
            h(
              'div',
              {
                ref: handleRef,
                class: ['sc-handle', `is-${status.value}`],
                role: 'slider',
                tabindex: 0,
                'aria-label': t('pages.auth.slider.ariaLabel'),
                'aria-valuemin': 0,
                'aria-valuemax': Math.round(max.value),
                'aria-valuenow': Math.round(offset.value),
                'aria-disabled': !interactive.value,
                'aria-describedby': 'sc-kbd-hint',
                style: { transform: `translateX(${offset.value}px)` },
                onPointerdown: onPointerDown,
                onPointermove: onPointerMove,
                onPointerup: onPointerUp,
                onPointercancel: onPointerUp,
                onKeydown
              },
              status.value === 'success' ? '✓' : '→'
            )
          ]
        ),
        h('p', { id: 'sc-kbd-hint', class: 'sc-sr-only' }, t('pages.auth.slider.keyboardHint')),
        h('div', { class: 'sc-sr-only', 'aria-live': 'polite', role: 'status' }, announce.value)
      ]
    )
</script>

<!-- 主体由渲染函数生成，scoped 不生效：统一 sc- 前缀避免污染 -->
<style>
  .slider-captcha-inline {
    max-width: 100%;
    overflow-x: auto;
  }

  .slider-captcha {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    width: 100%;
    min-width: 260px;
    user-select: none;
  }

  .sc-stage {
    position: relative;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border-radius: var(--el-border-radius-base);
  }

  .sc-bg {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .sc-piece {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    filter: drop-shadow(0 0 4px rgb(0 0 0 / 35%));
  }

  .sc-skeleton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    animation: sc-pulse 1.2s ease-in-out infinite;
  }

  .sc-mask {
    position: absolute;
    inset: 0;
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

  .sc-mask--ok {
    font-size: 48px;
    color: var(--el-color-success);
  }

  .sc-retry,
  .sc-refresh {
    cursor: pointer;
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  .sc-retry {
    padding: 4px 14px;
    color: var(--el-color-primary);
    background: var(--el-bg-color);
  }

  .sc-refresh {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 30px;
    height: 30px;
    font-size: 16px;
    color: var(--el-text-color-regular);
    background: var(--el-bg-color-overlay);
  }

  .sc-refresh:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .sc-track {
    position: relative;
    height: 40px;
    overflow: hidden;
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  .sc-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--el-color-primary-light-8);
  }

  .sc-track-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 40px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    pointer-events: none;
  }

  .sc-handle {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 38px;
    font-size: 18px;
    color: #fff;
    touch-action: none;
    cursor: grab;
    background: var(--el-color-primary);
    border-radius: var(--el-border-radius-base);
  }

  .sc-handle:active {
    cursor: grabbing;
  }

  .sc-handle:focus-visible {
    outline: 3px solid var(--el-color-primary-light-3);
    outline-offset: 2px;
  }

  .sc-handle.is-failed {
    background: var(--el-color-danger);
  }

  .sc-handle.is-success {
    background: var(--el-color-success);
  }

  .sc-handle[aria-disabled='true'] {
    cursor: not-allowed;
  }

  .sc-handle.is-limited,
  .sc-handle.is-loading,
  .sc-handle.is-error {
    background: var(--el-color-info-light-5);
  }

  .sc-refresh:focus-visible,
  .sc-retry:focus-visible {
    outline: 3px solid var(--el-color-primary-light-3);
    outline-offset: 2px;
  }

  .sc-sr-only {
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

  .is-shaking .sc-stage,
  .is-shaking .sc-track {
    animation: sc-shake 0.5s;
  }

  @keyframes sc-shake {
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

  @keyframes sc-pulse {
    50% {
      opacity: 0.5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .is-shaking .sc-stage,
    .is-shaking .sc-track,
    .sc-skeleton {
      animation: none;
    }
  }
</style>

<style>
  /* 窄屏：缩小弹层内边距以保证底图 ≥260 */
  .slider-captcha-dialog .el-dialog__body {
    padding-right: 4px;
    padding-left: 4px;
    overflow-x: auto;
  }
</style>
