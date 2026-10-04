<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElSelect v-model="days" style="width: 120px" @change="loadTrend">
          <ElOption :value="7" label="近 7 天" /><ElOption :value="30" label="近 30 天" />
        </ElSelect>
        <ElButton @click="reload">刷新</ElButton>
        <ElButton @click="doExport">导出</ElButton>
      </div>
      <div ref="chartRef" class="chart" />
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        @pagination:size-change="
          (s: number) => {
            pageSize = s
            reload()
          }
        "
        @pagination:current-change="
          (p: number) => {
            pageNum = p
            reload()
          }
        "
      />
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
  import * as echarts from 'echarts'
  import { fetchAiBillingPage, fetchAiBillingTrend, fetchExportAiBilling } from '../../api'
  defineOptions({ name: 'AiBilling' })
  const days = ref(30)
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const chartRef = ref<HTMLElement | null>(null)
  let chart: echarts.ECharts | null = null
  const pager = computed(() => ({
    current: pageNum.value,
    size: pageSize.value,
    total: total.value
  }))
  const columns: ColumnOption[] = [
    { type: 'index', width: 60, label: '#' },
    { prop: 'callTime', label: '时间', width: 170 },
    { prop: 'userId', label: '用户', width: 160 },
    { prop: 'modelName', label: '模型', minWidth: 140 },
    { prop: 'promptTokens', label: '输入', width: 90 },
    { prop: 'completionTokens', label: '输出', width: 90 },
    { prop: 'amount', label: '费用', width: 100 },
    { prop: 'bizType', label: '来源', width: 100 }
  ]
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiBillingPage({ pageNum: pageNum.value, pageSize: pageSize.value })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  async function loadTrend() {
    const list = (await fetchAiBillingTrend({ days: days.value })) || []
    await nextTick()
    if (!chartRef.value) return
    if (!chart) chart = echarts.init(chartRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: list.map((x: any) => x.date || x.day) },
      yAxis: { type: 'value', name: 'Tokens' },
      series: [{ type: 'line', data: list.map((x: any) => x.tokens ?? 0), smooth: true }]
    })
  }
  async function doExport() {
    await fetchExportAiBilling({})
  }
  onMounted(async () => {
    await reload()
    await loadTrend()
  })
  onUnmounted(() => {
    chart?.dispose()
  })
</script>
<style scoped>
  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .chart {
    height: 220px;
    margin-bottom: 12px;
  }
</style>
