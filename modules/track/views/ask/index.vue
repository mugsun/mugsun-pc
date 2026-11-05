<!-- 问数据：中文提问 → 埋点分析指标/图/表 → 相关回放跳 /track/replay
     读权限 sys:track-ask:list；与 AI dataset 问数 / 通用 Chat 无关 -->
<template>
  <div class="track-ask-page art-full-height">
    <ElAlert
      v-if="!canAsk"
      type="warning"
      :closable="false"
      :title="$t('pages.track.ask.noPerm')"
      class="track-ask-alert"
    />

    <template v-else>
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
      </div>

      <ElAlert
        v-if="usingMock"
        type="info"
        :closable="false"
        :title="$t('pages.track.ask.mockHint')"
        class="track-ask-alert"
      />

      <div class="art-card track-ask-input">
        <ElInput
          v-model="question"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          :placeholder="$t('pages.track.ask.placeholder')"
          @keydown.enter.exact.prevent="submit"
        />
        <div class="track-ask-input-ops">
          <ElButton type="primary" :loading="loading" @click="submit">{{
            $t('pages.track.ask.ask')
          }}</ElButton>
        </div>
      </div>

      <div v-loading="loading" class="track-ask-body">
        <ElEmpty
          v-if="!result && !errorText"
          :description="$t('pages.track.ask.emptyIdle')"
          :image-size="72"
        />

        <ElAlert
          v-if="errorText"
          type="error"
          :closable="false"
          :title="errorText"
          class="track-ask-alert"
        />

        <template v-if="result">
          <div class="art-card track-ask-result">
            <p class="track-card-title">{{ $t('pages.track.ask.result') }}</p>
            <p class="track-ask-summary">{{ result.summary }}</p>
            <p class="track-ask-meta">
              {{ $t('pages.track.ask.intent') }}：{{ result.intent }} · {{ result.resultType }}
            </p>

            <ElAlert
              v-if="showUnsupported"
              type="info"
              :closable="false"
              :title="$t('pages.track.ask.unsupportedHint')"
              class="track-ask-alert"
            />

            <ElAlert
              v-for="(w, i) in result.warnings || []"
              :key="i"
              type="warning"
              :closable="false"
              :title="w"
              class="track-ask-alert"
            />

            <ElRow
              v-if="showMetrics && metricEntries.length"
              :gutter="12"
              class="track-ask-metrics"
            >
              <ElCol v-for="m in metricEntries" :key="m.key" :xs="12" :sm="8" :md="6">
                <div class="track-stat-card art-card">
                  <div class="track-stat-count">{{ m.value }}</div>
                  <div class="track-stat-label">{{ m.key }}</div>
                </div>
              </ElCol>
            </ElRow>

            <div v-if="showSeries" class="track-ask-chart">
              <p class="track-card-title">{{ $t('pages.track.ask.series') }}</p>
              <ArtLineChart
                :data="chartSeries"
                :x-axis-data="chartLabels"
                height="280px"
                show-legend
              />
            </div>

            <div v-if="showTable" class="track-ask-table">
              <p class="track-card-title">{{ $t('pages.track.ask.table') }}</p>
              <ElTable :data="tableRows" size="default" max-height="360">
                <ElTableColumn
                  v-for="col in tableCols"
                  :key="col"
                  :prop="col"
                  :label="col"
                  min-width="120"
                  show-overflow-tooltip
                />
                <template #empty>
                  <ElEmpty :description="$t('pages.track.shared.noData')" :image-size="60" />
                </template>
              </ElTable>
            </div>

            <div v-if="rawPreview" class="track-ask-raw">
              <p class="track-card-title">{{ $t('pages.track.ask.raw') }}</p>
              <ElTable
                v-if="rawPreview.kind === 'table'"
                :data="rawPreview.rows"
                size="default"
                max-height="360"
              >
                <ElTableColumn
                  v-for="col in rawPreview.cols"
                  :key="col"
                  :prop="col"
                  :label="col"
                  min-width="120"
                  show-overflow-tooltip
                />
              </ElTable>
              <pre v-else class="track-ask-raw-json">{{ rawPreview.text }}</pre>
            </div>
          </div>

          <div class="art-card track-ask-replays">
            <p class="track-card-title">{{ $t('pages.track.ask.replays') }}</p>
            <ElAlert
              v-if="result.replayDenied"
              type="warning"
              :closable="false"
              :title="$t('pages.track.ask.replayDenied')"
              class="track-ask-alert"
            />
            <ElEmpty
              v-else-if="result.replayEmpty || !result.replays?.length"
              :description="$t('pages.track.ask.replayEmpty')"
              :image-size="60"
            />
            <ElTable v-else :data="result.replays" size="default">
              <ElTableColumn
                prop="sessionId"
                :label="$t('pages.track.shared.session')"
                min-width="160"
                show-overflow-tooltip
              />
              <ElTableColumn
                prop="entryPath"
                :label="$t('pages.track.ask.entryPath')"
                min-width="140"
                show-overflow-tooltip
              />
              <ElTableColumn :label="$t('pages.track.ask.startTime')" width="160">
                <template #default="{ row }">{{ fmtTrackTime(row.startTime) }}</template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.track.shared.duration')" width="100" align="right">
                <template #default="{ row }">{{ fmtTrackDuration(row.durationMs) }}</template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.track.ask.hasError')" width="90">
                <template #default="{ row }">
                  <ElTag v-if="row.hasError === 1" type="danger" size="small" effect="plain">{{
                    $t('pages.track.shared.hasError')
                  }}</ElTag>
                  <span v-else>-</span>
                </template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.track.shared.operation')" width="110" fixed="right">
                <template #default="{ row }">
                  <ElButton link type="primary" @click="goReplay(row)">{{
                    $t('pages.track.ask.openReplay')
                  }}</ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { fetchTrackAsk } from '@/api/track'
  import { hasPerm } from '@/utils/permission'
  import { fmtTrackDuration, fmtTrackTime, useTrackApp } from '@/views/track/shared/useTrackApp'
  import {
    adaptAskChart,
    isAskMetricsType,
    isAskUnsupportedType,
    isTrackAskMockEnabled,
    previewAskRaw,
    type TrackAskResult
  } from '../../ask-shape'
  import type { LineDataItem } from '@/types/component/chart'

  defineOptions({ name: 'TrackAsk' })

  const { t } = useI18n()
  const router = useRouter()
  const { appOptions, appKey, days, appsLoading } = useTrackApp()

  /** 读：sys:track-ask:list（boot V19 种子已合） */
  const canAsk = computed(() => hasPerm('sys:track-ask:list'))

  /**
   * 默认打真 API；仅 DEV 且 VITE_TRACK_ASK_MOCK=true 才动态加载本地同形 mock。
   * 生产构建 DEV 恒 false，动态 import 分支被消除，mock 不进产物（对齐 captcha）。
   */
  const usingMock = isTrackAskMockEnabled()

  const question = ref('')
  const loading = ref(false)
  const result = ref<TrackAskResult | null>(null)
  const errorText = ref('')

  const metricEntries = computed(() => {
    const m = result.value?.metrics
    if (!m || typeof m !== 'object') return []
    return Object.keys(m).map((key) => ({ key, value: m[key] }))
  })

  const tableRows = computed(() => result.value?.table || [])
  const tableCols = computed(() => {
    const row = tableRows.value[0]
    return row ? Object.keys(row) : []
  })

  const chartAdapted = computed(() => adaptAskChart(result.value?.series))
  const chartLabels = computed(() => chartAdapted.value.labels)
  const chartSeries = computed<LineDataItem[]>(() => chartAdapted.value.items)

  const showUnsupported = computed(() =>
    isAskUnsupportedType(result.value?.resultType, result.value?.intent)
  )
  const showMetrics = computed(() => isAskMetricsType(result.value?.resultType))
  const showSeries = computed(() => {
    const rt = result.value?.resultType
    return (rt === 'series' || chartLabels.value.length > 0) && chartLabels.value.length > 0
  })
  const showTable = computed(
    () => result.value?.resultType === 'table' && tableRows.value.length > 0
  )
  const rawPreview = computed(() => {
    const r = result.value
    if (!r || r.resultType !== 'raw') return null
    return previewAskRaw(r.raw)
  })

  const submit = async (): Promise<void> => {
    if (!canAsk.value) return
    if (!appKey.value) {
      ElMessage.warning(t('pages.track.ask.needApp'))
      return
    }
    const q = question.value.trim()
    if (!q) {
      ElMessage.warning(t('pages.track.ask.needQuestion'))
      return
    }
    if (q.length > 500) {
      ElMessage.warning(t('pages.track.ask.questionTooLong'))
      return
    }
    loading.value = true
    errorText.value = ''
    result.value = null
    try {
      if (usingMock) {
        const { buildTrackAskMock } = await import('../../ask-mock')
        result.value = buildTrackAskMock({
          appKey: appKey.value,
          question: q,
          days: Number(days.value) || 7
        })
        return
      }
      const data = await fetchTrackAsk({
        appKey: appKey.value,
        question: q,
        days: Number(days.value) || 7
      })
      result.value = (data?.data ?? data) as TrackAskResult
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.msg ||
        (err?.code === 403 || err?.status === 403
          ? t('pages.track.ask.noPerm')
          : t('pages.track.ask.askFailed'))
      errorText.value = String(msg)
    } finally {
      loading.value = false
    }
  }

  /** 跳既有回放页，带 sessionId + appKey（回放页读 query 开抽屉） */
  const goReplay = (row: { sessionId?: string; appKey?: string }): void => {
    const sessionId = String(row.sessionId || '')
    if (!sessionId) return
    const key = String(row.appKey || appKey.value || '')
    void router.push({
      path: '/track/replay',
      query: { sessionId, ...(key ? { appKey: key } : {}) }
    })
  }
