<!--
  GIS 地图页统一的底图空状态：以后端 /system/gis/status 判定。
  未配置 → 说明 + 去配置（有 gis:provider:list 权限且路由存在才显示）+ 文档；
  状态取不到 → 页内错误态 + 重试（与未配置区分，网络 / 服务端分别提示）。
  放在 position: relative 的地图容器里，覆盖整块地图。
  默认自己拉状态；传 controlled 时用父组件的 status / error / loading（父页已有状态请求时用，避免重复请求），重试时 emit retry。
-->
<template>
  <div
    v-if="state === 'unconfigured' || state === 'error' || state === 'moduleOff'"
    class="gis-basemap-empty"
    :data-state="state"
    data-test="gis-basemap-empty"
  >
    <div class="gis-basemap-empty-card" role="status">
      <template v-if="state === 'error'">
        <ArtSvgIcon icon="ri:wifi-off-line" class="gis-basemap-empty-icon is-error" />
        <h3>{{ $t('pages.gis.basemapEmpty.errorTitle') }}</h3>
        <p>
          {{
            errorKind === 'network'
              ? $t('pages.gis.basemapEmpty.errorNetwork')
              : $t('pages.gis.basemapEmpty.errorServer')
          }}
        </p>
        <div class="gis-basemap-empty-actions">
          <ElButton type="primary" :loading="checking" data-test="gis-basemap-retry" @click="retry">
            {{ $t('pages.gis.basemapEmpty.retry') }}
          </ElButton>
        </div>
      </template>
      <template v-else-if="state === 'moduleOff'">
        <ArtSvgIcon icon="ri:map-pin-line" class="gis-basemap-empty-icon" />
        <h3>{{ $t('pages.gis.basemapEmpty.moduleOffTitle') }}</h3>
        <p>{{ $t('pages.gis.basemapEmpty.moduleOffDesc') }}</p>
      </template>
      <template v-else>
        <ArtSvgIcon icon="ri:map-2-line" class="gis-basemap-empty-icon" />
        <h3>{{ $t('pages.gis.basemapEmpty.title') }}</h3>
        <p>{{ $t('pages.gis.basemapEmpty.desc') }}</p>
        <ul>
          <li>{{ $t('pages.gis.basemapEmpty.tipTianditu') }}</li>
          <li>{{ $t('pages.gis.basemapEmpty.tipXyz') }}</li>
        </ul>
        <p v-if="!canConfigure" class="gis-basemap-empty-muted">
          {{ $t('pages.gis.basemapEmpty.askAdmin') }}
        </p>
        <div class="gis-basemap-empty-actions">
          <ElButton
            v-if="canConfigure"
            type="primary"
            data-test="gis-basemap-configure"
            @click="goConfigure"
          >
            {{ $t('pages.gis.basemapEmpty.configure') }}
          </ElButton>
          <ElButton tag="a" :href="docUrl" target="_blank" rel="noopener noreferrer">
            {{ $t('pages.gis.basemapEmpty.docs') }}
          </ElButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { fetchGisStatus, type GisStatus } from '@/api/gis'
  import { useGisProviderEntry } from './useGisProviderEntry'
  import {
    basemapErrorKind,
    basemapStateOf,
    isCanceled,
    type GisBasemapErrorKind,
    type GisBasemapState
  } from '@/gis/basemapState'

  defineOptions({ name: 'GisBasemapEmpty' })

  const props = defineProps<{
    /** 受控模式：由父组件提供状态，不自己请求 */
    controlled?: boolean
    status?: GisStatus | null
    error?: unknown
    loading?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'state', state: GisBasemapState, status: GisStatus | null): void
    (e: 'retry'): void
  }>()

  const router = useRouter()

  const selfState = ref<GisBasemapState>('loading')
  const selfErrorKind = ref<GisBasemapErrorKind>('network')
  const selfChecking = ref(false)

  const state = computed<GisBasemapState>(() => {
    if (!props.controlled) return selfState.value
    if (props.loading) return 'loading'
    if (props.error !== undefined && props.error !== null) return 'error'
    return props.status ? basemapStateOf(props.status) : 'loading'
  })
  const errorKind = computed<GisBasemapErrorKind>(() =>
    props.controlled ? basemapErrorKind(props.error) : selfErrorKind.value
  )
  const checking = computed(() => (props.controlled ? !!props.loading : selfChecking.value))
  let hadError = false

  const { canConfigure, docUrl, goConfigure } = useGisProviderEntry()

  async function check() {
    selfChecking.value = true
    try {
      const status = await fetchGisStatus({ silent: true })
      selfState.value = basemapStateOf(status)
      emit('state', selfState.value, status)
    } catch (err) {
      if (isCanceled(err)) {
        return
      }
      selfErrorKind.value = basemapErrorKind(err)
      selfState.value = 'error'
      hadError = true
      emit('state', 'error', null)
    } finally {
      selfChecking.value = false
    }
  }

  async function retry() {
    if (props.controlled) {
      emit('retry')
      return
    }
    await check()
    // 页面自己的地图初始化在第一次失败时没拿到底图，恢复后整页重载一次最稳
    if (hadError && state.value === 'ready') {
      router.go(0)
    }
  }

  onMounted(() => {
    if (!props.controlled) void check()
  })

  defineExpose({ check, state })
</script>

<style scoped>
  .gis-basemap-empty {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, var(--el-bg-color-page) 88%, transparent);
  }

  .gis-basemap-empty-card {
    max-width: 460px;
    padding: 28px 32px;
    text-align: center;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    box-shadow: var(--el-box-shadow-light);
  }

  .gis-basemap-empty-card h3 {
    margin: 8px 0;
    font-size: 17px;
    color: var(--el-text-color-primary);
  }

  .gis-basemap-empty-card p,
  .gis-basemap-empty-card li {
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  .gis-basemap-empty-card ul {
    padding-left: 18px;
    margin: 8px 0;
    text-align: left;
  }

  .gis-basemap-empty-muted {
    color: var(--el-text-color-secondary) !important;
  }

  .gis-basemap-empty-icon {
    font-size: 40px;
    color: var(--el-color-primary);
  }

  .gis-basemap-empty-icon.is-error {
    color: var(--el-color-danger);
  }

  .gis-basemap-empty-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
  }
</style>
