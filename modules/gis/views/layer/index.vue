<!-- 图层库：全幅地图预览 + 左侧 HUD 目录。 -->
<template>
  <div class="gis-shell art-full-height">
    <div class="gis-map-shell">
      <div ref="mapHost" class="gis-map"></div>
      <aside class="gis-hud gis-hud-panel">
        <div class="gis-hud-head">
          <ElInput
            v-model="keyword"
            clearable
            size="small"
            :placeholder="$t('pages.gis.layerSearch')"
            class="gis-hud-search"
            @keyup.enter="load"
          />
          <ElButton size="small" @click="load">{{ $t('table.searchBar.search') }}</ElButton>
          <ElButton v-perm="'gis:layer:save'" size="small" type="primary" @click="openCreate">
            {{ $t('pages.gis.layerAdd') }}
          </ElButton>
        </div>
        <p v-if="!loading && !rows.length" class="gis-list-empty">
          {{ searching ? $t('pages.gis.emptyLayerSearch') : $t('pages.gis.emptyLayerList') }}
        </p>
        <ul v-else v-loading="loading" class="gis-list">
          <li
            v-for="row in rows"
            :key="String(row.id)"
            class="gis-list-row"
            :class="{ 'is-on': String(row.id) === selectedId }"
            @click="preview(row)"
          >
            <span class="gis-list-meta">{{ kindText(row.kind) }}</span>
            <span class="gis-list-name" :title="row.name">{{ row.name }}</span>
            <span class="gis-list-meta">{{ row.featureCount ?? 0 }}</span>
            <ElButton link type="primary" @click.stop="openOnMap(row)">{{
              $t('pages.gis.overlay')
            }}</ElButton>
            <ElButton v-perm="'gis:layer:remove'" link type="danger" @click.stop="remove(row)">
              {{ $t('pages.gis.featDelete') }}
            </ElButton>
          </li>
        </ul>
        <div class="gis-hud-pager">
          <ElPagination
            background
            small
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="pageNum"
            @current-change="onPage"
          />
        </div>
      </aside>
      <p class="gis-hud gis-hud-status">{{ $t('pages.gis.layerCoach') }}</p>
    </div>

    <ElDialog
      v-model="dialog"
      class="gis-layer-dialog"
      :title="$t('pages.gis.layerAdd')"
      width="640px"
      align-center
      destroy-on-close
    >
      <p class="gis-layer-hint">{{ $t('pages.gis.layerHint') }}</p>
      <ElForm label-position="top">
        <ElFormItem :label="$t('pages.gis.layerName')" required>
          <ElInput v-model="form.name" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.gis.layerKind')">
          <ElRadioGroup v-model="form.kind">
            <ElRadioButton value="vector">{{ $t('pages.gis.kindVector') }}</ElRadioButton>
            <ElRadioButton value="heatmap">{{ $t('pages.gis.heatmap') }}</ElRadioButton>
            <ElRadioButton value="xyz">{{ $t('pages.gis.kindXyz') }}</ElRadioButton>
            <ElRadioButton value="wms">{{ $t('pages.gis.kindWms') }}</ElRadioButton>
            <ElRadioButton value="3dtiles">{{ $t('pages.gis.kind3dtiles') }}</ElRadioButton>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem :label="$t('pages.gis.featRemark')">
          <ElInput v-model="form.remark" />
        </ElFormItem>
        <ElFormItem v-if="isRaster" :label="$t('pages.gis.rasterUrl')" required>
          <ElInput v-model="form.url" :placeholder="$t('pages.gis.rasterUrlHint')" />
        </ElFormItem>
        <template v-if="isTileset">
          <ElFormItem :label="$t('pages.gis.tilesetUrl')" required>
            <ElInput v-model="form.url" :placeholder="$t('pages.gis.tilesetUrlHint')" />
            <p v-if="hostedTilesets.length" class="gis-layer-hint">
              {{ $t('pages.gis.tilesetHosted') }}
              <ElButton
                v-for="code in hostedTilesets"
                :key="code"
                link
                type="primary"
                @click="form.url = `hosted:${code}`"
              >
                hosted:{{ code }}
              </ElButton>
            </p>
          </ElFormItem>
          <ElFormItem :label="$t('pages.gis.tilesetSse')">
            <ElInputNumber v-model="form.sse" :min="1" :max="64" :step="1" />
          </ElFormItem>
          <ElFormItem :label="$t('pages.gis.tilesetHeightOffset')">
            <ElInputNumber v-model="form.heightOffset" :min="-5000" :max="5000" :step="1" />
          </ElFormItem>
        </template>
        <ElFormItem v-if="form.kind === 'wms'" :label="$t('pages.gis.rasterLayers')" required>
          <ElInput v-model="form.layers" />
        </ElFormItem>
        <ElFormItem v-if="isPayload" :label="$t('pages.gis.layerPayload')">
          <ElInput
            v-model="form.payload"
            type="textarea"
            :rows="6"
            :placeholder="$t('pages.gis.layerPayloadHint')"
          />
        </ElFormItem>
        <input
          ref="fileRef"
          class="gis-file"
          type="file"
          accept=".json,.geojson,.wkt,.csv,.kml,.gpx,application/json,text/csv"
          @change="onFile"
        />
        <ElButton v-if="isPayload" @click="fileRef?.click()">{{
          $t('pages.gis.importJson')
        }}</ElButton>
        <span v-if="previewCount != null" class="gis-preview">{{
          $t('pages.gis.layerPreview', { n: previewCount })
        }}</span>
      </ElForm>
      <template #footer>
        <ElButton @click="dialog = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton v-if="isPayload" :loading="ingesting" @click="previewIngest">{{
          $t('pages.gis.layerIngest')
        }}</ElButton>
        <ElButton v-perm="'gis:layer:save'" type="primary" :loading="saving" @click="save">
          {{ $t('pages.gis.save') }}
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    computed,
    nextTick,
    onActivated,
    onBeforeUnmount,
    onDeactivated,
    onMounted,
    reactive,
    ref
  } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter, onBeforeRouteLeave } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { HttpError } from '@/utils/http/error'
  import {
    fetchGisLayerIngestText,
    fetchGisLayerPage,
    fetchGisStatus,
    fetchRemoveGisLayer,
    fetchSaveGisLayer,
    ingestAny,
    type GisLayerRow
  } from '@/api/gis'
  import { bootLabMap, type LabMapBag } from '@/gis/labBoot'
  import { rememberedOrFirst } from '@/gis/preferProvider'
  import { paintLayerOnMap } from '@/gis/paintLayer'

  defineOptions({ name: 'GisLayer' })

  const { t } = useI18n()
  const router = useRouter()
  const mapHost = ref<HTMLElement>()
  const loading = ref(false)
  const rows = ref<GisLayerRow[]>([])
  const total = ref(0)
  const pageNum = ref(1)
  const pageSize = 20
  const keyword = ref('')
  const searching = ref(false)
  const selectedId = ref('')
  const dialog = ref(false)
  const ingesting = ref(false)
  const saving = ref(false)
  const previewCount = ref<number | null>(null)
  const fileRef = ref<HTMLInputElement>()
  const form = reactive({
    name: '',
    kind: 'vector',
    remark: '',
    payload: '',
    url: '',
    layers: '',
    sse: 16,
    heightOffset: 0
  })
  const isRaster = computed(() => form.kind === 'xyz' || form.kind === 'wms')
  const isTileset = computed(() => form.kind === '3dtiles')
  /** 只有矢量/热力需要贴要素数据，栅格与三维切片填地址 */
  const isPayload = computed(() => !isRaster.value && !isTileset.value)
  const hostedTilesets = ref<string[]>([])
  let bag: LabMapBag | undefined

  const kindText = (kind?: string): string => {
    if (kind === 'heatmap') {
      return t('pages.gis.heatmap')
    }
    if (kind === 'xyz') {
      return t('pages.gis.kindXyz')
    }
    if (kind === 'wms') {
      return t('pages.gis.kindWms')
    }
    if (kind === '3dtiles') {
      return t('pages.gis.kind3dtiles')
    }
    return t('pages.gis.kindVector')
  }

  const preview = async (row: GisLayerRow): Promise<void> => {
    if (!bag || row.id == null) {
      return
    }
    selectedId.value = String(row.id)
    await paintLayerOnMap(bag.overlays, bag.provider, row, `ov-${row.id}`)
  }

  const load = async (): Promise<void> => {
    loading.value = true
    try {
      const name = keyword.value.trim()
      searching.value = Boolean(name)
      const page = await fetchGisLayerPage({
        pageNum: pageNum.value,
        pageSize,
        name: name || undefined
      })
      rows.value = page?.records ?? []
      total.value = Number(page?.totalRow ?? 0)
      const keep = rows.value.find((row) => String(row.id) === selectedId.value)
      if (keep) {
        await preview(keep)
      } else if (rows.value[0]) {
        await preview(rows.value[0])
      }
    } finally {
      loading.value = false
    }
  }

  const onPage = (p: number): void => {
    pageNum.value = p
    void load()
  }

  const openCreate = (): void => {
    form.name = ''
    form.kind = 'vector'
    form.remark = ''
    form.payload = ''
    form.url = ''
    form.layers = ''
    form.sse = 16
    form.heightOffset = 0
    previewCount.value = null
    dialog.value = true
  }

  const parsedPayload = (): unknown => {
    if (isTileset.value) {
      return {
        url: form.url.trim(),
        maximumScreenSpaceError: form.sse,
        heightOffset: form.heightOffset
      }
    }
    if (isRaster.value) {
      return { url: form.url.trim(), layers: form.layers.trim() }
    }
    const raw = form.payload.trim()
    if (!raw) {
      throw new Error('empty')
    }
    if (raw.startsWith('{') || raw.startsWith('[')) {
      return JSON.parse(raw)
    }
    return raw
  }

  const previewIngest = async (): Promise<void> => {
    ingesting.value = true
    try {
      const data = await ingestAny(parsedPayload())
      previewCount.value = data.count
      if (!data.count) {
        ElMessage.warning(t('pages.gis.layerBadPayload'))
        return
      }
      ElMessage.success(t('pages.gis.layerPreview', { n: data.count }))
    } catch (error) {
      previewCount.value = null
      ElMessage.warning(payloadError(error))
    } finally {
      ingesting.value = false
    }
  }

  const save = async (): Promise<void> => {
    if (!form.name.trim()) {
      ElMessage.warning(t('pages.gis.layerNameRequired'))
      return
    }
    saving.value = true
    try {
      // 原文（WKT / CSV / KML / GPX）先经原文通道解析成 GeoJSON 再提交：
      // 直接塞进 JSON body 的话，标签会被全局 XSS 净化剥掉，KML / GPX 存进去就是空图层
      const raw = parsedPayload()
      if (emptyFeatures(raw)) {
        ElMessage.warning(t('pages.gis.layerBadPayload'))
        return
      }
      const payload = typeof raw === 'string' ? await fetchGisLayerIngestText(raw) : raw
      await fetchSaveGisLayer({
        name: form.name.trim(),
        kind: form.kind,
        remark: form.remark,
        payload
      })
      // 后端修过几何（未闭合环、自相交）就逐条说明，不能让用户以为原样存进去了
      dialog.value = false
      await load()
    } catch (error) {
      if (!(error instanceof HttpError)) {
        ElMessage.warning(payloadError(error))
      }
    } finally {
      saving.value = false
    }
  }

  const emptyFeatures = (raw: unknown): boolean => {
    if (!raw || typeof raw !== 'object') {
      return false
    }
    const bag = raw as { type?: string; features?: unknown; geometry?: unknown }
    if (Array.isArray(bag.features)) {
      return bag.features.length === 0
    }
    return bag.type === 'Feature' && !bag.geometry
  }

  const payloadError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : ''
    if (!message || message === 'empty' || /JSON|Unexpected/i.test(message)) {
      return t('pages.gis.layerBadPayload')
    }
    return message
  }

  const onFile = async (ev: Event): Promise<void> => {
    const file = (ev.target as HTMLInputElement).files?.[0]
    ;(ev.target as HTMLInputElement).value = ''
    if (!file) {
      return
    }
    form.payload = await file.text()
    if (!form.name.trim()) {
      form.name = file.name.replace(/\.(geojson|json|wkt|csv|kml|gpx)$/i, '')
    }
  }

  const openOnMap = (row: GisLayerRow): void => {
    if (!row.id) {
      return
    }
    router.push({ path: '/gis/workspace', query: { layerId: String(row.id) } })
  }

  const remove = async (row: GisLayerRow): Promise<void> => {
    if (!row.id) {
      return
    }
    try {
      await ElMessageBox.confirm(t('pages.gis.layerRemoveConfirm', { name: row.name }), {
        type: 'warning'
      })
    } catch {
      return
    }
    await fetchRemoveGisLayer([row.id])
    await load()
  }

  onMounted(async () => {
    const status = await fetchGisStatus()
    hostedTilesets.value = status.tilesets ?? []
    const provider = rememberedOrFirst(status.providers)
    await nextTick()
    if (mapHost.value) {
      bag = await bootLabMap(mapHost.value, provider)
    }
    await load()
  })

  onActivated(() => {
    bag?.map.updateSize()
  })

  const closeOverlays = (): void => {
    dialog.value = false
    ElMessageBox.close()
  }

  onDeactivated(closeOverlays)

  onBeforeRouteLeave(() => {
    closeOverlays()
  })

  onBeforeUnmount(() => {
    closeOverlays()
    bag?.destroy()
    bag = undefined
  })
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-layer-hint,
  .gis-preview {
    margin: 0 0 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .gis-file {
    display: none;
  }

  .gis-hud-head :deep(.gis-hud-search) {
    width: 132px;
  }

  .gis-list-empty {
    margin: 12px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }
</style>
<style>
  .gis-layer-dialog.el-dialog,
  .gis-layer-dialog .el-dialog {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 32px);
    margin-top: 16px;
    margin-bottom: 16px;
  }

  .gis-layer-dialog .el-dialog__body,
  .gis-layer-dialog.el-dialog .el-dialog__body {
    overflow: auto;
  }
</style>