</script>

<style lang="scss" scoped>
  .track-ask-page {
    overflow-y: auto;

    .track-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;

      .track-app-select {
        width: 220px;
      }
    }

    .track-ask-alert {
      margin-bottom: 12px;
    }

    .track-ask-input {
      padding: 16px;
      margin-bottom: 16px;

      .track-ask-input-ops {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }
    }

    .track-ask-body {
      min-height: 200px;
    }

    .track-ask-result,
    .track-ask-replays {
      padding: 16px;
      margin-bottom: 16px;
    }

    .track-card-title {
      margin-bottom: 8px;
      font-size: 16px;
      font-weight: 500;
    }

    .track-ask-summary {
      margin: 0 0 8px;
      font-size: 15px;
      line-height: 1.6;
    }

    .track-ask-meta {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .track-ask-metrics {
      margin-top: 8px;
    }

    .track-stat-card {
      padding: 14px;
      margin-bottom: 12px;
    }

    .track-stat-count {
      font-size: 22px;
      font-weight: 600;
    }

    .track-stat-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .track-ask-chart,
    .track-ask-table,
    .track-ask-raw {
      margin-top: 12px;
    }

    .track-ask-raw-json {
      max-height: 360px;
      padding: 12px;
      margin: 0;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      word-break: break-all;
      white-space: pre-wrap;
      background: var(--el-fill-color-light);
      border-radius: 6px;
    }
  }
</style>
