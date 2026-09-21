<!-- 留存分析（G103）：新客 cohort 留存网格（窗口内新客按首次活跃日分组，UTC 日切）
     行 = cohort 日 + 规模（首列固定），列 = D+0..D+N，cell = 保留率 color-mix 色阶，未来 offset 占位「·」 -->
<template>
  <div class="track-retention-page art-full-height">
    <!-- 工具栏：应用选择（看板共享选中态）+ 统计天数 + 查询 + 口径说明 -->
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
        <ElRadioButton :value="7">{{ $t('pages.track.shared.last7Days') }}</ElRadioButton>
        <ElRadioButton :value="14">{{ $t('pages.track.shared.last14Days') }}</ElRadioButton>
        <ElRadioButton :value="30">{{ $t('pages.track.shared.last30Days') }}</ElRadioButton>
      </ElRadioGroup>
      <ElButton type="primary" :loading="loading" :disabled="!appKey" @click="search">{{
        $t('pages.track.shared.search')
      }}</ElButton>
      <span class="track-retention-hint">{{ $t('pages.track.retention.hint') }}</span>
    </div>

    <!-- 留存网格：自定义 table（矩阵结构，首列 sticky，横向可滚动） -->
    <div class="art-card track-retention-card" v-loading="loading">
      <p class="track-retention-card-title">{{ $t('pages.track.retention.gridTitle') }}</p>
      <ElEmpty v-if="!searched" :description="$t('pages.track.retention.emptyPrompt')" />
      <ElEmpty
        v-else-if="rows.length === 0 && !loading"
        :description="$t('pages.track.retention.emptyNoData')"
      />
      <template v-else>
        <div class="track-retention-scroll">
          <table class="track-retention-grid">
            <thead>
              <tr>
                <th class="track-retention-cohort-col">{{
                  $t('pages.track.retention.cohortDate')
                }}</th>
                <th v-for="o in offsets" :key="o">D+{{ o }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.cohortDate">
                <td class="track-retention-cohort-col">
                  <div class="track-retention-cohort">
                    <span class="track-retention-cohort-date">{{ r.cohortDate }}</span>
                    <span class="track-retention-cohort-size">{{
                      $t('pages.track.retention.cohortSize', { size: r.cohortSize })
                    }}</span>
                  </div>
                </td>
                <td
                  v-for="o in offsets"
                  :key="o"
                  class="track-retention-cell"
                  :style="{ background: cellBg(r, o) }"
                >
                  <ElTooltip v-if="!isFutureCell(r, o)" :content="cellTip(r, o)" placement="top">
                    <span class="track-retention-cell-text">{{ cellPct(r, o).toFixed(1) }}%</span>
                  </ElTooltip>
                  <span v-else class="track-retention-cell-empty">·</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- 图例：色阶样本（0–45% 五档） -->
        <div class="track-retention-legend">
          <span
            v-for="x in legendStops"
            :key="x"
            class="track-retention-legend-swatch"
            :style="{ background: swatchBg(x) }"
          ></span>
          <span class="track-retention-legend-text">{{
            $t('pages.track.retention.legendText')
          }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchTrackRetention } from '@/api/track'
  import { useI18n } from 'vue-i18n'
  import { useTrackApp } from '@/views/track/shared/useTrackApp'
  import {
    ElButton,
    ElEmpty,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElSelect,
    ElTooltip
  } from 'element-plus'

  defineOptions({ name: 'TrackRetention' })

  const { t } = useI18n()

  /** 色阶上限：保留率 0–100% 映射主题色透明度 0–45%（0% 全透明） */
  const COLOR_MIX_MAX = 45
  const DAY_MS = 24 * 3600 * 1000

  const { appOptions, appKey, days, appsLoading } = useTrackApp()

  // ===== 留存网格数据 =====
  interface RetentionRow {
    cohortDate: string
    cohortSize: number
    /** offset（"0".."N"）→ 当日回访人数 */
    retained: Record<string, number>
  }
  const rows = ref<RetentionRow[]>([])
  const loading = ref(false)
  /** 是否已发起过查询（区分「未查询」与「无新客数据」空态） */
  const searched = ref(false)
  /** 查询时刻的天数快照：网格列数随结果走，避免改天数未重查时列数与数据错位 */
  const queryDays = ref(7)

  const offsets = computed(() => Array.from({ length: queryDays.value }, (_, i) => i))

  // ===== 单元格计算 =====
  /** 今天 0 点（UTC 墙钟，与日切口径一致） */
  const todayUtcMs = (): number => {
    const d = new Date()
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }

  const cohortUtcMs = (cohortDate: string): number => {
    const t = Date.parse(`${cohortDate}T00:00:00Z`)
    return Number.isNaN(t) ? 0 : t
  }

  /** cohort 日 + offset 超出今天（UTC）即未来格，无数据 */
  const isFutureCell = (row: RetentionRow, offset: number): boolean =>
    cohortUtcMs(row.cohortDate) + offset * DAY_MS > todayUtcMs()

  const retainedCount = (row: RetentionRow, offset: number): number =>
    Number(row.retained?.[offset] ?? 0)

  /** 保留率 = retained[offset] / cohortSize × 100 */
  const cellPct = (row: RetentionRow, offset: number): number =>
    row.cohortSize > 0 ? (retainedCount(row, offset) / row.cohortSize) * 100 : 0

  /** 色阶背景：color-mix 主题色 X%（保留率 0–100 → X 0–45），未来格透明 */
  const cellBg = (row: RetentionRow, offset: number): string => {
    if (isFutureCell(row, offset)) return ''
    const x = (Math.min(100, Math.max(0, cellPct(row, offset))) / 100) * COLOR_MIX_MAX
    return `color-mix(in srgb, var(--el-color-primary) ${x.toFixed(1)}%, transparent)`
  }

  const cellTip = (row: RetentionRow, offset: number): string =>
    t('pages.track.retention.cellTip', {
      offset,
      retained: retainedCount(row, offset),
      total: row.cohortSize,
      pct: cellPct(row, offset).toFixed(1)
    })

  // ===== 图例（5 档渐变样本） =====
  const legendStops = [9, 18, 27, 36, 45]
  const swatchBg = (x: number): string =>
    `color-mix(in srgb, var(--el-color-primary) ${x}%, transparent)`

  // ===== 查询（失败提示由 http 层统一透传后端 msg） =====
  const search = async (): Promise<void> => {
    if (!appKey.value) return
    loading.value = true
    searched.value = true
    try {
      const resp: any = await fetchTrackRetention({ appKey: appKey.value, days: days.value })
      rows.value = (resp?.rows ?? []).map((r: any) => ({
        cohortDate: String(r.cohortDate ?? '').slice(0, 10),
        cohortSize: Number(r.cohortSize ?? 0),
        retained: (r.retained ?? {}) as Record<string, number>
      }))
      queryDays.value = days.value
    } finally {
      loading.value = false
    }
  }

  // 应用切换：旧应用的网格结果作废，回到待查询空态
  watch(appKey, () => {
    searched.value = false
    rows.value = []
  })
</script>

<style lang="scss" scoped>
  .track-retention-page {
    // 留存网格行数随天数窗口增长（近 30 天可达 30 个 cohort 行，约 1500px）：
    // art-full-height 定高下页面须自备纵向滚动，否则网格下半被视口切断无法到达
    overflow-y: auto;

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

      .track-retention-hint {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .track-retention-card {
      flex-shrink: 0;
      min-height: 240px;
      padding: 16px;

      .track-retention-card-title {
        font-size: 16px;
        font-weight: 500;
      }

      .track-retention-scroll {
        margin-top: 12px;
        overflow-x: auto;
      }

      .track-retention-grid {
        font-size: 13px;
        white-space: nowrap;
        border-collapse: collapse;

        th,
        td {
          padding: 8px 10px;
          text-align: center;
          border: 1px solid var(--el-border-color-extra-light);
        }

        th {
          font-weight: 500;
          color: var(--el-text-color-secondary);
          background: var(--el-fill-color-light);
        }

        .track-retention-cohort-col {
          position: sticky;
          left: 0;
          z-index: 2;
          min-width: 140px;
          text-align: left;
          // 不透明背景随主题，遮住横向滚动时下层单元格（与 art-card 底色一致）
          background: var(--el-bg-color);
        }

        th.track-retention-cohort-col {
          background: var(--el-fill-color-light);
        }

        .track-retention-cohort {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .track-retention-cohort-date {
            font-weight: 500;
          }

          .track-retention-cohort-size {
            font-size: 12px;
            color: var(--el-text-color-secondary);
          }
        }

        .track-retention-cell {
          min-width: 72px;

          .track-retention-cell-text {
            color: var(--el-text-color-regular);
          }

          .track-retention-cell-empty {
            color: var(--el-text-color-placeholder);
          }
        }
      }

      .track-retention-legend {
        display: flex;
        gap: 4px;
        align-items: center;
        margin-top: 12px;

        .track-retention-legend-swatch {
          width: 28px;
          height: 10px;
          border: 1px solid var(--el-border-color-lighter);
          border-radius: 2px;
        }

        .track-retention-legend-text {
          margin-left: 8px;
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }
</style>
