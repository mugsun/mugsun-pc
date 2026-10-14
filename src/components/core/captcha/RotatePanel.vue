<!--
  旋转题（契约 v0.6.1）：background 浅化底图 + 居中叠放已旋转的圆图 piece；
  拖动条与显示底图等宽，按滑块左边缘位移算，最大行程 = bgDisplayWidth（拖到最右 = 360°）。
  键盘：每次 ←/→ 转 keyboardStep 度（服务端施加角为其整数倍，可精确转正）。
-->
<template>
  <div class="cp-panel">
    <div class="cp-stage" :style="{ width: `${width}px`, height: `${stageHeight}px` }">
      <img class="cp-img" :src="challenge.background" alt="" draggable="false" />
      <img
        class="cp-rotate-piece"
        :src="challenge.piece"
        alt=""
        draggable="false"
        :style="{
          width: `${diameter}px`,
          height: `${diameter}px`,
          left: `${(width - diameter) / 2}px`,
          top: `${(stageHeight - diameter) / 2}px`,
          transform: `rotate(${angle}deg)`
        }"
      />
      <slot name="overlay" />
    </div>
    <div
      ref="trackRef"
      class="cp-track"
      :class="{ 'is-active': dragging || offset > 0 }"
      :style="{ width: `${width}px` }"
    >
      <div class="cp-fill" :style="{ width: `${handleLeft + 22}px` }" />
      <span class="cp-track-text" aria-hidden="true">{{
        dragging ? '' : t('pages.auth.slider.rotateHint')
      }}</span>
      <div
        ref="handleRef"
        class="cp-handle"
        role="slider"
        tabindex="0"
        :aria-label="t('pages.auth.slider.rotateAria', { deg: Math.round(angle) })"
        aria-valuemin="0"
        aria-valuemax="360"
        :aria-valuenow="Math.round(angle)"
        :aria-valuetext="`${Math.round(angle)}°`"
        :aria-disabled="disabled"
        aria-describedby="cp-rotate-kbd"
        :style="{ transform: `translateX(${handleLeft}px)` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown"
        >↻</div
      >
    </div>
    <p id="cp-rotate-kbd" class="cp-sr-only">{{ t('pages.auth.slider.rotateKeyboardHint') }}</p>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { RotateChallenge } from '@/api/captcha'
  import {
    TrackRecorder,
    buildRotateAnswer,
    clampOffset,
    clampRotateSteps,
    cssScale,
    keyboardPressCount,
    normalizeAngle,
    rotateAngleToTravel,
    rotateFineDelta,
    rotateKeyboardStep,
    rotateTravelToAngle,
    toDisplay,
    type InputMode,
    type PanelSubmit
  } from '@/utils/captcha'

  defineOptions({ name: 'RotatePanel' })

  const props = defineProps<{
    challenge: RotateChallenge
    width: number
    disabled: boolean
    inputMode: InputMode
  }>()
  const emit = defineEmits<{ submit: [part: PanelSubmit]; wantMode: [mode: InputMode] }>()
  const { t } = useI18n()

  const HANDLE = 44
  /** 逻辑行程（显示像素，左边缘位移），[0, width] */
  const offset = ref(0)
  const angle = ref(0)
  const dragging = ref(false)
  const handleRef = ref<HTMLElement>()
  const trackRef = ref<HTMLElement>()
  let recorder: TrackRecorder | null = null
  let startY = 0
  let scale = 1
  let lastX = 0
  let lastT = 0
  let keySteps = 0

  const bgW = computed(() => props.challenge.bgWidth || 320)
  const stageHeight = computed(() =>
    Math.round(toDisplay(props.challenge.bgHeight || 180, bgW.value, props.width))
  )
  const diameter = computed(() =>
    Math.round(toDisplay(props.challenge.pieceSize || 160, bgW.value, props.width))
  )
  /** 滑块视觉位置：逻辑行程 [0, width] 映射到可视轨道 [0, width − 把手宽] */
  const handleLeft = computed(
    () => Math.round(((offset.value * (props.width - HANDLE)) / props.width) * 10) / 10
  )

  function submit() {
    if (!recorder) return
    emit('submit', {
      answer: buildRotateAnswer(angle.value),
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
    const el = trackRef.value
    scale = el ? cssScale(el.getBoundingClientRect().width, el.offsetWidth) : 1
    dragging.value = true
    offset.value = 0
    startY = e.clientY
    lastX = e.clientX
    lastT = performance.now()
    // 轨迹 x = 逻辑行程（布局像素），首末位移 = answer 换算行程
    recorder = new TrackRecorder(Date.now())
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    e.preventDefault()
    // 低速精调：慢速移动时逻辑位移按 0.5 倍累加；track.x 记逻辑位置（v0.6.2 §3）
    const now = performance.now()
    const dx = (e.clientX - lastX) / scale
    offset.value = clampOffset(offset.value + rotateFineDelta(dx, now - lastT), props.width)
    lastX = e.clientX
    lastT = now
    angle.value = rotateTravelToAngle(offset.value, props.width)
    recorder.sample(offset.value, (e.clientY - startY) / scale, Date.now())
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    dragging.value = false
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    recorder.sample(offset.value, (e.clientY - startY) / scale, Date.now(), true)
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
      if (recorder && keySteps > 0 && props.inputMode === 'keyboard') submit()
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
    const step = rotateKeyboardStep(props.challenge.keyboardStep)
    keySteps = clampRotateSteps(keySteps + presses, step)
    angle.value = normalizeAngle(keySteps * step)
    offset.value = rotateAngleToTravel(angle.value, props.width)
    recorder.key(offset.value, Date.now(), Math.abs(presses))
    // 按键次数 = 净步数，服务端校验 |keyPresses − round(angle/step)| ≤ 1
    recorder.setKeyPresses(keySteps)
  }

  defineExpose({ focus: () => handleRef.value?.focus() })
</script>
