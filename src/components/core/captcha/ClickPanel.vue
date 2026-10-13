<!--
  文字 / 图标点选（契约 v0.6.1）：提示优先显示服务端 promptImage，prompt / promptNames 供读屏；
  点击坐标为显示像素、原点底图左上角（外壳被 CSS 缩放时先换回布局像素）；集满 count 个自动提交。
-->
<template>
  <div class="cp-panel">
    <div class="cp-click-hint">
      <span>{{
        challenge.type === 'WORD_CLICK'
          ? t('pages.auth.slider.wordHint')
          : t('pages.auth.slider.iconHint')
      }}</span>
      <img
        v-if="challenge.promptImage"
        class="cp-prompt-img"
        :src="challenge.promptImage"
        :alt="promptLabel"
        draggable="false"
      />
      <template v-else>
        <b
          v-for="(h, i) in promptTexts"
          :key="i"
          class="cp-chip"
          :class="{ 'is-done': i < points.length }"
          >{{ h }}</b
        >
      </template>
    </div>
    <div
      ref="stageRef"
      class="cp-stage cp-click-stage"
      role="group"
      :aria-label="`${t('pages.auth.slider.clickAria')}：${promptLabel}`"
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
    cssScale,
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
  const promptTexts = computed(() => props.challenge.prompt ?? props.challenge.promptNames ?? [])
  const promptLabel = computed(() => promptTexts.value.join(' '))
  const total = computed(() => props.challenge.count || promptTexts.value.length || CLICK_COUNT)
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
    const el = stageRef.value
    const rect = el.getBoundingClientRect()
    const k = cssScale(rect.width, el.offsetWidth)
    const x = Math.min(props.width, Math.max(0, (e.clientX - rect.left) / k))
    const y = Math.min(bgHeight.value, Math.max(0, (e.clientY - rect.top) / k))
    const now = Date.now()
    if (!points.value.length) {
      startTime = now
      track = []
    }
    points.value = addClickPoint(points.value, { x, y }, total.value)
    // track[].t 为相对 startTime 的毫秒数（v0.6.1 #8）
    track.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, t: now - startTime })
    if (points.value.length >= total.value) {
      emit('submit', {
        answer: buildClickAnswer(points.value),
        track: track.slice(),
        startTime,
        endTime: now,
        keyPresses: null
      })
    }
  }

  function undo(index?: number) {
    if (props.disabled) return
    points.value = undoClickPoint(points.value, index)
    track = track.slice(0, points.value.length)
  }

  defineExpose({ focus: () => stageRef.value?.querySelector<HTMLElement>('.cp-btn')?.focus() })
</script>
