<template>
  <aside class="gis-hud gis-hud-panel gis-lab-nav" aria-label="示例目录">
    <section v-for="group in groups" :key="group.id" class="gis-lab-group">
      <h3>{{ $t(`pages.gis.labGroup${cap(group.id)}`) }}</h3>
      <button
        v-for="item in group.items"
        :key="item.code"
        type="button"
        class="gis-lab-item"
        :class="{ 'is-on': item.code === active }"
        @click="open(item.code)"
      >
        {{ item.title }}
      </button>
    </section>
  </aside>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import type { GisDemoMeta } from '@/api/gis'

  const props = defineProps<{ items: GisDemoMeta[]; active: string }>()
  const router = useRouter()

  const cap = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1)

  const groups = computed(() => {
    const order = ['cover', 'motion', 'query']
    return order
      .map((id) => ({
        id,
        items: props.items.filter((row) => (row.group || 'cover') === id)
      }))
      .filter((g) => g.items.length)
  })

  const open = (code: string): void => {
    if (!code || code === props.active || code.startsWith('/')) {
      return
    }
    if (!props.items.some((row) => row.code === code)) {
      return
    }
    void router.replace({ path: '/gis/lab', query: { code } })
  }
</script>

<style src="../gis-shell.css"></style>
<style scoped>
  .gis-lab-nav {
    gap: 4px;
  }

  .gis-lab-group + .gis-lab-group {
    margin-top: 10px;
  }

  .gis-lab-group h3 {
    padding: 0 6px;
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  .gis-lab-item {
    display: block;
    width: 100%;
    height: 36px;
    padding: 0 8px;
    overflow: hidden;
    font-size: 13px;
    color: var(--el-text-color-regular);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 8px;
  }

  .gis-lab-item:hover,
  .gis-lab-item.is-on {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
</style>
