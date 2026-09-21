<!-- 示例中心：全幅地图，能力树以 HUD 浮在左侧。 -->
<template>
  <div class="gis-shell art-full-height">
    <div class="gis-map-shell">
      <PlayerPane v-if="code" :code="code" :catalog="catalog" />
      <LabNav :items="catalog" :active="code" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchGisDemoList, type GisDemoMeta } from '@/api/gis'
  import LabNav from './LabNav.vue'
  import PlayerPane from './PlayerPane.vue'

  defineOptions({ name: 'GisLab' })

  const FALLBACK = 'poi'
  const route = useRoute()
  const router = useRouter()
  const catalog = ref<GisDemoMeta[]>([])
  const code = computed(() => String(route.query.code || '').trim())

  /** 必须限定在示例页本身。watch(query.code) 会跟着全局路由变：离开本页后 code 变空，会把地图/图层/底图拽回来。 */
  const onLabPage = (): boolean => {
    const path = route.path.replace(/\/+$/, '')
    return path === '/gis/lab' || route.name === 'GisLab'
  }

  const ensureCode = (): void => {
    if (!onLabPage() || code.value) {
      return
    }
    const first = catalog.value[0]?.code || FALLBACK
    void router.replace({ path: '/gis/lab', query: { code: first } })
  }

  watch(
    () => `${String(route.name || '')}:${route.path}:${code.value}`,
    () => ensureCode(),
    { immediate: true }
  )

  onMounted(async () => {
    catalog.value = (await fetchGisDemoList()) ?? []
    ensureCode()
  })
</script>

<style src="../gis-shell.css"></style>
