<!-- 文字 / 图标点选面板：按提示顺序点 3 次，已点处显示序号，可点序号或「撤销」回退；点满自动提交 -->
<template>
  <div class="cp-panel">
    <div class="cp-click-hint">
      <span>{{
        challenge.type === 'WORD_CLICK'
          ? t('pages.auth.slider.wordHint')
          : t('pages.auth.slider.iconHint')
      }}</span>
      <template v-for="(h, i) in challenge.hints" :key="i">
        <img
          v-if="challenge.type === 'ICON_CLICK'"
          class="cp-chip cp-chip--icon"
          :class="{ 'is-done': i < points.length }"
          :src="h"
          :alt="`${i + 1}`"
        />
        <b v-else class="cp-chip" :class="{ 'is-done': i < points.length }">{{ h }}</b>
      </template>
    </div>
    <div
      ref="stageRef"
      class="cp-stage cp-click-stage"
      role="group"
      :aria-label="t('pages.auth.slider.clickAria')"
      :aria-describedby="'cp-click-note'"
      :style="{ width: `${width}px`, height: `${bgHeight}px` }"
      @click="onStageClick"
    >
      <img class="cp-img" :src="challenge.background" alt="" draggable="false" />
      <button
        v-for="(p, i) in points"
        :key="i"
        type="button"
        class="cp-marker"
        :style="{ left: `${p.x}px`, top: `${p.y}px` }"
        :aria-label="t('pages.auth.slider.clickMarker', { n: i + 1 })"
        :disabled="disabled"
        @click.stop="undo(i)"
        >{{ i + 1 }}</button
      >
      <slot name="overlay" />
    </div>
    <div class="cp-actions" :style="{ width: `${width}px` }">
      <span class="cp-progress" aria-live="polite">
        {{ t('pages.auth.slider.clickProgress', { n: points.length, total }) }}
      </span>
      <button type="button" class="cp-btn" :disabled="disabled || !points.length" @click="undo()">
        {{ t('pages.auth.slider.undo') }}
      </button>
    </div>
    <p id="cp-click-note" class="cp-sr-only">{{ t('pages.auth.slider.clickKeyboardNote') }}</p>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { ClickChallenge } from '@/api/captcha'
  import {
    CLICK_COUNT,
    addClickPoint,
    buildClickAnswer,
    toDisplay,
    undoClickPoint,
    type ClickPoint,
    type InputMode,
    type PanelSubmit,
    type TrackPoint
  } from '@/utils/captcha'

  defineOptions({ name: 'ClickPanel' })

  const props = defineProps<{
    challenge: ClickChallenge
    width: number
    disabled: boolean
    inputMode: InputMode
  }>()
  const emit = defineEmits<{ submit: [part: PanelSubmit]; wantMode: [mode: InputMode] }>()
  const { t } = useI18n()

  const stageRef = ref<HTMLElement>()
  const points = ref<ClickPoint[]>([])
  const total = computed(() => props.challenge.hints.length || CLICK_COUNT)
  const bgHeight = computed(() =>
    Math.round(toDisplay(props.challenge.bgHeight, props.challenge.bgWidth, props.width))
  )
  let startTime = 0
  let track: TrackPoint[] = []

  watch(
    () => props.width,
    () => {
      points.value = []
      track = []
    }
  )

  function onStageClick(e: MouseEvent) {
    if (props.disabled || !stageRef.value || points.value.length >= total.value) return
    const rect = stageRef.value.getBoundingClientRect()
    const x = Math.min(props.width, Math.max(0, e.clientX - rect.left))
    const y = Math.min(bgHeight.value, Math.max(0, e.clientY - rect.top))
    if (!points.value.length) {
      startTime = Date.now()
      track = []
    }
    points.value = addClickPoint(points.value, { x, y }, total.value)
    track.push({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      t: Date.now() - startTime
    })
    if (points.value.length >= total.value) {
      emit('submit', {
        answer: buildClickAnswer(points.value),
        track: track.slice(),
        startTime,
        endTime: Date.now(),
        keyPresses: null
      })
    }
  }

  function undo(index?: number) {
    if (props.disabled) return
    points.value = undoClickPoint(points.value, index)
  }

  defineExpose({ focus: () => stageRef.value?.querySelector<HTMLElement>('.cp-btn')?.focus() })
</script>
