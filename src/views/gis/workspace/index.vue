<!-- 地图工作台：底图 + 二维标绘/量算（落场景 JSON）+ 三维只读回显。 -->
<template>
  <div class="gis-workspace art-full-height">
    <div v-if="!status.enabled" class="gis-empty">
      <ElEmpty :description="$t('pages.gis.disabledTitle')" />
    </div>
    <div v-else-if="!hasReadyProvider" class="gis-empty">
      <ElEmpty :description="$t('pages.gis.emptyTitle')">
        <template #default>
          <p class="gis-empty-desc">{{ $t('pages.gis.emptyDesc') }}</p>
          <ElButton type="primary" @click="goProvider">{{ $t('pages.gis.goProvider') }}</ElButton>
        </template>
      </ElEmpty>
    </div>
    <template v-else>
      <div class="gis-map-shell">
        <div v-show="viewMode === '2d'" ref="olHost" class="gis-map"></div>
        <div v-show="viewMode === '3d'" ref="cesiumHost" class="gis-map">
          <div v-if="loading3d" class="gis-loading">{{ $t('pages.gis.load3d') }}</div>
        </div>

        <div class="gis-hud gis-hud-tl">
          <ElSelect
            v-model="sceneId"
            clearable
            filterable
            :placeholder="$t('pages.gis.selectScene')"
            class="gis-scene-select"
            @change="onSelectScene"
          >
            <ElOption v-for="s in scenes" :key="s.id" :label="s.name" :value="s.id!" />
          </ElSelect>
          <ElInput
            v-model="sceneName"
            :placeholder="$t('pages.gis.sceneNamePlaceholder')"
            class="gis-name-input"
          />
          <ElButton
            v-perm="'gis:scene:save'"
            type="primary"
            size="small"
            :loading="saving"
            @click="saveScene"
          >
            {{ $t('pages.gis.saveScene') }}
          </ElButton>
        </div>

        <div class="gis-hud gis-hud-tc">
          <ElAutocomplete
            v-model="searchText"
            class="gis-search"
            clearable
            value-key="name"
            :trigger-on-focus="false"
            :fetch-suggestions="queryPoi"
            :placeholder="$t('pages.gis.searchPlaceholder')"
            @select="onPoiSelect"
          >
            <template #default="{ item }">
              <div class="gis-poi">
                <div>{{ item.name }}</div>
                <div class="gis-poi-addr">{{
                  item.address || `${item.lon.toFixed(4)}, ${item.lat.toFixed(4)}`
                }}</div>
              </div>
            </template>
          </ElAutocomplete>
          <ElButton text size="small" @click="gotoOpen = true">{{ $t('pages.gis.goto') }}</ElButton>
        </div>

        <div class="gis-hud gis-hud-tr">
          <ElRadioGroup v-model="viewMode" size="small" @change="onViewModeChange">
            <ElRadioButton value="2d">{{ $t('pages.gis.mode2d') }}</ElRadioButton>
            <ElRadioButton value="3d">{{ $t('pages.gis.mode3d') }}</ElRadioButton>
          </ElRadioGroup>
          <ElSelect v-model="baseProvider" class="gis-provider-select" @change="onBasemapChange">
            <ElOption
              v-for="p in readyProviders"
              :key="p.provider"
              :label="$t(`pages.gis.provider${cap(p.provider)}`)"
              :value="p.provider"
            />
          </ElSelect>
          <ElSelect v-model="baseStyle" class="gis-style-select" @change="onBasemapChange">
            <ElOption value="vec" :label="$t('pages.gis.styleVec')" />
            <ElOption value="img" :label="$t('pages.gis.styleImg')" />
            <ElOption value="img_label" :label="$t('pages.gis.styleImgLabel')" />
            <ElOption value="vec_label" :label="$t('pages.gis.styleVecLabel')" />
          </ElSelect>
        </div>

        <div class="gis-hud gis-hud-rail">
          <button
            v-for="item in primaryTools"
            :key="item"
            type="button"
            class="gis-tool"
            :class="{ 'is-on': tool === item }"
            :title="$t(`pages.gis.tool${capTool(item)}`)"
            :aria-label="$t(`pages.gis.tool${capTool(item)}`)"
            @click="onToolChange(item)"
          >
            <ArtSvgIcon :icon="toolIcons[item]" />
          </button>
          <ElDropdown trigger="click" placement="right-start" @command="onMoreTool">
            <button
              type="button"
              class="gis-tool"
              :class="{ 'is-on': !!extraActiveLabel }"
              :title="$t('pages.gis.more')"
            >
              <ArtSvgIcon icon="ri:more-2-line" />
            </button>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem v-for="item in extraTools" :key="item" :command="`tool:${item}`">
                  {{ $t(`pages.gis.tool${capTool(item)}`) }}
                </ElDropdownItem>
                <ElDropdownItem command="heatmap" divided>
                  {{ heatmapOn ? '✓ ' : '' }}{{ $t('pages.gis.heatmap') }}
                </ElDropdownItem>
                <ElDropdownItem command="cluster">
                  {{ clusterOn ? '✓ ' : '' }}{{ $t('pages.gis.cluster') }}
                </ElDropdownItem>
                <ElDropdownItem command="overview">
                  {{ overviewOn ? '✓ ' : '' }}{{ $t('pages.gis.overview') }}
                </ElDropdownItem>
                <ElDropdownItem command="analyze">{{ $t('pages.gis.openAnalyze') }}</ElDropdownItem>
                <ElDropdownItem command="undo" divided :disabled="!canUndo">{{
                  $t('pages.gis.undo')
                }}</ElDropdownItem>
                <ElDropdownItem command="redo" :disabled="!canRedo">{{
                  $t('pages.gis.redo')
                }}</ElDropdownItem>
                <ElDropdownItem command="locate">{{ $t('pages.gis.locateMe') }}</ElDropdownItem>
                <ElDropdownItem
                  command="fit"
                  :disabled="!featureRows.length && !overlayRows.length"
                >
                  {{ $t('pages.gis.fitAll') }}
                </ElDropdownItem>
                <ElDropdownItem command="snapshot">{{ $t('pages.gis.snapshot') }}</ElDropdownItem>
                <ElDropdownItem command="export">{{ $t('pages.gis.exportJson') }}</ElDropdownItem>
                <ElDropdownItem command="import">{{ $t('pages.gis.importJson') }}</ElDropdownItem>
                <ElDropdownItem command="buffer" :disabled="!selectedFeat">
                  {{ $t('pages.gis.bufferSelected') }}
                </ElDropdownItem>
                <ElDropdownItem command="newScene">{{ $t('pages.gis.newScene') }}</ElDropdownItem>
                <ElDropdownItem v-if="sceneId" v-perm="'gis:scene:remove'" command="removeScene">
                  {{ $t('pages.gis.deleteScene') }}
                </ElDropdownItem>
                <ElDropdownItem command="clear" divided :disabled="!featureRows.length">
                  {{ $t('pages.gis.featClear') }}
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
          <button
            type="button"
            class="gis-tool"
            :class="{ 'is-on': panelOpen }"
            :title="$t('pages.gis.openLayers')"
            :aria-label="$t('pages.gis.openLayers')"
            @click="toggleLayerPanel"
          >
            <ArtSvgIcon icon="ri:stack-line" />
          </button>
        </div>

        <aside v-if="panelOpen" class="gis-hud gis-hud-panel">
          <ElTabs v-model="sideTab" class="gis-side-tabs">
            <ElTabPane
              :label="`${$t('pages.gis.wsSideOverlay')} (${overlayRows.length})`"
              name="overlay"
            >
              <ul v-if="overlayRows.length" class="gis-ov-list">
                <li v-for="row in overlayRows" :key="row.id" class="gis-ov-card">
                  <div class="gis-ov-row">
                    <ElCheckbox
                      :model-value="row.visible"
                      @update:model-value="
                        (v: boolean | string | number) => setOverlayVisible(row.id, Boolean(v))
                      "
                    />
                    <span class="gis-feat-kind">{{ overlayKindText(row.kind) }}</span>
                    <span class="gis-ov-name" :title="row.name">{{ row.name }}</span>
                    <span class="gis-ov-count">{{ row.count }}</span>
                    <ElButton link type="primary" @click="overlays?.fit(row.id)">{{
                      $t('pages.gis.featLocate')
                    }}</ElButton>
                    <ElButton link type="danger" @click="dropOverlay(row.id)">{{
                      $t('pages.gis.featDelete')
                    }}</ElButton>
                  </div>
                  <div class="gis-opacity-wrap" @pointerdown.stop @mousedown.stop>
                    <ElSlider
                      :model-value="Math.round(row.opacity * 100)"
                      :min="0"
                      :max="100"
                      :step="1"
                      size="small"
                      :format-tooltip="formatOpacityTip"
                      class="gis-opacity"
                      @update:model-value="(v: number | number[]) => setOverlayOpacity(row.id, v)"
                    />
                  </div>
                </li>
              </ul>
              <p v-else class="gis-feats-empty">{{ $t('pages.gis.overlayEmpty') }}</p>
              <div class="gis-feats-head">{{ $t('pages.gis.overlayPick') }}</div>
              <ul class="gis-ov-list">
                <li
                  v-for="row in catalogLayers"
                  :key="String(row.id)"
                  class="gis-feat-row"
                  @click="addOverlay(row)"
                >
                  <span class="gis-feat-kind">{{ overlayKindText(overlayKindOf(row.kind)) }}</span>
                  <span class="gis-ov-name" :title="row.name">{{ row.name }}</span>
                  <span class="gis-ov-count">{{ row.featureCount ?? 0 }}</span>
                </li>
              </ul>
            </ElTabPane>
            <ElTabPane
              :label="`${$t('pages.gis.wsSideSketch')} (${featureRows.length})`"
              name="sketch"
            >
              <p v-if="!featureRows.length" class="gis-feats-empty">{{
                $t('pages.gis.overlayDemoHint')
              }}</p>
              <ul v-else class="gis-feat-ul">
                <li
                  v-for="row in featureRows"
                  :key="row.id"
                  class="gis-feat-row"
                  :class="{ 'is-active': row.id === selectedId }"
                  @click="sketch?.selectById(row.id)"
                >
                  <ElCheckbox
                    :model-value="row.properties.visible"
                    @click.stop
                    @update:model-value="
                      (v: boolean | string | number) => sketch?.setVisible(row.id, Boolean(v))
                    "
                  />
                  <i
                    class="gis-feat-swatch"
                    :style="{ background: row.properties.color || '#2563eb' }"
                  />
                  <span class="gis-feat-kind">{{
                    $t(`pages.gis.kind${capKind(row.properties.kind)}`)
                  }}</span>
                  <span class="gis-ov-name" :title="row.properties.name">{{
                    row.properties.name
                  }}</span>
                  <ElButton link type="primary" @click.stop="sketch?.fit(row.id)">
                    {{ $t('pages.gis.featLocate') }}
                  </ElButton>
                  <ElButton link type="danger" @click.stop="sketch?.removeById(row.id)">
                    {{ $t('pages.gis.featDelete') }}
                  </ElButton>
                </li>
              </ul>
            </ElTabPane>
            <ElTabPane :label="$t('pages.gis.inspect')" name="inspect">
              <template v-if="selectedFeat">
                <ElForm label-position="top" size="small">
                  <ElFormItem :label="$t('pages.gis.featName')">
                    <ElInput
                      :model-value="selectedFeat.properties.name"
                      @change="
                        (v: string) =>
                          sketch?.setName(
                            selectedFeat!.id,
                            String(v).trim() || selectedFeat!.properties.name
                          )
                      "
                    />
                  </ElFormItem>
                  <ElFormItem :label="$t('pages.gis.featColor')">
                    <ElColorPicker
                      :model-value="selectedFeat.properties.color || '#2563eb'"
                      @change="(v: string | null) => v && sketch?.setColor(selectedFeat!.id, v)"
                    />
                  </ElFormItem>
                  <ElFormItem :label="$t('pages.gis.featRemark')">
                    <ElInput
                      type="textarea"
                      :rows="3"
                      :model-value="selectedFeat.properties.remark"
                      @change="(v: string) => sketch?.setRemark(selectedFeat!.id, v)"
                    />
                  </ElFormItem>
                </ElForm>
              </template>
              <p v-else class="gis-feats-empty">{{ $t('pages.gis.inspectEmpty') }}</p>
            </ElTabPane>
          </ElTabs>
        </aside>

        <p v-if="!featureRows.length && !overlayRows.length && !panelOpen" class="gis-coach">
          {{ $t('pages.gis.wsCoach') }}
        </p>

        <div class="gis-hud gis-hud-status">
          <span>{{ drawHint }}</span>
          <span v-if="cursorText">{{ cursorText }}</span>
          <span v-if="placeText">{{ placeText }}</span>
        </div>
      </div>
      <input
        ref="fileRef"
        class="gis-file"
        type="file"
        accept=".json,.geojson,application/geo+json"
        @change="onImportFile"
      />
      <ElDialog v-model="gotoOpen" :title="$t('pages.gis.goto')" width="420px">
        <ElInput
          v-model="gotoText"
          :placeholder="$t('pages.gis.gotoPlaceholder')"
          @keyup.enter="applyGoto"
        />
        <template #footer>
          <ElButton @click="gotoOpen = false">{{ $t('common.cancel') }}</ElButton>
          <ElButton type="primary" @click="applyGoto">{{ $t('pages.gis.goto') }}</ElButton>
        </template>
      </ElDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type Map from 'ol/Map'
  import {
    fetchGisScenePage,
    fetchGisSceneDetail,
    fetchGisStatus,
    fetchRemoveGisScene,
    fetchSaveGisScene,
    fetchGisSearch,
    fetchGisReverse,
    fetchGisLayerList,
    fetchGisLayerDetail,
    fetchGisAnalyze,
    type GisId,
    type GisLayerRow,
    type GisPoi,
    type GisProviderStatus,
    type GisScene
  } from '@/api/gis'
  import {
    DEFAULT_SCENE,
    featuresFromImportJson,
    layersWithSketch,
    parseSceneJson,
    sketchFeaturesFromLayers,
    type GisDrawTool,
    type GisFeatureKind,
    type GisOverlayRef,
    type OverlayKind,
    type GisProviderCode,
    type GisSceneSpec,
    type GisSketchFeature,
    type GisStyleCode,
    type GisViewMode
  } from '@/gis/types'
  import type { CesiumMod, CesiumViewer } from '@/gis/cesiumMap'
  import type { OlSketchHandle } from '@/gis/olSketch'
  import {
    attachOlOverlays,
    collectionToSketch,
    parseRasterSpec,
    type OlOverlayHandle,
    type OverlayEntry
  } from '@/gis/olOverlay'
  import { attachOverview, type OlOverviewHandle } from '@/gis/olOverview'
  import { downloadDataUrl, snapshotOlMap } from '@/gis/olSnapshot'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  defineOptions({ name: 'GisWorkspace' })

  const { t } = useI18n()
  const router = useRouter()
  const route = useRoute()

  const primaryTools: GisDrawTool[] = ['pan', 'select', 'point', 'line', 'polygon']
  const extraTools: GisDrawTool[] = ['circle', 'rect', 'text', 'measureLength', 'measureArea']
  const toolIcons: Record<string, string> = {
    pan: 'ri:drag-move-line',
    select: 'ri:cursor-line',
    point: 'ri:map-pin-2-line',
    line: 'ri:guide-line',
    polygon: 'ri:shape-line'
  }
  const extraActiveLabel = computed(() => {
    if (!extraTools.includes(tool.value)) {
      return ''
    }
    return t(`pages.gis.tool${capTool(tool.value)}`)
  })
  const sideTab = ref('overlay')
  const panelOpen = ref(false)

  const toggleLayerPanel = (): void => {
    panelOpen.value = !panelOpen.value
    if (panelOpen.value) {
      sideTab.value = 'overlay'
    }
  }

  const status = ref({ enabled: true, providers: [] as GisProviderStatus[] })
  const scenes = ref<GisScene[]>([])
  const sceneId = ref<GisId | undefined>()
  const sceneName = ref('')
  const viewMode = ref<GisViewMode>('2d')
  const baseProvider = ref<GisProviderCode>('tianditu')
  const lastProvider = ref<GisProviderCode>('tianditu')
  const baseStyle = ref<GisStyleCode>('img_label')
  const saving = ref(false)
  const loading3d = ref(false)
  const tool = ref<GisDrawTool>('pan')
  const featureRows = ref<GisSketchFeature[]>([])
  const selectedId = ref<string | undefined>()
  const canUndo = ref(false)
  const canRedo = ref(false)
  const heatmapOn = ref(false)
  const clusterOn = ref(false)
  const overviewOn = ref(false)
  const overlayRows = ref<OverlayEntry[]>([])
  const catalogLayers = ref<GisLayerRow[]>([])
  const searchText = ref('')
  const gotoOpen = ref(false)
  const gotoText = ref('116.397428, 39.90923')
  const placeText = ref('')
  const fileRef = ref<HTMLInputElement>()
  const cursorText = ref('')
  const olHost = ref<HTMLElement>()
  const cesiumHost = ref<HTMLElement>()

  let olMap: Map | undefined
  let sketch: OlSketchHandle | undefined
  let overlays: OlOverlayHandle | undefined
  let overview: OlOverviewHandle | undefined
  let cesiumMod: CesiumMod | undefined
  let cesiumViewer: CesiumViewer | undefined
  let cesiumSketch: InstanceType<CesiumMod['DataSource']> | undefined
  let cesiumApi: typeof import('@/gis/cesiumMap') | undefined
  let olApi: typeof import('@/gis/olMap') | undefined
  let pointerKey: unknown
  let clickKey: unknown
  let resizeObs: ResizeObserver | undefined

  const readyProviders = computed(() =>
    status.value.providers.filter((p) => p.configured && p.enabled)
  )
  const hasReadyProvider = computed(() => readyProviders.value.length > 0)

  const drawHint = computed(() => t(`pages.gis.hint${capTool(tool.value)}`))

  const cap = (code: string): string => {
    if (code === 'tianditu') return 'Tianditu'
    if (code === 'amap') return 'Amap'
    if (code === 'baidu') return 'Baidu'
    return 'Google'
  }

  const selectedFeat = computed(() => featureRows.value.find((f) => f.id === selectedId.value))
  watch(selectedFeat, (feat) => {
    if (feat) {
      sideTab.value = 'inspect'
      panelOpen.value = true
    }
  })

  const capTool = (code: GisDrawTool): string => {
    if (code === 'measureLength') return 'MeasureLength'
    if (code === 'measureArea') return 'MeasureArea'
    return `${code.charAt(0).toUpperCase()}${code.slice(1)}`
  }

  const capKind = (kind: GisFeatureKind): string => capTool(kind)

  const goProvider = (): void => {
    router.push('/gis/provider')
  }

  const captureSpec = (): GisSceneSpec => {
    const spec: GisSceneSpec = {
      viewMode: viewMode.value,
      baseMap: { provider: baseProvider.value, style: baseStyle.value },
      view2d: { ...DEFAULT_SCENE.view2d },
      view3d: { ...DEFAULT_SCENE.view3d },
      layers: layersWithSketch(sketch?.exportFeatures(baseProvider.value) ?? []),
      overlayLayers: overlays?.list().map((row) => ({
        id: row.id,
        layerId: row.layerId,
        name: row.name,
        kind: row.kind,
        visible: row.visible,
        color: row.color,
        opacity: row.opacity
      })),
      heatmap: heatmapOn.value
    }
    if (olMap && olApi) {
      spec.view2d = olApi.readOlView(olMap, baseProvider.value)
    }
    if (cesiumMod && cesiumViewer && cesiumApi) {
      spec.view3d = cesiumApi.readCesiumView(cesiumMod, cesiumViewer, baseProvider.value)
    }
    return spec
  }

  const syncSketchState = (): void => {
    featureRows.value = sketch?.exportFeatures(baseProvider.value) ?? []
    selectedId.value = sketch?.selectedId()
    canUndo.value = sketch?.canUndo() ?? false
    canRedo.value = sketch?.canRedo() ?? false
  }

  const flyTo = (lon: number, lat: number, zoom = 15): void => {
    if (olMap && olApi) {
      olApi.setOlView(olMap, { center: [lon, lat], zoom, rotation: 0 }, baseProvider.value)
    }
    if (viewMode.value === '3d' && cesiumMod && cesiumViewer && cesiumApi) {
      cesiumApi.flyCesiumTo(
        cesiumMod,
        cesiumViewer,
        { lon, lat, height: Math.max(1200, 40000000 / Math.pow(2, zoom)), heading: 0, pitch: -45 },
        baseProvider.value
      )
    }
  }

  const parseLonLatText = (raw: string): [number, number] | undefined => {
    const parts = raw
      .trim()
      .split(/[,，\s]+/)
      .filter(Boolean)
    if (parts.length < 2) {
      return undefined
    }
    const a = Number(parts[0])
    const b = Number(parts[1])
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return undefined
    }
    if (Math.abs(a) <= 180 && Math.abs(b) <= 90) {
      return [a, b]
    }
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
      return [b, a]
    }
    return undefined
  }

  const bindPointer = (): void => {
    if (!olMap || !olApi || pointerKey) return
    pointerKey = olMap.on('pointermove', (evt) => {
      if (evt.dragging || !olMap || !olApi) return
      const wgs = olApi.pointerWgs84(olMap, evt.pixel, baseProvider.value)
      cursorText.value = wgs
        ? `${t('pages.gis.cursorWgs84')} ${wgs[0].toFixed(6)}, ${wgs[1].toFixed(6)}`
        : ''
    })
  }

  const bindMapClick = (): void => {
    if (!olMap || !olApi || clickKey) return
    clickKey = olMap.on('singleclick', (evt) => {
      if (!olMap || !olApi) return
      if (tool.value !== 'pan' && tool.value !== 'select') return
      let hit = ''
      olMap.forEachFeatureAtPixel(evt.pixel, (feat) => {
        const id = String(feat.getId() ?? feat.get('mugsunId') ?? '')
        if (id) {
          hit = id
          return true
        }
        return undefined
      })
      if (hit) {
        sketch?.selectById(hit)
        return
      }
      if (tool.value !== 'pan') return
      const wgs = olApi.pointerWgs84(olMap, evt.pixel, baseProvider.value)
      if (!wgs) return
      void fetchGisReverse(wgs[0], wgs[1])
        .then((rev) => {
          placeText.value = [rev.address, rev.poi].filter(Boolean).join(' · ')
        })
        .catch(() => {
          placeText.value = ''
        })
    })
  }

  const bindResize = (): void => {
    resizeObs?.disconnect()
    const el = olHost.value?.parentElement
    if (!el) return
    resizeObs = new ResizeObserver(() => {
      olMap?.updateSize()
      cesiumViewer?.resize()
    })
    resizeObs.observe(el)
  }

  const ensureOl = async (): Promise<void> => {
    if (olMap || !olHost.value) return
    await import('ol/ol.css')
    olApi = await import('@/gis/olMap')
    const sketchApi = await import('@/gis/olSketch')
    olMap = olApi.createOlMap(olHost.value, DEFAULT_SCENE.view2d, baseProvider.value)
    sketch = sketchApi.attachOlSketch(olMap)
    overlays = attachOlOverlays(olMap)
    overview = attachOverview(olMap)
    sketch.onChange(syncSketchState)
    olApi.applyOlBasemap(olMap, baseProvider.value, baseStyle.value)
    bindPointer()
    bindMapClick()
    bindResize()
  }

  const refreshCesiumSketch = async (): Promise<void> => {
    if (!cesiumMod || !cesiumViewer || !cesiumApi) return
    cesiumSketch = await cesiumApi.syncCesiumSketch(
      cesiumMod,
      cesiumViewer,
      [
        ...(sketch?.exportFeatures(baseProvider.value) ?? []),
        ...(overlays?.exportAll(baseProvider.value) ?? [])
      ],
      baseProvider.value,
      cesiumSketch
    )
  }

  const ensureCesium = async (): Promise<void> => {
    if (cesiumViewer || !cesiumHost.value) return
    loading3d.value = true
    try {
      cesiumApi = await import('@/gis/cesiumMap')
      cesiumMod = await cesiumApi.loadCesium()
      cesiumViewer = cesiumApi.createCesiumViewer(cesiumHost.value, cesiumMod)
      cesiumApi.applyCesiumBasemap(cesiumMod, cesiumViewer, baseProvider.value, baseStyle.value)
      cesiumApi.flyCesiumTo(cesiumMod, cesiumViewer, DEFAULT_SCENE.view3d, baseProvider.value)
      await refreshCesiumSketch()
    } finally {
      loading3d.value = false
    }
  }

  const applyBasemap = (): void => {
    if (olMap && olApi) {
      olApi.applyOlBasemap(olMap, baseProvider.value, baseStyle.value)
    }
    if (cesiumMod && cesiumViewer && cesiumApi) {
      cesiumApi.applyCesiumBasemap(cesiumMod, cesiumViewer, baseProvider.value, baseStyle.value)
    }
  }

  const applySpec = async (spec: GisSceneSpec): Promise<void> => {
    viewMode.value = spec.viewMode
    baseProvider.value = spec.baseMap.provider
    lastProvider.value = spec.baseMap.provider
    baseStyle.value = spec.baseMap.style
    await nextTick()
    await ensureOl()
    if (olMap && olApi) {
      olApi.applyOlBasemap(olMap, baseProvider.value, baseStyle.value)
      olApi.setOlView(olMap, spec.view2d, baseProvider.value)
      sketch?.importFeatures(sketchFeaturesFromLayers(spec.layers), baseProvider.value)
      sketch?.setHeatmap(spec.heatmap === true)
      heatmapOn.value = spec.heatmap === true
      await applyOverlays(spec.overlayLayers ?? [])
      olMap.updateSize()
    }
    if (viewMode.value === '3d') {
      await ensureCesium()
      if (cesiumMod && cesiumViewer && cesiumApi) {
        cesiumApi.applyCesiumBasemap(cesiumMod, cesiumViewer, baseProvider.value, baseStyle.value)
        cesiumApi.flyCesiumTo(cesiumMod, cesiumViewer, spec.view3d, baseProvider.value)
        cesiumViewer.resize()
        await refreshCesiumSketch()
      }
    }
    tool.value = 'pan'
    sketch?.setTool('pan')
  }

  const pickDefaultProvider = (): void => {
    const first = readyProviders.value[0]
    if (first) {
      baseProvider.value = first.provider as GisProviderCode
      lastProvider.value = baseProvider.value
    }
  }

  const onBasemapChange = (): void => {
    const feats = sketch?.exportFeatures(lastProvider.value) ?? []
    const view2d =
      olMap && olApi ? olApi.readOlView(olMap, lastProvider.value) : { ...DEFAULT_SCENE.view2d }
    applyBasemap()
    if (olMap && olApi) {
      olApi.setOlView(olMap, view2d, baseProvider.value)
    }
    sketch?.importFeatures(feats, baseProvider.value)
    lastProvider.value = baseProvider.value
    void applyOverlays(
      overlays?.list().map((row) => ({
        id: row.id,
        layerId: row.layerId,
        name: row.name,
        kind: row.kind,
        visible: row.visible,
        color: row.color
      })) ?? []
    )
    void refreshCesiumSketch()
    syncSketchState()
  }

  const onViewModeChange = async (): Promise<void> => {
    const spec = captureSpec()
    spec.viewMode = viewMode.value
    if (viewMode.value === '3d') {
      sketch?.abort()
      tool.value = 'pan'
      spec.view3d = {
        lon: spec.view2d.center[0],
        lat: spec.view2d.center[1],
        height: Math.max(2000, 40000000 / Math.pow(2, spec.view2d.zoom)),
        heading: 0,
        pitch: -45
      }
    } else {
      spec.view2d.center = [spec.view3d.lon, spec.view3d.lat]
    }
    await applySpec(spec)
  }

  const onToolChange = async (val: string | number | boolean | undefined): Promise<void> => {
    const next = String(val) as GisDrawTool
    if (next !== 'pan' && next !== 'select' && viewMode.value === '3d') {
      ElMessage.info(t('pages.gis.drawNeed2d'))
      viewMode.value = '2d'
      await onViewModeChange()
    }
    tool.value = next
    sketch?.setTool(next)
  }

  const syncOverlayRows = (): void => {
    overlayRows.value = overlays?.list() ?? []
  }

  const formatOpacityTip = (v: number): string => `${v}%`

  const setOverlayVisible = (id: string, visible: boolean): void => {
    overlays?.setVisible(id, visible)
    const row = overlayRows.value.find((item) => item.id === id)
    if (row) {
      row.visible = visible
    }
  }

  const setOverlayOpacity = (id: string, raw: number | number[]): void => {
    const pct = Number(Array.isArray(raw) ? raw[0] : raw)
    if (!Number.isFinite(pct)) {
      return
    }
    overlays?.setOpacity(id, pct / 100)
    const row = overlayRows.value.find((item) => item.id === id)
    if (row) {
      row.opacity = Math.min(1, Math.max(0, pct / 100))
    }
  }

  const applyOverlays = async (refs: GisOverlayRef[]): Promise<void> => {
    overlays?.clear()
    for (const item of refs) {
      if (!item.layerId) {
        continue
      }
      const row = await fetchGisLayerDetail(item.layerId)
      let parsed: unknown = {}
      try {
        parsed = row.dataJson ? JSON.parse(row.dataJson) : {}
      } catch {
        parsed = {}
      }
      const raster = row.kind === 'xyz' || row.kind === 'wms' ? parseRasterSpec(parsed) : undefined
      if (raster) {
        overlays?.setRaster(`ov-${item.layerId}`, raster, {
          layerId: item.layerId,
          name: item.name || row.name,
          kind: row.kind === 'wms' ? 'wms' : 'xyz',
          visible: item.visible,
          opacity: item.opacity
        })
        continue
      }
      const feats = collectionToSketch(parsed)
      overlays?.set(`ov-${item.layerId}`, feats, baseProvider.value, {
        layerId: item.layerId,
        name: item.name || row.name,
        kind: overlayKindOf(item.kind, row.kind),
        visible: item.visible,
        color: item.color,
        opacity: item.opacity
      })
    }
    syncOverlayRows()
    void refreshCesiumSketch()
  }

  const addOverlay = async (row: GisLayerRow): Promise<void> => {
    if (row.id == null || row.id === '') {
      return
    }
    const already = overlayRows.value.some((o) => String(o.layerId) === String(row.id))
    if (already) {
      overlays?.fit(`ov-${row.id}`)
      return
    }
    await applyOverlays([
      ...overlayRows.value.map((o) => ({
        id: o.id,
        layerId: o.layerId,
        name: o.name,
        kind: overlayKindOf(o.kind),
        visible: o.visible,
        color: o.color,
        opacity: o.opacity
      })),
      {
        id: `ov-${row.id}`,
        layerId: row.id,
        name: row.name,
        kind: overlayKindOf(row.kind),
        visible: true
      }
    ])
    overlays?.fit(`ov-${row.id}`)
  }

  const dropOverlay = (id: string): void => {
    overlays?.remove(id)
    syncOverlayRows()
    void refreshCesiumSketch()
  }

  const onMoreTool = (cmd: string | number): void => {
    const key = String(cmd)
    if (key.startsWith('tool:')) {
      void onToolChange(key.slice(5))
      return
    }
    if (key === 'heatmap') {
      heatmapOn.value = !heatmapOn.value
      onHeatmapChange(heatmapOn.value)
      return
    }
    if (key === 'cluster') {
      clusterOn.value = !clusterOn.value
      onClusterChange(clusterOn.value)
      return
    }
    if (key === 'overview') {
      overviewOn.value = !overviewOn.value
      onOverviewChange(overviewOn.value)
      return
    }
    if (key === 'newScene') {
      void newScene()
      return
    }
    if (key === 'removeScene') {
      void removeScene()
      return
    }
    if (key === 'undo') {
      sketch?.undo()
      return
    }
    if (key === 'redo') {
      sketch?.redo()
      return
    }
    if (key === 'locate') {
      locateMe()
      return
    }
    if (key === 'fit') {
      if (overlayRows.value.length) {
        overlays?.fitAll()
      } else {
        sketch?.fitAll()
      }
      return
    }
    if (key === 'snapshot') {
      void takeSnapshot()
      return
    }
    if (key === 'export') {
      exportGeoJson()
      return
    }
    if (key === 'import') {
      fileRef.value?.click()
      return
    }
    if (key === 'buffer') {
      void bufferSelected()
      return
    }
    if (key === 'analyze') {
      void router.push('/gis/analyze')
      return
    }
    if (key === 'clear') {
      void clearSketch()
    }
  }

  const loadCatalog = async (): Promise<void> => {
    catalogLayers.value = (await fetchGisLayerList()) ?? []
  }

  const overlayKindOf = (kind?: string, fallback?: string): OverlayKind => {
    const raw = kind || fallback
    if (raw === 'heatmap' || raw === 'xyz' || raw === 'wms') {
      return raw
    }
    return 'vector'
  }

  const overlayKindText = (kind: OverlayKind): string => {
    if (kind === 'heatmap') {
      return t('pages.gis.heatmap')
    }
    if (kind === 'xyz') {
      return t('pages.gis.kindXyz')
    }
    if (kind === 'wms') {
      return t('pages.gis.kindWms')
    }
    return t('pages.gis.kindVector')
  }

  const onClusterChange = (val: string | number | boolean): void => {
    overlays?.setCluster(Boolean(val))
  }

  const onHeatmapChange = (val: string | number | boolean): void => {
    sketch?.setHeatmap(Boolean(val))
  }

  const onOverviewChange = (val: string | number | boolean): void => {
    overview?.setEnabled(Boolean(val))
  }

  const takeSnapshot = async (): Promise<void> => {
    if (!olMap) {
      return
    }
    const url = await snapshotOlMap(olMap)
    downloadDataUrl(url, `${(sceneName.value.trim() || 'map').replace(/[\\/:*?"<>|]/g, '_')}.png`)
    ElMessage.success(t('pages.gis.snapshot'))
  }

  const bufferSelected = async (): Promise<void> => {
    const feat = selectedFeat.value
    if (!feat) {
      return
    }
    const data = await fetchGisAnalyze({
      op: 'buffer',
      distance: 500,
      payload: { type: 'FeatureCollection', features: [feat] }
    })
    overlays?.set('ov-buffer-tmp', collectionToSketch(data.collection), baseProvider.value, {
      name: t('pages.gis.opBuffer'),
      kind: 'vector',
      color: '#db2777'
    })
    overlays?.fit('ov-buffer-tmp')
    syncOverlayRows()
  }

  type GisPoiSuggest = GisPoi & { value: string }

  const queryPoi = async (q: string): Promise<GisPoiSuggest[]> => {
    const keyword = q.trim()
    if (keyword.length < 2) {
      return []
    }
    try {
      const center =
        olMap && olApi
          ? olApi.readOlView(olMap, baseProvider.value).center
          : DEFAULT_SCENE.view2d.center
      const list = await fetchGisSearch({ q: keyword, lon: center[0], lat: center[1] })
      return (list ?? []).map((item) => ({
        ...item,
        value: item.name
      }))
    } catch {
      return []
    }
  }

  const onPoiSelect = (item: Record<string, unknown>): void => {
    const name = String(item.name ?? '')
    const lon = Number(item.lon)
    const lat = Number(item.lat)
    if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      return
    }
    searchText.value = name
    flyTo(lon, lat, 16)
    sketch?.addWgs84Point([lon, lat], baseProvider.value, name, String(item.address ?? ''))
    placeText.value = [name, item.address].filter(Boolean).join(' · ')
    ElMessage.success(t('pages.gis.located'))
  }

  const applyGoto = (): void => {
    const lonlat = parseLonLatText(gotoText.value)
    if (!lonlat) {
      ElMessage.warning(t('pages.gis.gotoInvalid'))
      return
    }
    flyTo(lonlat[0], lonlat[1], 15)
    sketch?.addWgs84Point(
      lonlat,
      baseProvider.value,
      t('pages.gis.gotoPoint'),
      `${lonlat[0]}, ${lonlat[1]}`
    )
    gotoOpen.value = false
  }

  const exportGeoJson = (): void => {
    const features = sketch?.exportFeatures(baseProvider.value) ?? []
    const body = JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
    const blob = new Blob([body], { type: 'application/geo+json' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `${(sceneName.value.trim() || 'scene').replace(/[\\/:*?"<>|]/g, '_')}.geojson`
    link.click()
    URL.revokeObjectURL(href)
  }

  const onImportFile = async (ev: Event): Promise<void> => {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      ElMessage.error(t('pages.gis.importFail'))
      return
    }
    const features = featuresFromImportJson(parsed)
    if (!features.length) {
      ElMessage.warning(t('pages.gis.importEmpty'))
      return
    }
    if (featureRows.value.length) {
      try {
        await ElMessageBox.confirm(t('pages.gis.importReplaceConfirm'), t('pages.gis.importJson'), {
          type: 'warning'
        })
      } catch {
        return
      }
    }
    sketch?.importFeatures(features, baseProvider.value)
    ElMessage.success(t('pages.gis.imported', { n: features.length }))
  }

  const onSketchKey = (ev: KeyboardEvent): void => {
    const el = ev.target as HTMLElement | null
    const tag = el?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) {
      return
    }
    const meta = ev.ctrlKey || ev.metaKey
    if (meta && ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
      ev.preventDefault()
      sketch?.undo()
      return
    }
    if (meta && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) {
      ev.preventDefault()
      sketch?.redo()
    }
  }

  const loadScenes = async (): Promise<void> => {
    const page = await fetchGisScenePage({ pageNum: 1, pageSize: 50 })
    scenes.value = page?.records ?? []
  }

  const onSelectScene = async (id: GisId | undefined): Promise<void> => {
    if (id == null || id === '') return
    const row = await fetchGisSceneDetail(id)
    sceneName.value = row.name
    await applySpec(parseSceneJson(row.sceneJson))
  }

  const newScene = async (): Promise<void> => {
    sceneId.value = undefined
    sceneName.value = ''
    pickDefaultProvider()
    await applySpec({
      ...DEFAULT_SCENE,
      baseMap: { provider: baseProvider.value, style: 'img_label' },
      layers: [],
      heatmap: false
    })
  }

  const saveScene = async (): Promise<void> => {
    const name = sceneName.value.trim()
    if (!name) {
      ElMessage.warning(t('pages.gis.sceneNamePlaceholder'))
      return
    }
    saving.value = true
    try {
      const isNew = sceneId.value == null
      const saved = await fetchSaveGisScene({
        id: sceneId.value,
        name,
        sceneJson: JSON.stringify(captureSpec())
      })
      sceneId.value = saved.id
      ElMessage.success(isNew ? t('pages.gis.created') : t('pages.gis.saved'))
      await loadScenes()
    } finally {
      saving.value = false
    }
  }

  const removeScene = async (): Promise<void> => {
    if (!sceneId.value) return
    await ElMessageBox.confirm(t('pages.gis.deleteSceneConfirm'), t('pages.gis.deleteScene'), {
      type: 'warning'
    })
    await fetchRemoveGisScene([sceneId.value])
    ElMessage.success(t('pages.gis.deletedScene'))
    await newScene()
    await loadScenes()
  }

  const clearSketch = async (): Promise<void> => {
    await ElMessageBox.confirm(t('pages.gis.featClearConfirm'), t('pages.gis.featClearTitle'), {
      type: 'warning'
    })
    sketch?.clear()
  }

  const locateMe = (): void => {
    if (!navigator.geolocation) {
      ElMessage.warning(t('pages.gis.locateDenied'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center: [number, number] = [pos.coords.longitude, pos.coords.latitude]
        if (olMap && olApi) {
          olApi.setOlView(olMap, { center, zoom: 15, rotation: 0 }, baseProvider.value)
        }
        if (viewMode.value === '3d' && cesiumMod && cesiumViewer && cesiumApi) {
          cesiumApi.flyCesiumTo(
            cesiumMod,
            cesiumViewer,
            { lon: center[0], lat: center[1], height: 2500, heading: 0, pitch: -45 },
            baseProvider.value
          )
        }
      },
      () => ElMessage.warning(t('pages.gis.locateDenied')),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const bootMap = async (): Promise<void> => {
    pickDefaultProvider()
    await nextTick()
    await ensureOl()
    applyBasemap()
  }

  const queryId = (raw: unknown): string => {
    if (typeof raw === 'string' || typeof raw === 'number') {
      const text = String(raw).trim()
      return /^\d+$/.test(text) ? text : ''
    }
    return ''
  }

  const onWorkspacePage = (): boolean => {
    const path = route.path.replace(/\/+$/, '')
    return path === '/gis/workspace' || route.name === 'GisWorkspace'
  }

  const applyRouteQuery = async (): Promise<void> => {
    if (!onWorkspacePage()) {
      return
    }
    const sceneIdQ = queryId(route.query.sceneId)
    const layerIdQ = queryId(route.query.layerId)
    const demoQ = typeof route.query.demo === 'string' ? route.query.demo.trim() : ''
    if (sceneIdQ) {
      sceneId.value = sceneIdQ
      await onSelectScene(sceneIdQ)
      return
    }
    if (demoQ) {
      await router.replace({ path: '/gis/lab', query: { code: demoQ } })
      return
    }
    if (layerIdQ) {
      const row = await fetchGisLayerDetail(layerIdQ)
      await addOverlay(row)
    }
  }

  watch(
    () =>
      `${queryId(route.query.sceneId)}:${queryId(route.query.layerId)}:${String(route.query.demo || '')}`,
    () => {
      if (!olMap) {
        return
      }
      void applyRouteQuery()
    }
  )

  onActivated(() => {
    if (!olMap) {
      return
    }
    olMap.updateSize()
    void applyRouteQuery()
  })

  watch(panelOpen, (open) => {
    if (open) {
      void loadCatalog()
    }
  })

  onMounted(async () => {
    status.value = await fetchGisStatus()
    if (!status.value.enabled || !hasReadyProvider.value) return
    await loadScenes()
    await bootMap()
    await applyRouteQuery()
    document.addEventListener('keydown', onSketchKey)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onSketchKey)
    resizeObs?.disconnect()
    overlays?.destroy()
    overlays = undefined
    overview?.destroy()
    overview = undefined
    sketch?.destroy()
    sketch = undefined
    olMap?.setTarget(undefined)
    olMap = undefined
    cesiumViewer?.destroy()
    cesiumViewer = undefined
  })
</script>

<style scoped>
  .gis-workspace {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .gis-map-shell {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--el-fill-color-darker);
    border-radius: 8px;
  }

  .gis-map {
    position: absolute;
    inset: 0;
  }

  .gis-map :deep(.ol-zoom) {
    top: auto;
    bottom: 52px;
    left: 12px;
  }

  .gis-hud {
    position: absolute;
    z-index: 5;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    background: color-mix(in srgb, var(--el-bg-color) 92%, transparent);
    backdrop-filter: blur(8px);
    border: 1px solid var(--el-border-color-extra-light);
    border-radius: 10px;
    box-shadow: var(--el-box-shadow-light);
  }

  .gis-hud-tl {
    top: 12px;
    left: 12px;
  }

  .gis-hud-tc {
    top: 12px;
    left: 50%;
    width: min(360px, calc(100% - 520px));
    transform: translateX(-50%);
  }

  .gis-hud-tr {
    top: 12px;
    right: 12px;
  }

  .gis-hud-rail {
    top: 72px;
    left: 12px;
    flex-direction: column;
    padding: 6px;
  }

  .gis-hud-panel {
    top: 72px;
    bottom: 52px;
    left: 64px;
    flex-direction: column;
    align-items: stretch;
    width: 280px;
    padding: 8px 10px;
    overflow: hidden;
  }

  .gis-hud-status {
    right: 12px;
    bottom: 12px;
    max-width: min(520px, calc(100% - 160px));
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .gis-tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 8px;
  }

  .gis-tool:hover,
  .gis-tool.is-on {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .gis-coach {
    position: absolute;
    top: 72px;
    left: 50%;
    z-index: 4;
    max-width: 420px;
    padding: 8px 12px;
    margin: 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
    pointer-events: none;
    background: color-mix(in srgb, var(--el-bg-color) 92%, transparent);
    border-radius: 8px;
    box-shadow: var(--el-box-shadow-light);
    transform: translateX(-50%);
  }

  .gis-side-tabs {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .gis-side-tabs :deep(.el-tabs__header) {
    margin: 0 0 8px;
  }

  .gis-side-tabs :deep(.el-tabs__content),
  .gis-side-tabs :deep(.el-tab-pane) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: auto;
  }

  .gis-scene-select,
  .gis-name-input {
    flex-shrink: 0;
    width: 132px;
  }

  .gis-provider-select,
  .gis-style-select {
    flex-shrink: 0;
    width: 108px;
  }

  .gis-search {
    flex: 1;
    min-width: 0;
  }

  .gis-heat {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: var(--el-text-color-regular);
    cursor: pointer;
  }

  .gis-file {
    display: none;
  }

  .gis-hint {
    flex-shrink: 0;
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gis-body {
    display: flex;
    flex: 1;
    gap: 8px;
    min-height: 0;
  }

  .gis-feats {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 280px;
    min-height: 0;
    padding: 8px;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .gis-inspect {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 220px;
    min-height: 0;
    padding: 8px;
    overflow: auto;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .gis-feats-head {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  .gis-feats-empty {
    margin: 12px 4px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .gis-feat-ul {
    flex: 1;
    min-height: 0;
    padding: 0;
    margin: 0;
    overflow: auto;
    list-style: none;
  }

  .gis-ov-list {
    flex: 0 1 auto;
    max-height: 42%;
    padding: 0;
    margin: 0 0 8px;
    overflow: auto;
    list-style: none;
  }

  .gis-ov-card {
    padding: 6px 2px 4px;
    border-bottom: 1px solid var(--el-border-color-extra-light);
  }

  .gis-ov-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .gis-ov-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gis-ov-count {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gis-feat-ul-short {
    flex: 0 0 auto;
    max-height: 28%;
  }

  .gis-feat-row {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 4px;
    cursor: pointer;
    border-bottom: 1px solid var(--el-border-color-extra-light);
    border-radius: 4px;
  }

  .gis-feat-row.is-active {
    background: var(--el-color-primary-light-9);
  }

  .gis-feat-swatch {
    display: inline-block;
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .gis-feat-kind {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gis-feat-name {
    flex: 1;
    min-width: 0;
  }

  .gis-feat-label {
    flex-shrink: 0;
    max-width: 72px;
    overflow: hidden;
    font-size: 12px;
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gis-place {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gis-poi-addr {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gis-opacity-wrap {
    width: 100%;
    padding: 8px 4px 2px;
  }

  .gis-opacity {
    width: 100%;
    margin: 0;
  }

  .gis-opacity :deep(.el-slider__runway) {
    height: 6px;
  }

  .gis-attrs {
    margin: 0 0 8px;
    font-size: 12px;
  }

  .gis-attrs dt {
    color: var(--el-text-color-secondary);
  }

  .gis-attrs dd {
    margin: 0 0 6px;
    word-break: break-all;
  }

  .gis-inspect-actions {
    display: flex;
    gap: 8px;
  }

  .gis-empty {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
  }

  .gis-empty-desc {
    max-width: 480px;
    margin: 0 0 16px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
  }

  .gis-loading {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-regular);
    background: color-mix(in srgb, var(--el-bg-color) 70%, transparent);
  }

  .gis-map :deep(.cesium-viewer),
  .gis-map :deep(.cesium-widget),
  .gis-map :deep(.cesium-widget canvas) {
    width: 100%;
    height: 100%;
  }

  .gis-map :deep(.gis-measure-tip) {
    padding: 2px 8px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    pointer-events: none;
    background: var(--el-bg-color-overlay);
    border-radius: 4px;
    box-shadow: var(--el-box-shadow-light);
  }
</style>
