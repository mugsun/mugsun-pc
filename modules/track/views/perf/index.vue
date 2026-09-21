<!-- 性能监控：Web Vitals 指标卡（P75 三色阈值）+ 分位明细表 + 路由筛选 -->
<template>
  <div class="track-perf-page art-full-height">
    <!-- 工具栏：应用选择（5 页共享选中态）+ 统计天数 + 路由筛选 -->
    <div class="track-toolbar">
      <ElSelect
        v-model="appKey"
        :loading="appsLoading"
        :placeholder="$t('pages.track.shared.appPlaceholder')"
        class="track-app-select"
      >
        <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
      </ElSelect>
      <ElRadioGroup v-model="days">
        <ElRadioButton :value="1">{{ $t('pages.track.shared.today') }}</ElRadioButton>
        <ElRadioButton :value="7">{{ $t('pages.track.shared.last7Days') }}</ElRadioButton>
        <ElRadioButton :value="30">{{ $t('pages.track.shared.last30Days') }}</ElRadioButton>
      </ElRadioGroup>
      <ElInput
        v-model="routePath"
        :placeholder="$t('pages.track.perf.routeFilterPlaceholder')"
        clearable
        class="track-route-input"
        @keyup.enter="loadVitals"
        @clear="loadVitals"
      />
      <ElButton :loading="loading" @click="loadVitals" v-ripple>{{
        $t('pages.track.shared.search')
      }}</ElButton>
    </div>

    <!-- 指标卡：P75 为主显示，good/needs-improvement/poor 三色 -->
    <ElRow :gutter="16" v-loading="loading">
      <ElCol v-for="m in metricCards" :key="m.key" :xs="12" :sm="8" :lg="4">
        <div class="art-card track-metric-card">
          <div class="track-metric-head">
            <span class="track-metric-label">{{ m.label }}</span>
            <ElTag :type="m.tagType" size="small" effect="light">{{ m.levelText }}</ElTag>
          </div>
          <div class="track-metric-value" :class="`is-${m.level}`">{{ m.p75Text }}</div>
          <div class="track-metric-sub"
            >{{ m.name }} · P75 · {{ $t('pages.track.perf.sampleN', { count: m.count }) }}</div
          >
        </div>
      </ElCol>
      <ElCol :xs="12" :sm="8" :lg="4">
        <div class="art-card track-metric-card track-metric-legend">
          <div class="track-metric-sub">{{ $t('pages.track.perf.thresholdLegend') }}</div>
          <div class="track-legend-line">LCP 2500/4000ms</div>
          <div class="track-legend-line">INP 200/500ms</div>
          <div class="track-legend-line">CLS 0.1/0.25</div>
          <div class="track-legend-line">FCP 1800/3000ms</div>
          <div class="track-legend-line">TTFB 800/1800ms</div>
        </div>
      </ElCol>
    </ElRow>

    <!-- 分位明细 -->
    <ElCard class="art-table-card track-detail-card">
      <div class="track-detail-head">
        <span class="track-card-title">{{ $t('pages.track.perf.quantileDetail') }}</span>
      </div>
      <ElTable :data="detailRows" v-loading="loading">
        <ElTableColumn :label="$t('pages.track.perf.metric')" width="200">
          <template #default="{ row }">
            <span class="track-detail-metric">{{ row.label }}</span>
            <span class="track-detail-name">{{ row.name }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="count"
          :label="$t('pages.track.perf.sampleCount')"
          width="110"
          align="right"
          header-align="right"
        />
        <ElTableColumn
          :label="$t('pages.track.perf.avg')"
          min-width="120"
          align="right"
          header-align="right"
        >
          <template #default="{ row }">{{ row.avgText }}</template>
        </ElTableColumn>
        <ElTableColumn label="P50" min-width="120" align="right" header-align="right">
          <template #default="{ row }">{{ row.p50Text }}</template>
        </ElTableColumn>
        <ElTableColumn label="P75" min-width="120" align="right" header-align="right">
          <template #default="{ row }">
            <span :class="`is-${row.level}`">{{ row.p75Text }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="P95" min-width="120" align="right" header-align="right">
          <template #default="{ row }">
            <span :class="`is-${row.p95Level}`">{{ row.p95Text }}</span>
          </template>
        </ElTableColumn>
        <template #empty
          ><ElEmpty :description="$t('pages.track.shared.noData')" :image-size="60"
        /></template>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { fetchTrackVitals } from '@/api/track'
  import { useI18n } from 'vue-i18n'
  import { useTrackApp } from '@/views/track/shared/useTrackApp'
  import {
    ElButton,
    ElInput,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElSelect,
    ElTag
  } from 'element-plus'

  defineOptions({ name: 'TrackPerf' })

  const { t } = useI18n()

  const { appOptions, appKey, days, appsLoading } = useTrackApp()
  const routePath = ref('')

  // CLS 直方图为千分制（/1000 还原原值），其余为毫秒；阈值为 good / poor 两档
  const METRICS = [
    {
      key: 'lcp',
      label: 'LCP',
      name: t('pages.track.perf.metricLcpName'),
      good: 2500,
      poor: 4000,
      cls: false
    },
    {
      key: 'inp',
      label: 'INP',
      name: t('pages.track.perf.metricInpName'),
      good: 200,
      poor: 500,
      cls: false
    },
    {
      key: 'cls',
      label: 'CLS',
      name: t('pages.track.perf.metricClsName'),
      good: 0.1,
      poor: 0.25,
      cls: true
    },
    {
      key: 'fcp',
      label: 'FCP',
      name: t('pages.track.perf.metricFcpName'),
      good: 1800,
      poor: 3000,
      cls: false
    },
    {
      key: 'ttfb',
      label: 'TTFB',
      name: t('pages.track.perf.metricTtfbName'),
      good: 800,
      poor: 1800,
      cls: false
    }
  ] as const

  type MetricMeta = (typeof METRICS)[number]
  type Level = 'good' | 'ni' | 'poor'

  const rawVitals = ref<any[]>([])
  const loading = ref(false)

  /** 原始值（CLS /1000 还原，其余取毫秒原值） */
  const rawValue = (meta: MetricMeta, v: any): number => {
    const n = Number(v ?? 0)
    return meta.cls ? n / 1000 : n
  }

  const levelOf = (meta: MetricMeta, v: number): Level =>
    v <= meta.good ? 'good' : v <= meta.poor ? 'ni' : 'poor'

  const fmtValue = (meta: MetricMeta, v: number): string =>
    meta.cls ? v.toFixed(3) : `${Math.round(v)}ms`

  const LEVEL_TEXT: Record<Level, string> = {
    good: t('pages.track.perf.levelGood'),
    ni: t('pages.track.perf.levelNi'),
    poor: t('pages.track.perf.levelPoor')
  }
  const LEVEL_TAG: Record<Level, 'success' | 'warning' | 'danger'> = {
    good: 'success',
    ni: 'warning',
    poor: 'danger'
  }

  const detailRows = computed(() =>
    METRICS.map((meta) => {
      const row = rawVitals.value.find((r) => r.metric === meta.key)
      // 该指标无样本：全部显示占位，不误导为「0ms 良好」
      if (!row) {
        return {
          key: meta.key,
          label: meta.label,
          name: meta.name,
          count: 0,
          avgText: '-',
          p50Text: '-',
          p75Text: '-',
          p95Text: '-',
          level: 'good' as Level
        }
      }
      const p75 = rawValue(meta, row.p75)
      const level = levelOf(meta, p75)
      return {
        key: meta.key,
        label: meta.label,
        name: meta.name,
        count: Number(row.count ?? 0),
        avgText: fmtValue(meta, rawValue(meta, row.avg)),
        p50Text: fmtValue(meta, rawValue(meta, row.p50)),
        p75Text: fmtValue(meta, p75),
        p95Text: fmtValue(meta, rawValue(meta, row.p95)),
        level,
        p95Level: levelOf(meta, rawValue(meta, row.p95))
      }
    })
  )

  const metricCards = computed(() =>
    detailRows.value.map((r) => ({
      key: r.key,
      label: r.label,
      name: r.name,
      count: r.count,
      p75Text: r.p75Text,
      level: r.level,
      levelText: LEVEL_TEXT[r.level],
      tagType: LEVEL_TAG[r.level]
    }))
  )

  const loadVitals = async (): Promise<void> => {
    if (!appKey.value) return
    loading.value = true
    try {
      const params: Record<string, any> = { appKey: appKey.value, days: days.value }
      if (routePath.value) params.routePath = routePath.value
      rawVitals.value = (await fetchTrackVitals(params)) ?? []
    } finally {
      loading.value = false
    }
  }

  watch([appKey, days], loadVitals, { immediate: true })
</script>

<style lang="scss" scoped>
  .track-perf-page {
    // 指标卡行 + 分位明细卡为自然高度内容：视口偏矮时明细卡被全局
    // .art-table-card .el-card__body 的 overflow:hidden 横切，页面须自备纵向滚动
    overflow-y: auto;

    .el-row {
      flex-shrink: 0;
    }

    .track-toolbar {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;

      .track-app-select {
        width: 220px;
      }

      .track-route-input {
        width: 240px;
      }
    }

    .track-card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .track-metric-card {
      padding: 16px;

      .track-metric-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .track-metric-label {
        font-size: 14px;
        font-weight: 600;
      }

      .track-metric-value {
        margin-top: 10px;
        font-size: 28px;
        font-weight: 600;

        &.is-good {
          color: var(--el-color-success);
        }

        &.is-ni {
          color: var(--el-color-warning);
        }

        &.is-poor {
          color: var(--el-color-danger);
        }
      }

      .track-metric-sub {
        margin-top: 6px;
        overflow: hidden;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .track-metric-legend {
      .track-legend-line {
        margin-top: 4px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    // 明细卡改自然高度（覆盖全局 .art-table-card 的 flex:1，否则卡片仍被压扁裁切）
    .track-detail-card {
      flex: none;
      margin-top: 16px;

      .track-detail-head {
        margin-bottom: 12px;
      }

      .track-detail-metric {
        margin-right: 8px;
        font-weight: 600;
      }

      .track-detail-name {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      .is-good {
        color: var(--el-color-success);
      }

      .is-ni {
        color: var(--el-color-warning);
      }

      .is-poor {
        color: var(--el-color-danger);
      }
    }
  }
</style>
