<!--
  底图瓦片加载失败提示：连续多张失败（或首屏全部失败）时在地图上方显示，任一张成功即隐藏。
  host 传地图容器（OL target 或 Cesium container），与 lib/tileHealth 的登记对象一致。
  需放在 position: relative 的地图外壳里；有顶部工具条的页面用 top 下移。
-->
<template>
  <div
    v-if="failing"
    class="gis-tile-error"
    :style="{ top: `${top ?? 12}px` }"
    role="alert"
    data-test="gis-tile-error"
  >
    <ArtSvgIcon icon="ri:error-warning-line" class="gis-tile-error-icon" />
    <div class="gis-tile-error-body">
      <strong>{{ $t('pages.gis.tileError.title') }}</strong>
      <span>{{ $t('pages.gis.tileError.desc') }}</span>
      <span v-if="reason" class="gis-tile-error-muted" data-test="gis-tile-reason">
        {{ $t('pages.gis.tileError.reason', { code: reason }) }}
      </span>
      <span v-if="!canConfigure" class="gis-tile-error-muted">
        {{ $t('pages.gis.tileError.askAdmin') }}
      </span>
    </div>
    <div class="gis-tile-error-actions">
      <ElButton size="small" type="primary" data-test="gis-tile-retry" @click="retry">
        {{ $t('pages.gis.tileError.retry') }}
      </ElButton>
      <ElButton
        v-if="canConfigure"
        size="small"
        link
        type="primary"
        data-test="gis-tile-switch"
        @click="goConfigure"
      >
        {{ $t('pages.gis.tileError.switch') }}
      </ElButton>
      <ElButton
        size="small"
        link
        tag="a"
        :href="`${docUrl}#troubleshooting`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ $t('pages.gis.tileError.docs') }}
      </ElButton>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { tileHealthFor, type TileHealth } from '@/gis/tileHealth'
  import { useGisProviderEntry } from './useGisProviderEntry'

  defineOptions({ name: 'GisTileErrorHint' })

  const props = defineProps<{
    host?: HTMLElement | null
    /** 距地图顶部的偏移，避开页面自己的顶部工具条 */
    top?: number
  }>()

  const { canConfigure, docUrl, goConfigure } = useGisProviderEntry()
  const failing = ref(false)
  const reason = ref<string>()
  let health: TileHealth | undefined
  let off: (() => void) | undefined

  watch(
    () => props.host,
    (el) => {
      off?.()
      off = undefined
      health = undefined
      failing.value = false
      if (!el) return
      health = tileHealthFor(el)
      off = health.subscribe((s) => {
        failing.value = s === 'failing'
        reason.value = s === 'failing' ? health?.lastReason : undefined
      })
    },
    { immediate: true }
  )

  function retry() {
    health?.retry()
  }

  onBeforeUnmount(() => off?.())
</script>

<style scoped>
  .gis-tile-error {
    position: absolute;
    left: 50%;
    z-index: 30;
    display: flex;
    gap: 10px;
    align-items: center;
    width: max-content;
    max-width: min(720px, calc(100% - 24px));
    padding: 10px 14px;
    font-size: 13px;
    color: var(--el-text-color-regular);
    background: var(--el-bg-color);
    border: 1px solid var(--el-color-warning-light-5);
    border-radius: 8px;
    box-shadow: var(--el-box-shadow-light);
    transform: translateX(-50%);
  }

  .gis-tile-error-icon {
    flex: none;
    font-size: 20px;
    color: var(--el-color-warning);
  }

  .gis-tile-error-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    line-height: 1.5;
  }

  .gis-tile-error-body strong {
    color: var(--el-text-color-primary);
  }

  .gis-tile-error-muted {
    color: var(--el-text-color-secondary);
  }

  .gis-tile-error-actions {
    display: flex;
    flex: none;
    gap: 4px;
    align-items: center;
  }
</style>
