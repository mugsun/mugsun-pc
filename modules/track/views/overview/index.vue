<!-- 埋点概览：指标卡 + 趋势 + 页面排行（访问最多 / 入口页 / 退出页）+ 来源/设备/浏览器分布 + 当前在线（5s 轮询） -->
<template>
  <div class="track-overview-page art-full-height">
    <!-- 工具栏：应用选择（5 页共享选中态）+ 统计天数 + 刷新 -->
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
      <ElButton :loading="loading" @click="refreshOverview" v-ripple>{{
        $t('pages.track.shared.refresh')
      }}</ElButton>
    </div>

    <!-- 指标卡 -->
    <ElRow :gutter="16" v-loading="loading">
      <ElCol v-for="c in statCards" :key="c.key" :xs="12" :sm="8" :lg="4">
        <div class="art-card track-stat-card">
          <div class="track-stat-icon" :style="{ background: c.bg, color: c.color }">
            <ArtSvgIcon :icon="c.icon" />
          </div>
          <div class="track-stat-body">
            <div class="track-stat-count">{{ c.value }}</div>
            <div class="track-stat-label">{{ c.label }}</div>
          </div>
        </div>
      </ElCol>
    </ElRow>

    <!-- 趋势 + 当前在线 -->
    <ElRow :gutter="16" class="track-row">
      <ElCol :xs="24" :lg="18">
        <div class="art-card track-chart-card">
          <p class="track-card-title">{{ $t('pages.track.overview.visitTrend') }}</p>
          <ArtLineChart
            :data="trendSeries"
            :x-axis-data="trendLabels"
            :loading="loading"
            height="300px"
            show-legend
            :colors="trendColors"
            :symbol="trendLabels.length <= 1 ? 'circle' : 'none'"
          />
        </div>
      </ElCol>
      <ElCol :xs="24" :lg="6">
        <div class="art-card track-online-card" v-loading="onlineLoading && !onlineLoaded">
          <p class="track-card-title">{{ $t('pages.track.overview.onlineNow') }}</p>
          <div class="track-online-body">
            <span class="track-online-dot"></span>
            <span class="track-online-count">{{ online }}</span>
          </div>
          <p class="track-online-sub">{{
            $t('pages.track.overview.onlineSub', { min: Math.round(windowSeconds / 60) })
          }}</p>
        </div>
      </ElCol>
    </ElRow>

    <!-- 页面排行 + 来源/设备/浏览器分布 -->
    <ElRow :gutter="16" class="track-row">
      <ElCol :xs="24" :lg="12">
        <div class="art-card track-chart-card">
          <div class="track-card-head">
            <p class="track-card-title">{{ $t('pages.track.overview.pageRank') }}</p>
            <ElRadioGroup v-model="pageRankType" size="small" data-testid="track-page-rank-type">
              <ElRadioButton v-for="k in PAGE_RANK_TYPES" :key="k" :value="k">{{
                $t(PAGE_RANK_LABEL_KEY[k])
              }}</ElRadioButton>
            </ElRadioGroup>
          </div>
          <p class="track-card-hint" data-testid="track-page-rank-hint">{{
            $t(PAGE_RANK_HINT_KEY[pageRankShown])
          }}</p>
          <!-- 不限高：接口只取前 10 条，整张表放得下；限高会在本来就能滚动的页面里再套一层滚动 -->
          <!-- 三种排行的列不一样：换排行时整张表重建（:key），只换其中几列的话列的顺序会乱 -->
          <ElTable
            :key="pageRankShown"
            :data="topPages"
            v-loading="loading || pagesLoading"
            size="default"
            data-testid="track-page-rank-table"
          >
            <!-- 列宽合计 484：1366 宽时表格只有 506，再宽最后一列会被切掉 -->
            <ElTableColumn type="index" :label="$t('pages.track.shared.index')" width="56" />
            <ElTableColumn
              prop="pagePath"
              :label="$t('pages.track.overview.pagePath')"
              :min-width="pageRankShown === 'top' ? 160 : 150"
              show-overflow-tooltip
            />
            <template v-if="pageRankShown === 'top'">
              <ElTableColumn prop="pv" label="PV" width="84" align="right" />
              <ElTableColumn prop="uv" label="UV" width="84" align="right" />
              <ElTableColumn :label="$t('pages.track.overview.avgStay')" width="100" align="right">
                <template #default="{ row }">{{ fmtAvgStay(row.avgDurationMs) }}</template>
              </ElTableColumn>
            </template>
            <!-- 入口页、退出页的比率列比「平均停留」宽 10（英文表头「Bounce rate」要放得下），页面路径列相应窄 10 -->
            <template v-else-if="pageRankShown === 'entry'">
              <ElTableColumn
                prop="sessions"
                :label="$t('pages.track.overview.entrySessions')"
                width="84"
                align="right"
              />
              <ElTableColumn
                prop="bounces"
                :label="$t('pages.track.overview.bounces')"
                width="84"
                align="right"
              />
              <ElTableColumn
                :label="$t('pages.track.overview.bounceRate')"
                width="110"
                align="right"
              >
                <template #default="{ row }">{{ fmtPageRate(row.bounceRate) }}</template>
              </ElTableColumn>
            </template>
            <template v-else>
              <ElTableColumn
                prop="sessions"
                :label="$t('pages.track.overview.exitSessions')"
                width="84"
                align="right"
              />
              <ElTableColumn prop="pv" label="PV" width="84" align="right" />
              <ElTableColumn :label="$t('pages.track.overview.exitRate')" width="110" align="right">
                <template #default="{ row }">{{ fmtPageRate(row.exitRate) }}</template>
              </ElTableColumn>
            </template>
            <template #empty
              ><ElEmpty :description="$t('pages.track.shared.noData')" :image-size="60"
            /></template>
          </ElTable>
        </div>
      </ElCol>
      <ElCol :xs="24" :sm="8" :lg="4">
        <div class="art-card track-chart-card">
          <p class="track-card-title">{{ $t('pages.track.overview.referrerDist') }}</p>
          <ArtRingChart
            class="track-card-center"
            :data="referrerDist"
            :loading="loading"
            height="240px"
            show-legend
            legend-position="bottom"
          />
        </div>
      </ElCol>
      <ElCol :xs="24" :sm="8" :lg="4">
        <div class="art-card track-chart-card">
          <p class="track-card-title">{{ $t('pages.track.overview.deviceDist') }}</p>
          <ArtRingChart
            class="track-card-center"
            :data="deviceDist"
            :loading="loading"
            height="240px"
            show-legend
            legend-position="bottom"
          />
        </div>
      </ElCol>
      <ElCol :xs="24" :sm="8" :lg="4">
        <div class="art-card track-chart-card">
          <p class="track-card-title">{{ $t('pages.track.overview.browserTop') }}</p>
          <ArtRingChart
            class="track-card-center"
            :data="browserTop"
            :loading="loading"
            height="240px"
            show-legend
            legend-position="bottom"
          />
        </div>
      </ElCol>
    </ElRow>

    <ElRow :gutter="16" class="track-row">
      <ElCol :xs="24" :lg="12">
        <div class="art-card track-chart-card">
          <p class="track-card-title">{{ $t('pages.track.overview.regionDist') }}</p>
          <ArtBarChart
            :data="regionValues"
            :x-axis-data="regionLabels"
            :loading="loading"
            height="280px"
          />
          <ElTable :data="regions" size="default" max-height="220" class="track-region-table">
            <ElTableColumn
              prop="region"
              :label="$t('pages.track.overview.region')"
              min-width="100"
              show-overflow-tooltip
            />
            <ElTableColumn prop="pv" label="PV" width="80" align="right" />
            <ElTableColumn prop="uv" label="UV" width="80" align="right" />
            <ElTableColumn
              prop="eventCount"
              :label="$t('pages.track.shared.eventCount')"
              width="90"
              align="right"
            />
            <template #empty
              ><ElEmpty :description="$t('pages.track.overview.geoEmpty')" :image-size="48"
            /></template>
          </ElTable>
        </div>
      </ElCol>
      <ElCol :xs="24" :lg="12">
        <div class="art-card track-chart-card">
          <p class="track-card-title">
            {{ $t('pages.track.overview.geoHeat') }}
            <span v-if="showGeoCount(geoCount)" class="track-geo-count">{{
              $t('pages.track.overview.geoCount', { n: geoCount })
            }}</span>
          </p>
          <GisHeatMap v-if="heatState === 'ready'" class="track-heat-map" :points="geoPoints" />
          <ElEmpty
            v-else
            class="track-card-center"
            :description="$t(GEO_HEAT_EMPTY_KEY[heatState])"
            :image-size="72"
          />
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchTrackGeo,
    fetchTrackOnline,
    fetchTrackOverview,
    fetchTrackPages,
    fetchTrackTrend
  } from '@/api/track'
  import GisHeatMap from '@/components/gis/GisHeatMap.vue'
  import { GEO_HEAT_EMPTY_KEY, geoHeatState, showGeoCount } from '@/views/track/shared/geoHeatState'
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'
  import { fmtTrackClock, fmtTrackDuration, useTrackApp } from '@/views/track/shared/useTrackApp'
  import { fmtAvgSessionDuration, fmtBounceRate } from '@/views/track/shared/settledCards'
  import {
    PAGE_RANK_HINT_KEY,
    PAGE_RANK_LABEL_KEY,
    PAGE_RANK_TYPES,
    fmtPageRate,
    pageRankParam,
    type PageRankType
  } from '@/views/track/shared/pageRank'
  import { useChartOps } from '@/hooks/core/useChart'
  import type { LineDataItem, PieDataItem } from '@/types/component/chart'
  import {
    ElButton,
    ElMessage,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElSelect
  } from 'element-plus'

  defineOptions({ name: 'TrackOverview' })

  const userStore = useUserStore()
  const { t } = useI18n()

  const { appOptions, appKey, days, appsLoading } = useTrackApp()

  /** 页面排行「平均停留」统一秒级 1 位小数（同列可比，>1s 为主场景；不再 ms/s 混排） */
  const fmtAvgStay = (ms?: number | null): string => {
    if (ms === undefined || ms === null || Number.isNaN(Number(ms))) return '-'
    return `${(Number(ms) / 1000).toFixed(1)}s`
  }

  // 趋势配色：共享色板第 3 色 #EDF2FF 近白（「会话数」图例/线条对比度不足），仅本页替换为高对比橙
  const trendColors = useChartOps().colors.map((c, i) => (i === 2 ? '#FFAF20' : c))

  // ===== 指标卡 =====
  const cards = reactive({
    pv: 0,
    uv: 0,
    sessionCount: 0,
    eventCount: 0,
    avgSessionDurationMs: 0,
    bounceRate: 0,
    settledSessionCount: null as number | null
  })
  const referrerDist = ref<PieDataItem[]>([])
  const deviceDist = ref<PieDataItem[]>([])
  const browserTop = ref<PieDataItem[]>([])
  const regions = ref<{ region: string; pv: number; uv: number; eventCount: number }[]>([])
  const geoPoints = ref<{ lon: number; lat: number }[]>([])
  const geoCount = ref(0)
  // 构建期开关 && 后端 /auth/info 的 gisEnabled && 有精确坐标，才显示热力图
  const heatState = computed(() => geoHeatState(userStore.info, geoPoints.value.length))
  const regionLabels = computed(() => regions.value.map((r) => r.region))
  const regionValues = computed(() => regions.value.map((r) => Number(r.eventCount) || 0))

  const statCards = computed(() => [
    {
      key: 'pv',
      label: t('pages.track.overview.pvLabel'),
      value: cards.pv,
      icon: 'ri:eye-line',
      bg: 'var(--el-color-primary-light-9)',
      color: 'var(--el-color-primary)'
    },
    {
      key: 'uv',
      label: t('pages.track.overview.uvLabel'),
      value: cards.uv,
      icon: 'ri:user-line',
      bg: 'var(--el-color-success-light-9)',
      color: 'var(--el-color-success)'
    },
    {
      key: 'sessionCount',
      label: t('pages.track.shared.sessionCount'),
      value: cards.sessionCount,
      icon: 'ri:chat-1-line',
      bg: 'var(--el-color-warning-light-9)',
      color: 'var(--el-color-warning)'
    },
    {
      key: 'eventCount',
      label: t('pages.track.shared.eventCount'),
      value: cards.eventCount,
      icon: 'ri:flashlight-line',
      bg: 'var(--el-color-danger-light-9)',
      color: 'var(--el-color-danger)'
    },
    {
      key: 'avgSessionDurationMs',
      label: t('pages.track.overview.avgSessionDuration'),
      value: fmtAvgSessionDuration(cards, fmtTrackDuration),
      icon: 'ri:time-line',
      bg: 'var(--el-color-info-light-9)',
      color: 'var(--el-color-info)'
    },
    {
      key: 'bounceRate',
      label: t('pages.track.overview.bounceRate'),
      value: fmtBounceRate(cards),
      icon: 'ri:logout-box-line',
      bg: 'var(--el-color-error-light-9)',
      color: 'var(--el-color-error)'
    }
  ])

  // ===== 趋势（days≤2 小时粒度 time=epochMs；days>2 天粒度 date） =====
  const trendLabels = ref<string[]>([])
  const trendSeries = ref<LineDataItem[]>([])

  const applyTrend = (rows: any[]): void => {
    const list = rows ?? []
    const byDay = list.some((r) => r.date !== undefined)
    trendLabels.value = list.map((r) => (byDay ? String(r.date).slice(5) : fmtTrackClock(r.time)))
    const series: LineDataItem[] = [
      { name: 'PV', data: list.map((r) => Number(r.pv ?? 0)), showAreaColor: true },
      {
        name: t('pages.track.shared.sessionCount'),
        data: list.map((r) => Number(r.sessionCount ?? 0))
      },
      { name: t('pages.track.shared.eventCount'), data: list.map((r) => Number(r.eventCount ?? 0)) }
    ]
    if (byDay) {
      series.splice(1, 0, { name: 'UV', data: list.map((r) => Number(r.uv ?? 0)) })
    }
    trendSeries.value = series
  }

  // ===== 页面排行（访问最多 / 入口页 / 退出页） =====
  const topPages = ref<any[]>([])
  /** 选中的排行 */
  const pageRankType = ref<PageRankType>('top')
  /** 表格里正在显示的排行：数据回来以后才跟着换，免得列已经换了、行还是上一种排行的 */
  const pageRankShown = ref<PageRankType>('top')
  const pagesLoading = ref(false)
  let pagesSeq = 0

  /** 取页面排行。请求失败时请求层已经弹出提示语，这里只把表格清空，不连累页面上别的卡片 */
  const loadPages = async (): Promise<void> => {
    if (!appKey.value) return
    const seq = ++pagesSeq
    const type = pageRankType.value
    pagesLoading.value = true
    let rows: any[] = []
    try {
      rows =
        (await fetchTrackPages({
          appKey: appKey.value,
          days: days.value,
          limit: 10,
          ...pageRankParam(type)
        })) ?? []
    } catch {
      rows = []
    }
    // 后发的请求已经在路上（连着切换排行、换应用或天数）：这次的结果不要了
    if (seq !== pagesSeq) return
    topPages.value = rows
    pageRankShown.value = type
    pagesLoading.value = false
  }

  // ===== 当前在线（5s 轮询） =====
  const online = ref(0)
  const windowSeconds = ref(300)
  const onlineLoading = ref(false)
  const onlineLoaded = ref(false)

  const loadOnline = async (): Promise<void> => {
    if (!appKey.value) return
    onlineLoading.value = true
    try {
      const d = await fetchTrackOnline({ appKey: appKey.value })
      online.value = d?.online ?? 0
      windowSeconds.value = d?.windowSeconds ?? 300
      onlineLoaded.value = true
    } finally {
      onlineLoading.value = false
    }
  }
  // keepAlive 页面切走不销毁 scope，轮询随激活状态停走，避免后台空转
  const { pause: pauseOnline, resume: resumeOnline } = useIntervalFn(loadOnline, 5000)
  onDeactivated(pauseOnline)
  onActivated(resumeOnline)

  // ===== 数据加载 =====
  const loading = ref(false)

  const refreshOverview = (): void => {
    if (!appKey.value) {
      ElMessage.warning(t('pages.track.overview.needApp'))
      return
    }
    void loadAll()
  }

  const loadAll = async (): Promise<void> => {
    if (!appKey.value) return
    loading.value = true
    try {
      const [ov, trendRows, , geo] = await Promise.all([
        fetchTrackOverview({ appKey: appKey.value, days: days.value }),
        fetchTrackTrend({ appKey: appKey.value, days: days.value, dimType: 'overview' }),
        loadPages(),
        fetchTrackGeo({ appKey: appKey.value, days: days.value }).catch(() => null)
      ])
      Object.assign(cards, {
        pv: ov?.cards?.pv ?? 0,
        uv: ov?.cards?.uv ?? 0,
        sessionCount: ov?.cards?.sessionCount ?? 0,
        eventCount: ov?.cards?.eventCount ?? 0,
        avgSessionDurationMs: ov?.cards?.avgSessionDurationMs ?? 0,
        bounceRate: ov?.cards?.bounceRate ?? 0,
        settledSessionCount: ov?.cards?.settledSessionCount ?? null
      })
      referrerDist.value = ov?.referrerDist ?? []
      deviceDist.value = ov?.deviceDist ?? []
      browserTop.value = ov?.browserTop ?? []
      applyTrend(trendRows ?? [])
      regions.value = geo?.regions ?? []
      geoPoints.value = geo?.points ?? []
      geoCount.value = geo?.geoCount ?? 0
    } finally {
      loading.value = false
    }
  }

  watch([appKey, days], loadAll, { immediate: true })
  watch(pageRankType, loadPages)
  watch(appKey, loadOnline, { immediate: true })
