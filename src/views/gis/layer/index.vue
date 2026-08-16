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
        <ul v-loading="loading" class="gis-list">
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

    <ElDialog v-model="dialog" :title="$t('pages.gis.layerAdd')" width="640px">
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
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem :label="$t('pages.gis.featRemark')">
          <ElInput v-model="form.remark" />
        </ElFormItem>
        <ElFormItem v-if="isRaster" :label="$t('pages.gis.rasterUrl')" required>
          <ElInput v-model="form.url" :placeholder="$t('pages.gis.rasterUrlHint')" />
        </ElFormItem>
        <ElFormItem v-if="form.kind === 'wms'" :label="$t('pages.gis.rasterLayers')" required>
          <ElInput v-model="form.layers" />
        </ElFormItem>
        <ElFormItem v-if="!isRaster" :label="$t('pages.gis.layerPayload')">
          <ElInput
            v-model="form.payload"
            type="textarea"
            :rows="10"
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
        <ElButton v-if="!isRaster" @click="fileRef?.click()">{{
          $t('pages.gis.importJson')
        }}</ElButton>
        <span v-if="previewCount != null" class="gis-preview">{{
          $t('pages.gis.layerPreview', { n: previewCount })
        }}</span>
      </ElForm>
      <template #footer>
        <ElButton @click="dialog = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton v-if="!isRaster" :loading="ingesting" @click="previewIngest">{{
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
  import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchGisLayerIngest,
    fetchGisLayerPage,
    fetchGisStatus,
    fetchRemoveGisLayer,
    fetchSaveGisLayer,
    type GisLayerRow
  } from '@/api/gis'
  import { bootLabMap, type LabMapBag } from '@/gis/labBoot'
  import { paintLayerOnMap } from '@/gis/paintLayer'
  import type { GisProviderCode } from '@/gis/types'

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
  const selectedId = ref('')
  const dialog = ref(false)
  const ingesting = ref(false)
  const saving = ref(false)
  const previewCount = ref<number | null>(null)
  const fileRef = ref<HTMLInputElement>()
  const form = reactive({ name: '', kind: 'vector', remark: '', payload: '', url: '', layers: '' })
  const isRaster = computed(() => form.kind === 'xyz' || form.kind === 'wms')
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
      const page = await fetchGisLayerPage({
        pageNum: pageNum.value,
        pageSize,
        name: keyword.value.trim() || undefined
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
    previewCount.value = null
    dialog.value = true
  }

  const parsedPayload = (): unknown => {
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
      const data = await fetchGisLayerIngest(parsedPayload())
      previewCount.value = data.count
      ElMessage.success(t('pages.gis.layerPreview', { n: data.count }))
    } catch {
      previewCount.value = null
    } finally {
      ingesting.value = false
    }
  }

  const save = async (): Promise<void> => {
    if (!form.name.trim()) {
      ElMessage.warning(t('pages.gis.layerName'))
      return
    }
    saving.value = true
    try {
      await fetchSaveGisLayer({
        name: form.name.trim(),
        kind: form.kind,
        remark: form.remark,
        payload: parsedPayload()
      })
      ElMessage.success(t('pages.gis.saveSuccess'))
      dialog.value = false
      await load()
    } finally {
      saving.value = false
    }
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
    await ElMessageBox.confirm(
      t('hooks.crud.deleteConfirmMessage', { label: t('pages.gis.layerName'), name: row.name }),
      {
        type: 'warning'
      }
    )
    await fetchRemoveGisLayer([row.id])
    ElMessage.success(t('pages.gis.removeSuccess'))
    await load()
  }

  onMounted(async () => {
    const status = await fetchGisStatus()
    const first = status.providers.find((p) => p.enabled && p.configured)
    const provider = (first?.provider || 'tianditu') as GisProviderCode
    await nextTick()
    if (mapHost.value) {
      bag = await bootLabMap(mapHost.value, provider)
    }
    await load()
  })

  onActivated(() => {
    bag?.map.updateSize()
  })

  onBeforeUnmount(() => {
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
</style>
