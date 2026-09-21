<!-- 漏斗分析（G103）：2–5 步有序漏斗（非紧邻匹配，首步后 windowHours 内依次触达才算转化）
     步骤构建器（事件名 = 事件定义全量名列表）→ 查询 → 左 ECharts 漏斗图 + 右步骤明细（逐步/总转化率） -->
<template>
  <div class="track-funnel-page art-full-height">
    <!-- 工具栏：应用选择（看板共享选中态）+ 统计天数 + 转化窗口 + 查询 -->
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
      <ElSelect v-model="windowHours" class="track-window-select">
        <ElOption :value="1" :label="$t('pages.track.funnel.window1h')" />
        <ElOption :value="24" :label="$t('pages.track.funnel.window24h')" />
        <ElOption :value="168" :label="$t('pages.track.funnel.window7d')" />
      </ElSelect>
      <ElButton type="primary" :loading="loading" :disabled="!appKey" @click="search">{{
        $t('pages.track.shared.search')
      }}</ElButton>
    </div>

    <!-- 步骤构建器：2–5 步，可上移/下移/删除 -->
    <div class="art-card track-funnel-builder">
      <p class="track-funnel-card-title">{{ $t('pages.track.funnel.stepsTitle') }}</p>
      <div class="track-funnel-steps">
        <div v-for="(s, i) in steps" :key="i" class="track-funnel-step">
          <span class="track-funnel-step-index">Step {{ i + 1 }}</span>
          <ElSelect
            v-model="s.eventName"
            filterable
            :loading="eventsLoading"
            :placeholder="$t('pages.track.funnel.selectEvent')"
            class="track-funnel-step-select"
          >
            <ElOption v-for="name in eventOptions" :key="name" :label="name" :value="name" />
          </ElSelect>
          <div class="track-funnel-step-actions">
            <ElButton
              link
              size="small"
              :title="$t('pages.track.funnel.moveUp')"
              :disabled="i === 0"
              @click="moveStep(i, -1)"
            >
              <ArtSvgIcon icon="ri:arrow-up-line" />
            </ElButton>
            <ElButton
              link
              size="small"
              :title="$t('pages.track.funnel.moveDown')"
              :disabled="i === steps.length - 1"
              @click="moveStep(i, 1)"
            >
              <ArtSvgIcon icon="ri:arrow-down-line" />
            </ElButton>
            <ElButton
              link
              size="small"
              type="danger"
              :title="$t('pages.track.shared.del')"
              :disabled="steps.length <= STEP_MIN"
              @click="removeStep(i)"
            >
              <ArtSvgIcon icon="ri:delete-bin-line" />
            </ElButton>
          </div>
        </div>
      </div>
      <ElButton class="track-funnel-add" :disabled="steps.length >= STEP_MAX" @click="addStep">
        <ArtSvgIcon icon="ri:add-line" class="track-funnel-add-icon" />{{
          $t('pages.track.funnel.addStep')
        }}
      </ElButton>
    </div>

    <!-- 结果区：未查询/全 0 空态；有数据时左右布局（lg 以下堆叠） -->
    <div class="track-funnel-result" v-loading="loading">
      <ElEmpty v-if="!searched" :description="$t('pages.track.funnel.emptyPrompt')" />
      <ElEmpty v-else-if="allZero" :description="$t('pages.track.funnel.emptyNoData')" />
      <!-- v-show 而非 v-if：图表容器常驻 DOM，避免 ECharts 实例绑到已销毁节点 -->
      <ElRow v-show="searched && !allZero" :gutter="16">
        <ElCol :xs="24" :lg="12">
          <div class="art-card track-funnel-chart-card">
            <p class="track-funnel-card-title">{{ $t('pages.track.funnel.funnelChart') }}</p>
            <div ref="chartRef" class="track-funnel-chart"></div>
          </div>
        </ElCol>
        <ElCol :xs="24" :lg="12">
          <div class="art-card track-funnel-table-card">
            <p class="track-funnel-card-title">{{ $t('pages.track.funnel.stepDetail') }}</p>
            <ElTable :data="tableRows" size="default">
              <ElTableColumn :label="$t('pages.track.funnel.stepCol')" width="80">
                <template #default="{ $index }">Step {{ $index + 1 }}</template>
              </ElTableColumn>
              <ElTableColumn
                prop="eventName"
                :label="$t('pages.track.shared.eventName')"
                min-width="160"
                show-overflow-tooltip
              />
              <ElTableColumn
                prop="count"
                :label="$t('pages.track.funnel.peopleCol')"
                width="90"
                align="right"
              />
              <ElTableColumn :label="$t('pages.track.funnel.stepRateCol')" width="160">
                <template #default="{ row }">
                  <span v-if="row.stepRate === null">—</span>
                  <div v-else class="track-funnel-rate">
                    <span>{{ row.stepRate.toFixed(1) }}%</span>
                    <div class="track-funnel-rate-bar">
                      <div
                        class="track-funnel-rate-fill"
                        :style="{ width: `${row.stepRate}%` }"
                      ></div>
                    </div>
                  </div>
                </template>
              </ElTableColumn>
              <ElTableColumn :label="$t('pages.track.funnel.totalRateCol')" width="140">
                <template #default="{ row }">
                  <div class="track-funnel-rate">
                    <span>{{ row.totalRate.toFixed(1) }}%</span>
                    <div class="track-funnel-rate-bar">
                      <div
                        class="track-funnel-rate-fill"
                        :style="{ width: `${row.totalRate}%` }"
                      ></div>
                    </div>
                  </div>
                </template>
              </ElTableColumn>
            </ElTable>
          </div>
        </ElCol>
      </ElRow>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchTrackEventDefPage, fetchTrackFunnel } from '@/api/track'
  import { useI18n } from 'vue-i18n'
  import { useTrackApp } from '@/views/track/shared/useTrackApp'
  import { useChart } from '@/hooks/core/useChart'
  import type { EChartsOption } from '@/plugins/echarts'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    ElButton,
    ElCol,
    ElEmpty,
    ElMessage,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElRow,
    ElSelect,
    ElTable,
    ElTableColumn
  } from 'element-plus'

  defineOptions({ name: 'TrackFunnel' })

  const { t } = useI18n()

  /** 步数硬限（与后端一致：2–5 步） */
  const STEP_MIN = 2
  const STEP_MAX = 5

  const { appOptions, appKey, days, appsLoading } = useTrackApp()

  // ===== 查询条件 =====
  /** 转化窗口（首步触达后依次完成后续步骤的时限，小时） */
  const windowHours = ref(24)

  // ===== 步骤构建器 =====
  interface FunnelStep {
    eventName: string
  }
  const steps = ref<FunnelStep[]>([{ eventName: '' }, { eventName: '' }])

  /** 事件名选项：事件定义分页全量名列表（去重），appKey 切换后重拉 */
  const eventOptions = ref<string[]>([])
  const eventsLoading = ref(false)

  const loadEventOptions = async (): Promise<void> => {
    if (!appKey.value) {
      eventOptions.value = []
      return
    }
    eventsLoading.value = true
    try {
      const resp: any = await fetchTrackEventDefPage({
        appKey: appKey.value,
        pageNum: 1,
        pageSize: 500
      })
      const names: string[] = (resp?.records ?? [])
        .map((r: any) => String(r.eventName ?? ''))
        .filter(Boolean)
      eventOptions.value = [...new Set(names)]
    } finally {
      eventsLoading.value = false
    }
  }

  const addStep = (): void => {
    if (steps.value.length < STEP_MAX) steps.value.push({ eventName: '' })
  }

  const removeStep = (index: number): void => {
    if (steps.value.length > STEP_MIN) steps.value.splice(index, 1)
  }

  const moveStep = (index: number, dir: -1 | 1): void => {
    const target = index + dir
    if (target < 0 || target >= steps.value.length) return
    const [s] = steps.value.splice(index, 1)
    steps.value.splice(target, 0, s)
  }

  // ===== 查询结果 =====
  interface FunnelResultStep {
    eventName: string
    count: number
  }
  const resultSteps = ref<FunnelResultStep[]>([])
  const loading = ref(false)
  /** 是否已发起过查询（区分「未查询」与「无转化数据」空态） */
  const searched = ref(false)

  const allZero = computed(
    () => resultSteps.value.length === 0 || resultSteps.value.every((s) => s.count === 0)
  )

  /** 明细行：相对上一步转化率（首步无）+ 总转化率，均 clamp 到 100 */
  const tableRows = computed(() => {
    const list = resultSteps.value
    const base = list[0]?.count ?? 0
    return list.map((s, i) => {
      const prev = i > 0 ? list[i - 1].count : 0
      return {
        eventName: s.eventName,
        count: s.count,
        stepRate: i === 0 ? null : prev > 0 ? Math.min(100, (s.count / prev) * 100) : 0,
        totalRate: base > 0 ? Math.min(100, (s.count / base) * 100) : 0
      }
    })
  })

  // ===== 漏斗图（页面内封装 useChart；单色相透明度渐变——主题自适应明暗，顶层收窄防 outer 标签裁切） =====
  const { chartRef, initChart, isDark, getTooltipStyle } = useChart()

  /** 主题色阶梯：读取 --el-color-primary 实算 rgb，按步骤降透明度（明暗双兼容；多色相板第三色 #EDF2FF 暗色下刺眼） */
  const stepColors = (): string[] => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--el-color-primary')
      .trim()
    const m = raw.match(/(\d+)[, ]\s*(\d+)[, ]\s*(\d+)/)
    const [r, g, b] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [93, 135, 255]
    const alphas = [1, 0.68, 0.45, 0.3, 0.2]
    return alphas.map((a) => `rgba(${r}, ${g}, ${b}, ${a})`)
  }

  const buildFunnelOption = (): EChartsOption => ({
    tooltip: getTooltipStyle('item'),
    series: [
      {
        type: 'funnel',
        // 后端计数单调不增，保持步骤顺序即可（不再按值重排）
        sort: 'none',
        // 顶层收窄至 64% 并居中：outer 标签（事件名+人数）留在卡片内缘，防最宽层标签被裁切
        left: 'center',
        maxSize: '64%',
        top: 16,
        bottom: 8,
        minSize: '22%',
        gap: 4,
        label: {
          show: true,
          position: 'outer',
          formatter: t('pages.track.funnel.funnelLabel', { b: '{b}', c: '{c}' }),
          color: isDark.value ? '#fff' : '#333',
          fontSize: 12
        },
        labelLine: { length: 12, lineStyle: { color: isDark.value ? '#444' : '#ddd' } },
        itemStyle: { borderRadius: 4 },
        data: resultSteps.value.map((s, i) => ({
          name: s.eventName,
          value: s.count,
          itemStyle: { color: stepColors()[i % 5] }
        }))
      }
    ]
  })

  const renderChart = async (): Promise<void> => {
    await nextTick()
    if (!chartRef.value || !searched.value || allZero.value) return
    initChart(buildFunnelOption())
  }
  // 主题切换重绘（useChart 自动主题仅回放旧 option，标签/引线色需按明暗重建）
  watch(isDark, renderChart)

  // ===== 查询（失败提示由 http 层统一透传后端 msg） =====
  const search = async (): Promise<void> => {
    if (!appKey.value) return
    const names = steps.value.map((s) => s.eventName)
    if (names.some((n) => !n)) {
      ElMessage.warning(t('pages.track.funnel.stepNameRequired'))
      return
    }
    if (new Set(names).size !== names.length) {
      ElMessage.warning(t('pages.track.funnel.stepNameDup'))
      return
    }
    loading.value = true
    searched.value = true
    try {
      const resp: any = await fetchTrackFunnel({
        appKey: appKey.value,
        days: days.value,
        windowHours: windowHours.value,
        steps: names.join(',')
      })
      resultSteps.value = (resp?.steps ?? []).map((s: any) => ({
        eventName: String(s.eventName ?? ''),
        count: Number(s.count ?? 0)
      }))
      await renderChart()
    } finally {
      loading.value = false
    }
  }

  // 应用切换：旧应用的步骤选项与结果作废，重拉事件名列表并回到待查询空态
  watch(
    appKey,
    () => {
      searched.value = false
      resultSteps.value = []
      loadEventOptions()
    },
    { immediate: true }
  )
