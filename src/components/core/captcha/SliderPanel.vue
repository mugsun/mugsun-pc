<!-- 滑块拼图面板：pointer events 支持鼠标与触屏，键盘 ←/→ 按 keyboardStep（原图像素）移动 -->
<template>
  <div class="cp-panel">
    <div class="cp-stage" :style="{ width: `${width}px`, height: `${bgHeight}px` }">
      <img class="cp-img" :src="challenge.background" alt="" draggable="false" />
      <img
        class="cp-piece"
        :src="challenge.piece"
        alt=""
        draggable="false"
        :style="{
          width: `${pieceWidth}px`,
          height: `${bgHeight}px`,
          transform: `translateX(${offset}px)`
        }"
      />
      <slot name="overlay" />
    </div>
    <div
      class="cp-track"
      :class="{ 'is-active': dragging || offset > 0 }"
      :style="{ width: `${width}px` }"
    >
      <div class="cp-fill" :style="{ width: `${offset + 22}px` }" />
      <span class="cp-track-text" aria-hidden="true">{{
        dragging ? '' : t('pages.auth.slider.hint')
      }}</span>
      <div
        ref="handleRef"
        class="cp-handle"
        role="slider"
        tabindex="0"
        :aria-label="t('pages.auth.slider.ariaLabel')"
        aria-valuemin="0"
        :aria-valuemax="Math.round(max)"
        :aria-valuenow="Math.round(offset)"
        :aria-disabled="disabled"
        aria-describedby="cp-slider-kbd"
        :style="{ transform: `translateX(${offset}px)` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown"
        >→</div
      >
    </div>
    <p id="cp-slider-kbd" class="cp-sr-only">{{ t('pages.auth.slider.keyboardHint') }}</p>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { SliderChallenge } from '@/api/captcha'
  import {
    TrackRecorder,
    clampOffset,
    cssScale,
    toLayoutPx,
    displayKeyboardStep,
    keyboardPressCount,
    maxOffset,
    toDisplay,
    type InputMode,
    type PanelSubmit
  } from '@/utils/captcha'

  defineOptions({ name: 'SliderPanel' })

  const props = defineProps<{
    challenge: SliderChallenge
    width: number
    disabled: boolean
    inputMode: InputMode
  }>()
  const emit = defineEmits<{ submit: [part: PanelSubmit]; wantMode: [mode: InputMode] }>()
  const { t } = useI18n()

  const offset = ref(0)
  const dragging = ref(false)
  const handleRef = ref<HTMLElement>()
  let recorder: TrackRecorder | null = null
  let startX = 0
  /** 外壳被 CSS 缩放时（容器 < 260px）屏幕像素 / 布局像素，按下时计算 */
  let scale = 1
  let keySteps = 0

  const bgHeight = computed(() =>
    Math.round(toDisplay(props.challenge.bgHeight, props.challenge.bgWidth, props.width))
  )
  const pieceWidth = computed(() =>
    toDisplay(props.challenge.pieceWidth, props.challenge.bgWidth, props.width)
  )
  const max = computed(() =>
    maxOffset(props.challenge.bgWidth, props.challenge.pieceWidth, props.width)
  )

  watch(
    () => props.width,
    () => {
      if (!dragging.value) offset.value = 0
    }
  )

  function submit() {
    if (!recorder) return
    emit('submit', {
      answer: { x: Math.round(offset.value * 10) / 10 },
      track: recorder.toJSON(),
      startTime: recorder.startTime,
      endTime: Date.now(),
      keyPresses: props.inputMode === 'keyboard' ? recorder.keyPresses : null
    })
  }

  function onPointerDown(e: PointerEvent) {
    if (props.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    if (props.inputMode !== 'pointer') {
      emit('wantMode', 'pointer')
      return
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    const el = e.currentTarget as HTMLElement
    const track = el.parentElement
    scale = track ? cssScale(track.getBoundingClientRect().width, track.offsetWidth) : 1
    dragging.value = true
    // 指针位移与轨迹统一换算回布局像素，缩放外壳下 answer.x 与 track 首末位移才与原图一致
    startX = toLayoutPx(e.clientX, scale) - offset.value
    recorder = new TrackRecorder(
      Date.now(),
      toLayoutPx(e.clientX, scale),
      toLayoutPx(e.clientY, scale)
    )
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    e.preventDefault()
    offset.value = clampOffset(toLayoutPx(e.clientX, scale) - startX, max.value)
    recorder.sample(toLayoutPx(e.clientX, scale), toLayoutPx(e.clientY, scale), Date.now())
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    dragging.value = false
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    recorder.sample(toLayoutPx(e.clientX, scale), toLayoutPx(e.clientY, scale), Date.now(), true)
    if (offset.value <= 0) {
      recorder = null
      return
    }
    submit()
  }

  function onKeydown(e: KeyboardEvent) {
    if (props.disabled) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (recorder && offset.value > 0 && props.inputMode === 'keyboard') submit()
      return
    }
    const presses = keyboardPressCount(e.key, e.shiftKey)
    if (presses === null) return
    e.preventDefault()
    if (props.inputMode !== 'keyboard') {
      emit('wantMode', 'keyboard')
      return
    }
    if (!recorder) recorder = new TrackRecorder(Date.now())
    const c = props.challenge
    const stepPx = displayKeyboardStep(c.keyboardStep, c.bgWidth, props.width)
    const maxSteps = stepPx > 0 ? Math.floor(max.value / stepPx + 1e-6) : 0
    keySteps = Math.min(maxSteps, Math.max(0, keySteps + presses))
    offset.value = clampOffset(keySteps * stepPx, max.value)
    recorder.key(offset.value, Date.now(), Math.abs(presses))
    recorder.setKeyPresses(keySteps)
  }

  defineExpose({ focus: () => handleRef.value?.focus() })
</script>