</script>

<style lang="scss" scoped>
  .track-overview-page {
    // 指标卡 + 趋势/在线 + 页面排行/分布三行均为自然高度内容（合计约 900px+）：
    // art-full-height 定高下页面须自备纵向滚动，否则矮视口底部卡片被切断无法到达。
    // 横向要明确关掉：ElRow 的 gutter 靠负外边距左右各探出 8px，不关会多出一条没用的横向滚动条
    overflow: hidden auto;

    .el-row {
      flex-shrink: 0;
      // 窄屏下一行放不下会折成几行，gutter 只管左右间距，上下要自己留，否则卡片贴在一起
      row-gap: 16px;
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
    }

    .track-row {
      margin-top: 16px;
    }

    .track-card-title {
      font-size: 16px;
      font-weight: 500;
    }

    // 标题和右边的切换按钮排成一行；卡片窄到放不下时按钮折到下一行
    .track-card-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      justify-content: space-between;
    }

    .track-card-hint {
      margin: 6px 0 8px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .track-geo-count {
      margin-left: 8px;
      font-size: 12px;
      font-weight: 400;
      color: var(--el-text-color-secondary);
    }

    .track-region-table {
      margin-top: 12px;
    }

    // 1366 宽一行六张时每张只有 170px 左右：图标不能被挤扁，六个字的说明要放得下；
    // 个别说明还是折行时（英文），同一行卡片等高，不会一高一低
    .track-stat-card {
      box-sizing: border-box;
      display: flex;
      gap: 12px;
      align-items: center;
      height: 100%;
      padding: 16px;
    }

    .track-stat-body {
      min-width: 0;
    }

    .track-stat-icon {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      font-size: 20px;
      color: var(--el-color-primary);
      border-radius: 12px;
    }

    .track-stat-count {
      font-size: 24px;
      font-weight: 600;
    }

    .track-stat-label {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    // 同一行的卡片等高：内容矮的那张，图表和空状态在卡片里上下居中，热力图撑满，不会一高一低
    .track-chart-card {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
    }

    .track-card-center {
      margin-top: auto;
      margin-bottom: auto;
    }

    .track-heat-map {
      flex: 1;
      min-height: 280px;

      :deep(.gis-heat) {
        height: 100%;
      }
    }

    .track-online-card {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      padding: 16px;

      .track-online-body {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: center;
        margin-top: 48px;
      }

      .track-online-dot {
        width: 12px;
        height: 12px;
        background: var(--el-color-success);
        border-radius: 50%;
        animation: track-pulse 1.6s ease-in-out infinite;
      }

      .track-online-count {
        font-size: 56px;
        font-weight: 600;
        line-height: 1;
      }

      .track-online-sub {
        margin-top: auto;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        text-align: center;
      }
    }

    @keyframes track-pulse {
      0%,
      100% {
        opacity: 1;
      }

      50% {
        opacity: 0.3;
      }
    }
  }
</style>