</script>

<style lang="scss" scoped>
  .track-funnel-page {
    // 步骤构建器（最多 5 步）+ 结果区为自由增长内容：art-full-height 定高下
    // 页面须自备纵向滚动，否则 5 步时结果区底部被视口切断且无法到达
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

      .track-window-select {
        width: 160px;
      }
    }

    .track-funnel-card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .track-funnel-builder {
      flex-shrink: 0;
      padding: 16px;

      .track-funnel-steps {
        margin-top: 12px;

        .track-funnel-step {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          padding: 8px 0;

          .track-funnel-step-index {
            min-width: 56px;
            padding: 2px 10px;
            font-size: 12px;
            font-weight: 600;
            color: var(--el-color-primary);
            text-align: center;
            background: var(--el-color-primary-light-9);
            border-radius: 10px;
          }

          .track-funnel-step-select {
            width: 300px;
          }

          .track-funnel-step-actions {
            display: flex;
            gap: 4px;
            align-items: center;
          }
        }
      }

      .track-funnel-add {
        margin-top: 8px;

        .track-funnel-add-icon {
          margin-right: 4px;
        }
      }
    }

    .track-funnel-result {
      flex-shrink: 0;
      min-height: 240px;
      margin-top: 16px;

      .track-funnel-chart-card,
      .track-funnel-table-card {
        padding: 16px;
      }

      .track-funnel-chart {
        width: 100%;
        height: 320px;
        margin-top: 8px;
      }

      .track-funnel-rate {
        font-size: 13px;

        .track-funnel-rate-bar {
          height: 4px;
          margin-top: 4px;
          overflow: hidden;
          background: var(--el-fill-color);
          border-radius: 2px;

          .track-funnel-rate-fill {
            height: 100%;
            background: var(--el-color-primary);
            border-radius: 2px;
          }
        }
      }
    }
  }
</style>
