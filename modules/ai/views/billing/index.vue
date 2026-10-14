<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElSelect v-model="days" style="width: 120px" @change="loadTrend">
          <ElOption :value="7" :label="$t('aiBilling.lastDays', { n: 7 })" /><ElOption
            :value="30"
            :label="$t('aiBilling.lastDays', { n: 30 })"
          />
        </ElSelect>
        <ElButton @click="reload">{{ $t('aiBilling.refresh') }}</ElButton>
        <ElButton @click="doExport">{{ $t('aiBilling.export') }}</ElButton>
      </div>
      <div class="chart-wrap">
        <div ref="chartRef" class="chart" :class="{ 'is-hidden': trendEmpty }" />
        <!-- 无数据时图表只剩坐标轴（暗色下尤其像坏了），改显示空状态（UX-117） -->
        <ArtEmptyState
          v-if="trendEmpty"
          class="chart-empty"
          size="compact"
          icon="ri:line-chart-line"
          :title="$t('aiBilling.emptyTitle', { n: days })"
          :description="$t('aiBilling.emptyDesc')"
        />
      </div>
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
  import { useI18n } from 'vue-i18n'
  import ArtEmptyState from '@/components/core/others/art-empty-state/index.vue'
  import type { ColumnOption } from '@/types/component'
  import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
  import * as echarts from 'echarts'
  import { fetchAiBillingPage, fetchAiBillingTrend, fetchExportAiBilling } from '../../api'
  defineOptions({ name: 'AiBilling' })
  const { t } = useI18n()
  const days = ref(30)
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const chartRef = ref<HTMLElement | null>(null)
  let chart: echarts.ECharts | null = null
  const trendEmpty = ref(false)
  const pager = computed(() => ({
    current: pageNum.value,
    size: pageSize.value,
    total: total.value
  }))
  const columns = computed<ColumnOption[]>(() => [
    { type: 'index', width: 60, label: '#' },
    { prop: 'callTime', label: t('aiBilling.colTime'), width: 170 },
    { prop: 'userId', label: t('aiBilling.colUser'), width: 160 },
    { prop: 'modelName', label: t('aiBilling.colModel'), minWidth: 140 },
    { prop: 'promptTokens', label: t('aiBilling.colInput'), width: 90 },
    { prop: 'completionTokens', label: t('aiBilling.colOutput'), width: 90 },
    { prop: 'amount', label: t('aiBilling.colAmount'), width: 100 },
    { prop: 'bizType', label: t('aiBilling.colSource'), width: 100 }
  ])
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
    trendEmpty.value = !list.some((x: any) => Number(x.tokens ?? 0) > 0)
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

  .chart-wrap {
    position: relative;
    height: 220px;
    margin-bottom: 12px;
  }

  .chart {
    height: 100%;
  }

  .chart.is-hidden {
    visibility: hidden;
  }

  .chart-empty {
    position: absolute;
    inset: 0;
  }
</style>
