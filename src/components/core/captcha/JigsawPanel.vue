<!-- 拼图还原面板（2×2）：点两块交换，或拖一块到另一块上交换；点「完成」提交 -->
<template>
  <div class="cp-panel">
    <div
      ref="stageRef"
      class="cp-stage cp-jigsaw"
      role="group"
      :aria-label="t('pages.auth.slider.jigsawHint')"
      aria-describedby="cp-jigsaw-note"
      :style="{
        width: `${width}px`,
        height: `${bgHeight}px`,
        gridTemplateColumns: `repeat(${grid}, 1fr)`
      }"
    >
      <button
        v-for="(cell, pos) in order"
        :key="cell"
        type="button"
        class="cp-tile"
        :class="{ 'is-selected': selected === pos, 'is-over': overPos === pos }"
        :data-pos="pos"
        :aria-label="t('pages.auth.slider.jigsawTile', { n: pos + 1 })"
        :aria-pressed="selected === pos"
        :disabled="disabled"
        :style="{
          backgroundImage: `url(${challenge.image})`,
          backgroundSize: `${grid * 100}% ${grid * 100}%`,
          backgroundPosition: tileBackgroundPosition(cell, grid)
        }"
        @pointerdown="onPointerDown($event, pos)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp($event, pos)"
        @pointercancel="cancelDrag"
      />
      <slot name="overlay" />
    </div>
    <div class="cp-actions" :style="{ width: `${width}px` }">
      <span class="cp-progress">{{ t('pages.auth.slider.jigsawHint') }}</span>
      <button
        type="button"
        class="cp-btn cp-btn--primary"
        :disabled="disabled || !moved"
        @click="submit"
      >
        {{ t('pages.auth.slider.jigsawSubmit') }}
      </button>
    </div>
    <p id="cp-jigsaw-note" class="cp-sr-only">{{ t('pages.auth.slider.jigsawKeyboardNote') }}</p>
    <div class="cp-sr-only" aria-live="polite">{{ live }}</div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { JigsawChallenge } from '@/api/captcha'
  import {
    buildJigsawAnswer,
    initialOrder,
    swapTiles,
    tileBackgroundPosition,
    toDisplay,
    type InputMode,
    type PanelSubmit,
    type TrackPoint
  } from '@/utils/captcha'

  defineOptions({ name: 'JigsawPanel' })

  const props = defineProps<{
    challenge: JigsawChallenge
    width: number
    disabled: boolean
    inputMode: InputMode
  }>()
  const emit = defineEmits<{ submit: [part: PanelSubmit]; wantMode: [mode: InputMode] }>()
  const { t } = useI18n()

  const grid = computed(() => props.challenge.grid || 2)
  const order = ref<number[]>(initialOrder(grid.value))
  const selected = ref<number | null>(null)
  const overPos = ref<number | null>(null)
  const moved = ref(false)
  const live = ref('')
  const stageRef = ref<HTMLElement>()
  const bgHeight = computed(() =>
    Math.round(toDisplay(props.challenge.bgHeight, props.challenge.bgWidth, props.width))
  )
  let startTime = 0
  let track: TrackPoint[] = []
  let drag: { from: number; x: number; y: number; active: boolean } | null = null

  function record(pos: number) {
    if (!startTime) startTime = Date.now()
    track.push({ x: pos % grid.value, y: Math.floor(pos / grid.value), t: Date.now() - startTime })
  }

  function swap(a: number, b: number) {
    order.value = swapTiles(order.value, a, b)
    moved.value = true
    record(b)
    selected.value = null
  }

  function posAt(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const v = el?.closest<HTMLElement>('.cp-tile')?.dataset.pos
    return v === undefined ? null : Number(v)
  }

  function onPointerDown(e: PointerEvent, pos: number) {
    if (props.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag = { from: pos, x: e.clientX, y: e.clientY, active: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag) return
    if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.active = true
    if (drag.active) overPos.value = posAt(e.clientX, e.clientY)
  }
  function onPointerUp(e: PointerEvent, pos: number) {
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    if (!drag) return
    const d = drag
    drag = null
    overPos.value = null
    if (d.active) {
      const to = posAt(e.clientX, e.clientY)
      if (to !== null && to !== d.from) swap(d.from, to)
      return
    }
    // 点击：先选再换
    if (selected.value === null) {
      selected.value = pos
      record(pos)
      live.value = t('pages.auth.slider.jigsawSelected', { n: pos + 1 })
    } else if (selected.value === pos) {
      selected.value = null
    } else {
      swap(selected.value, pos)
    }
  }
  function cancelDrag() {
    drag = null
    overPos.value = null
  }

  function submit() {
    if (props.disabled || !moved.value) return
    emit('submit', {
      answer: buildJigsawAnswer(order.value),
      track: track.slice(),
      startTime,
      endTime: Date.now(),
      keyPresses: null
    })
  }

  defineExpose({ focus: () => stageRef.value?.querySelector<HTMLElement>('.cp-tile')?.focus() })
</script>
