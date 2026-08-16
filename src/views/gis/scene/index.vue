<!-- 场景列表：全幅地图预览 + 左侧 HUD 目录。 -->
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
            :placeholder="$t('pages.gis.sceneNamePlaceholder')"
            class="gis-hud-search"
            @keyup.enter="load"
          />
          <ElButton size="small" @click="load">{{ $t('table.searchBar.search') }}</ElButton>
          <ElButton v-perm="'gis:scene:save'" size="small" type="primary" @click="goNew">
            {{ $t('pages.gis.newScene') }}
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
            <span class="gis-list-name" :title="row.name">{{ row.name }}</span>
            <span class="gis-list-meta">{{ overlayHint(row) }}</span>
            <ElButton link type="primary" @click.stop="open(row)">{{
              $t('pages.gis.openScene')
            }}</ElButton>
            <ElButton v-perm="'gis:scene:remove'" link type="danger" @click.stop="remove(row)">
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
      <p class="gis-hud gis-hud-status">{{ $t('pages.gis.sceneCoach') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { fetchGisScenePage, fetchGisStatus, fetchRemoveGisScene, type GisScene } from '@/api/gis'
  import { bootLabMap, type LabMapBag } from '@/gis/labBoot'
  import { paintSceneOnMap } from '@/gis/paintLayer'
  import { parseSceneJson, type GisProviderCode } from '@/gis/types'

  defineOptions({ name: 'GisScene' })

  const { t } = useI18n()
  const router = useRouter()
  const mapHost = ref<HTMLElement>()
  const loading = ref(false)
  const rows = ref<GisScene[]>([])
  const total = ref(0)
  const pageNum = ref(1)
  const pageSize = 20
  const keyword = ref('')
  const selectedId = ref('')
  let bag: LabMapBag | undefined

  const overlayHint = (row: GisScene): string => {
    const spec = parseSceneJson(row.sceneJson)
    const sketch = spec.layers[0]?.features.length ?? 0
    const overlays = spec.overlayLayers?.length ?? 0
    return t('pages.gis.sceneStat', { sketch, overlays })
  }

  const preview = async (row: GisScene): Promise<void> => {
    if (!bag || row.id == null) {
      return
    }
    selectedId.value = String(row.id)
    await paintSceneOnMap(bag.map, bag.overlays, row, bag.provider)
  }

  const load = async (): Promise<void> => {
    loading.value = true
    try {
      const page = await fetchGisScenePage({
        pageNum: pageNum.value,
        pageSize,
        name: keyword.value.trim() || undefined
      })
      rows.value = page?.records ?? []
      total.value = Number(page?.totalRow ?? page?.total ?? 0)
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

  const open = (row: GisScene): void => {
    if (!row.id) {
      return
    }
    router.push({ path: '/gis/workspace', query: { sceneId: String(row.id) } })
  }

  const goNew = (): void => {
    router.push('/gis/workspace')
  }

  const remove = async (row: GisScene): Promise<void> => {
    if (!row.id) {
      return
    }
    await ElMessageBox.confirm(t('pages.gis.deleteSceneConfirm'), t('pages.gis.deleteScene'), {
      type: 'warning'
    })
    await fetchRemoveGisScene([row.id])
    ElMessage.success(t('pages.gis.deletedScene'))
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
  .gis-list-row {
    flex-wrap: wrap;
  }

  .gis-hud-head :deep(.gis-hud-search) {
    width: 120px;
  }
</style>
