<!-- 旋转面板：拖滑条把圆图转正；键盘 ←/→ 按 keyboardStep（度）旋转，带 keyPresses -->
<template>
  <div class="cp-panel">
    <div class="cp-rotate-stage" :style="{ width: `${width}px`, height: `${diameter + 16}px` }">
      <div class="cp-rotate-ring" :style="{ width: `${diameter}px`, height: `${diameter}px` }">
        <img
          class="cp-rotate-img"
          :src="challenge.image"
          alt=""
          draggable="false"
          :style="{ transform: `rotate(${angle}deg)` }"
        />
      </div>
      <slot name="overlay" />
    </div>
    <div
      class="cp-track"
      :class="{ 'is-active': dragging || offset > 0 }"
      :style="{ width: `${width}px` }"
    >
      <div class="cp-fill" :style="{ width: `${offset + 22}px` }" />
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
        :style="{ transform: `translateX(${offset}px)` }"
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
    keyboardPressCount,
    normalizeAngle,
    offsetToAngle,
    rotateKeyboardStep,
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
  const offset = ref(0)
  const angle = ref(0)
  const dragging = ref(false)
  const handleRef = ref<HTMLElement>()
  let recorder: TrackRecorder | null = null
  let startX = 0
  let keySteps = 0

  const diameter = computed(() => Math.round(Math.min(170, props.width * 0.56)))
  const max = computed(() => Math.max(1, props.width - HANDLE))

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
    dragging.value = true
    startX = e.clientX - offset.value
    recorder = new TrackRecorder(Date.now(), e.clientX, e.clientY)
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging.value || !recorder) return
    e.preventDefault()
    offset.value = clampOffset(e.clientX - startX, max.value)
    angle.value = offsetToAngle(offset.value, max.value)
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
    offset.value = clampOffset((angle.value / 360) * max.value, max.value)
    recorder.key(offset.value, Date.now(), Math.abs(presses))
    recorder.setKeyPresses(keySteps)
  }

  defineExpose({ focus: () => handleRef.value?.focus() })
</script>
