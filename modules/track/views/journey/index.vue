<!-- 访问路径：选一个页面当起点，一列一列往右看这些会话下一步去了哪、有多少没有再往下走。
     按会话算，步骤之间要紧挨着；每次会话只从起点第一次出现的地方往后看，所以点的那一行是几，选中后那一步就是几。
     每一列是一次查询：第 k 列带着前 k 步去查下一步的去向；选中一行就把它接到路径后面，再查下一列 -->
<template>
  <div class="track-journey-page art-full-height">
    <!-- 工具条：应用（各看板页共用选中态）+ 统计天数 + 起点方式 + 刷新 -->
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
        <!-- 天数和留存页共用：那边选了 14 天，这里也要看得出当前是多少天 -->
        <ElRadioButton v-if="days === 14" :value="14">{{
          $t('pages.track.shared.last14Days')
        }}</ElRadioButton>
        <ElRadioButton :value="30">{{ $t('pages.track.shared.last30Days') }}</ElRadioButton>
      </ElRadioGroup>
      <ElRadioGroup v-model="startMode" data-testid="track-journey-start">
        <ElRadioButton value="any" :title="$t('pages.track.journey.startAnyTip')">{{
          $t('pages.track.journey.startAny')
        }}</ElRadioButton>
        <ElRadioButton value="entry" :title="$t('pages.track.journey.startEntryTip')">{{
          $t('pages.track.journey.startEntry')
        }}</ElRadioButton>
      </ElRadioGroup>
      <ElButton :loading="reloading" :disabled="!appKey" @click="reloadAll">{{
        $t('pages.track.shared.refresh')
      }}</ElButton>
      <span class="track-journey-hint">{{ $t('pages.track.journey.hint') }}</span>
    </div>

    <div v-loading="appsLoading && !appKey" class="art-card track-journey-card">
      <ElResult
        v-if="!appKey && appsError && !appsLoading"
        icon="error"
        class="track-journey-fail"
        :sub-title="errorText(appsError)"
      >
        <template #extra>
          <ElButton type="primary" @click="loadApps">{{
            $t('pages.track.journey.retry')
          }}</ElButton>
        </template>
      </ElResult>
      <ElEmpty
        v-else-if="!appKey && !appsLoading"
        class="track-journey-fail"
        :description="$t('pages.track.journey.noApp')"
      />
      <template v-else-if="appKey">
        <!-- 已选路径：每一步的会话数和占上一步的多少；点前面的步骤回到那一步 -->
        <div class="track-journey-path" data-testid="track-journey-path">
          <span class="track-journey-path-title">{{ $t('pages.track.journey.pathTitle') }}</span>
          <span v-if="crumbs.length === 0" class="track-journey-path-empty">{{
            $t('pages.track.journey.pathEmpty')
          }}</span>
          <template v-else>
            <ol class="track-journey-crumbs">
              <li v-for="(c, i) in crumbs" :key="i" class="track-journey-crumb">
                <span v-if="i > 0" class="track-journey-crumb-arrow" aria-hidden="true">→</span>
                <component
                  :is="i < crumbs.length - 1 ? 'button' : 'span'"
                  :type="i < crumbs.length - 1 ? 'button' : undefined"
                  class="track-journey-crumb-body"
                  :class="{ 'is-link': i < crumbs.length - 1 }"
                  :title="crumbTitle(c.page, i)"
                  @click="i < crumbs.length - 1 && keepSteps(i + 1)"
                >
                  <span class="track-journey-crumb-index">{{ i + 1 }}</span>
                  <span class="track-journey-crumb-page">{{ c.page }}</span>
                  <span v-if="c.sessions !== null" class="track-journey-crumb-meta">{{
                    crumbMeta(c)
                  }}</span>
                </component>
              </li>
            </ol>
            <span class="track-journey-path-side">
              <span v-if="overallText" class="track-journey-overall">{{ overallText }}</span>
              <ElButton
                link
                type="primary"
                data-testid="track-journey-clear"
                @click="keepSteps(0)"
                >{{ $t('pages.track.journey.clear') }}</ElButton
              >
            </span>
          </template>
        </div>

        <!-- 一列一列的去向：横向可滚动，每一列自己纵向滚动 -->
        <div ref="columnsRef" class="track-journey-columns">
          <section
            v-for="(col, ci) in columns"
            :key="ci"
            class="track-journey-column"
            :aria-label="columnTitle(ci)"
            :data-testid="`track-journey-col-${ci}`"
          >
            <header class="track-journey-column-head">
              <div class="track-journey-column-title">{{ columnTitle(ci) }}</div>
              <div class="track-journey-column-sub">{{ columnSub(col, ci) }}</div>
            </header>
            <div v-loading="col.loading" class="track-journey-list">
              <div v-if="col.error && !col.loading" class="track-journey-state">
                <p class="track-journey-state-text">{{ errorText(col.error) }}</p>
                <ElButton type="primary" size="small" @click="loadColumn(col)">{{
                  $t('pages.track.journey.retry')
                }}</ElButton>
              </div>
              <ElEmpty
                v-else-if="col.result && col.rows.length === 0 && col.totals.length === 0"
                :image-size="60"
                :description="
                  $t(ci === 0 ? 'pages.track.journey.emptyStart' : 'pages.track.journey.emptyPath')
                "
              />
              <p v-else-if="col.result && col.rows.length === 0" class="track-journey-note">
                {{ $t('pages.track.journey.noNext') }}
              </p>
              <template v-else>
                <!-- 最后一列（已经选满步数）只能看，行不是按钮 -->
                <component
                  :is="ci < JOURNEY_STEPS_MAX ? 'button' : 'div'"
                  v-for="row in col.rows"
                  :key="row.page"
                  :type="ci < JOURNEY_STEPS_MAX ? 'button' : undefined"
                  class="track-journey-row"
                  :class="{
                    'is-choosable': ci < JOURNEY_STEPS_MAX,
                    'is-active': selected[ci] === row.page
                  }"
                  :aria-pressed="ci < JOURNEY_STEPS_MAX ? selected[ci] === row.page : undefined"
                  :title="row.page"
                  @click="ci < JOURNEY_STEPS_MAX && choose(ci, row.page)"
                >
                  <span class="track-journey-row-main">
                    <span class="track-journey-row-page">{{ row.page }}</span>
                    <span class="track-journey-row-count">{{ fmtCount(row.sessions) }}</span>
                    <span class="track-journey-row-pct">{{ formatJourneyShare(row.pct) }}</span>
                  </span>
                  <span class="track-journey-row-bar">
                    <span class="track-journey-row-fill" :style="{ width: `${row.pct}%` }" />
                  </span>
                </component>
                <ElButton
                  v-if="col.result && journeyHasMore(col.result, col.limit)"
                  link
                  type="primary"
                  class="track-journey-more"
                  :loading="col.loading"
                  @click="showMore(col)"
                  >{{ $t('pages.track.journey.showMore') }}</ElButton
                >
                <p v-if="ci >= JOURNEY_STEPS_MAX" class="track-journey-note">
                  {{ $t('pages.track.journey.maxSteps', { n: JOURNEY_STEPS_MAX }) }}
                </p>
              </template>
            </div>
            <!-- 合计固定在列底，不跟着列表滚走：「没有下一步」是这一列最要紧的数，不能藏在滚动区下面 -->
            <div v-if="col.totals.length > 0" class="track-journey-foot">
              <div
                v-for="row in col.totals"
                :key="row.kind"
                class="track-journey-row"
                :class="`is-${row.kind}`"
                :title="totalTip(row)"
              >
                <span class="track-journey-row-main">
                  <span class="track-journey-row-page">{{ totalLabel(row) }}</span>
                  <span class="track-journey-row-count">{{ fmtCount(row.sessions) }}</span>
                  <span class="track-journey-row-pct">{{ formatJourneyShare(row.pct) }}</span>
                </span>
                <span class="track-journey-row-bar">
                  <span class="track-journey-row-fill" :style="{ width: `${row.pct}%` }" />
                </span>
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { fetchTrackJourney } from '@/api/track'
  import { useI18n } from 'vue-i18n'
  import { useTrackApp } from '@/views/track/shared/useTrackApp'
  import { isNetworkError } from '@/utils/http/error'
  import {
    ElButton,
    ElEmpty,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElResult,
    ElSelect
  } from 'element-plus'
  import {
    JOURNEY_LIMIT_DEFAULT,
    JOURNEY_LIMIT_MAX,
    JOURNEY_STEPS_MAX,
    buildJourneyCrumbs,
    buildJourneyRows,
    encodeJourneySteps,
    formatJourneyShare,
    journeyBase,
    journeyHasMore,
    journeyOverallShare,
    normalizeJourneyResult,
    type TrackJourneyCrumb,
    type TrackJourneyResult,
    type TrackJourneyRow,
    type TrackJourneyStart
  } from '../../journey-shape'

  defineOptions({ name: 'TrackJourney' })

  const { t } = useI18n()

  const { appOptions, appKey, days, appsLoading, appsError, loadApps } = useTrackApp()

  /** 起点方式：any 会话里到过起点页面就算；entry 只看第一个页面就是起点页面的会话 */
  const startMode = ref<TrackJourneyStart>('any')

  // ===== 列 =====
  interface JourneyColumn {
    /** 这一列是带着哪几步去查的；第 0 列是空数组，列出可以当起点的页面 */
    prefix: string[]
    limit: number
    loading: boolean
    error: unknown
    result: TrackJourneyResult | null
    /** 可以选的页面，在列表里滚动 */
    rows: TrackJourneyRow[]
    /** 「其他页面」「没有下一步」两个合计，固定在列底 */
    totals: TrackJourneyRow[]
    /** 每发一次请求加一：晚到的旧响应对不上号就丢掉 */
    seq: number
  }

  const newColumn = (prefix: string[]): JourneyColumn => ({
    prefix,
    limit: JOURNEY_LIMIT_DEFAULT,
    loading: false,
    error: null,
    result: null,
    rows: [],
    totals: [],
    seq: 0
  })

  /** 列是一层一层选出来的：第 k 列的 prefix 是已选路径的前 k 步，最后一列的 prefix 就是整条已选路径 */
  const columns = ref<JourneyColumn[]>([])
  const columnsRef = ref<HTMLElement>()

  const selected = computed<string[]>(() => {
    const list = columns.value
    return list.length > 0 ? list[list.length - 1].prefix : []
  })
  const reloading = computed(() => columns.value.some((c) => c.loading))

  const loadColumn = async (col: JourneyColumn): Promise<void> => {
    if (!appKey.value) return
    const seq = ++col.seq
    col.loading = true
    col.error = null
    try {
      const raw = await fetchTrackJourney({
        appKey: appKey.value,
        days: days.value,
        start: startMode.value,
        limit: col.limit,
        steps: encodeJourneySteps(col.prefix)
      })
      if (col.seq !== seq) return
      const result = normalizeJourneyResult(raw)
      const rows = buildJourneyRows(result)
      col.result = result
      col.rows = rows.filter((r) => r.kind === 'page')
      col.totals = rows.filter((r) => r.kind !== 'page')
    } catch (err) {
      if (col.seq !== seq) return
      col.error = err
      col.result = null
      col.rows = []
      col.totals = []
    } finally {
      if (col.seq === seq) col.loading = false
    }
  }

  /** 换了应用：已选的路径作废，从选起点重新开始 */
  const resetAll = (): void => {
    columns.value = appKey.value ? [newColumn([])] : []
    if (columns.value.length > 0) void loadColumn(columns.value[0])
  }

  /** 换了天数或起点方式、点了刷新：路径留着，每一列按新条件重查 */
  const reloadAll = (): void => {
    columns.value.forEach((col) => void loadColumn(col))
  }

  const scrollToEnd = async (): Promise<void> => {
    await nextTick()
    const el = columnsRef.value
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }

  /** 把第 ci 列的这个页面选成下一步：后面的列作废，接着查新的一列 */
  const choose = (ci: number, page: string): void => {
    const col = columns.value[ci]
    if (!col || ci >= JOURNEY_STEPS_MAX || selected.value[ci] === page) return
    columns.value = [...columns.value.slice(0, ci + 1), newColumn([...col.prefix, page])]
    void loadColumn(columns.value[ci + 1])
    void scrollToEnd()
  }

  /** 只保留前 n 步（n=0 就是清空） */
  const keepSteps = (n: number): void => {
    columns.value = columns.value.slice(0, n + 1)
  }

  const showMore = (col: JourneyColumn): void => {
    col.limit = JOURNEY_LIMIT_MAX
    void loadColumn(col)
  }

  // ===== 显示文字 =====
  const fmtCount = (n: number): string => n.toLocaleString('en-US')

  const sessionsText = (n: number): string =>
    t('pages.track.journey.sessions', { n: fmtCount(n) }, n)

  const columnTitle = (ci: number): string =>
    ci === 0 ? t('pages.track.journey.startTitle') : t('pages.track.journey.afterStep', { n: ci })

  /** 列头第二行：这一列的占比是相对多少次会话算的；还没查回来时留空（样式里占着行高，不跳） */
  const columnSub = (col: JourneyColumn, ci: number): string => {
    if (!col.result) return ''
    const n = journeyBase(col.result)
    return ci === 0
      ? t('pages.track.journey.totalSessions', { n: fmtCount(n) }, n)
      : t('pages.track.journey.reachedSessions', { n: fmtCount(n) }, n)
  }

  const totalLabel = (row: TrackJourneyRow): string =>
    t(row.kind === 'ended' ? 'pages.track.journey.ended' : 'pages.track.journey.others')

  const totalTip = (row: TrackJourneyRow): string =>
    t(row.kind === 'ended' ? 'pages.track.journey.endedTip' : 'pages.track.journey.othersTip')

  const crumbs = computed<TrackJourneyCrumb[]>(() => buildJourneyCrumbs(columns.value))

  const crumbMeta = (c: TrackJourneyCrumb): string => {
    if (c.sessions === null) return ''
    const text = sessionsText(c.sessions)
    if (c.pctOfPrev === null) return text
    return `${text} · ${t('pages.track.journey.ofPrev', { pct: formatJourneyShare(c.pctOfPrev) })}`
  }

  /** 前面的步骤可以点（回到那一步），最后一步只是显示 */
  const crumbTitle = (page: string, i: number): string =>
    i < crumbs.value.length - 1 ? `${page}\n${t('pages.track.journey.backToStep')}` : page

  const overallText = computed(() => {
    const pct = journeyOverallShare(crumbs.value)
    return pct === null ? '' : t('pages.track.journey.overall', { pct: formatJourneyShare(pct) })
  })

  const errorText = (err: unknown): string => {
    if (isNetworkError(err)) return t('pages.track.journey.loadFailedNetwork')
    const msg = err instanceof Error ? err.message : ''
    return msg
      ? t('pages.track.journey.loadFailedOther', { msg })
      : t('pages.track.journey.loadFailed')
  }

  watch(appKey, resetAll, { immediate: true })
  watch([days, startMode], reloadAll)
</script>

<style lang="scss" scoped>
  .track-journey-page {
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

      .track-journey-hint {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    // 页面定高（art-full-height）：卡片吃掉剩下的高度，滚动交给里面的列，页面自己不出滚动条
    .track-journey-card {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      padding: 16px;
    }

    .track-journey-fail {
      margin: auto;
    }

    // 一行摆得下就一行：路径长了只在自己里面换行，总转化和清空始终跟在第一行，省下的高度留给下面的列
    .track-journey-path {
      display: flex;
      flex-shrink: 0;
      gap: 4px 12px;
      align-items: flex-start;
      min-height: 28px;
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 28px;

      .track-journey-path-title {
        flex-shrink: 0;
        font-size: 14px;
        font-weight: 500;
      }

      .track-journey-path-empty,
      .track-journey-overall {
        color: var(--el-text-color-secondary);
      }

      // 窄屏会折成几行：行距按正文来，上下补足到和单行一样高
      .track-journey-path-empty {
        padding: 4px 0;
        line-height: 20px;
      }

      .track-journey-path-side {
        // 按钮默认比这一行高，会把整条撑高、把旁边的文字顶歪；全局样式按这个变量给按钮定高
        --el-component-custom-height: 28px;

        display: inline-flex;
        flex-shrink: 0;
        gap: 12px;
        align-items: center;
        min-height: 28px;
      }
    }

    .track-journey-crumbs {
      display: flex;
      flex: 0 1 auto;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      min-width: 0;
      padding: 0;
      margin: 0;
      line-height: 20px;
      list-style: none;
    }

    .track-journey-crumb {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;

      .track-journey-crumb-arrow {
        color: var(--el-text-color-placeholder);
      }

      .track-journey-crumb-body {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        max-width: 100%;
        padding: 4px 12px 4px 4px;
        font: inherit;
        font-size: 13px;
        color: var(--el-text-color-primary);
        background: var(--el-fill-color-light);
        border: 0;
        border-radius: 14px;

        &.is-link {
          cursor: pointer;

          &:hover {
            background: var(--el-color-primary-light-9);
          }

          &:focus-visible {
            outline: 2px solid var(--el-color-primary);
            outline-offset: 1px;
          }
        }
      }

      .track-journey-crumb-index {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        font-size: 12px;
        font-weight: 600;
        line-height: 20px;
        color: var(--el-color-primary);
        text-align: center;
        background: var(--el-color-primary-light-8);
        border-radius: 50%;
      }

      .track-journey-crumb-page {
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .track-journey-crumb-meta {
        flex-shrink: 0;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-secondary);
      }
    }

    .track-journey-columns {
      display: flex;
      flex: 1;
      gap: 12px;
      min-height: 0;
      padding-bottom: 4px;
      overflow-x: auto;
    }

    // min-width: 0：列宽固定。不写的话一个超长的页面名会把整列撑宽（弹性子项默认不能比内容的最小宽度更窄）
    .track-journey-column {
      display: flex;
      flex: 0 0 300px;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;

      .track-journey-column-head {
        flex-shrink: 0;
        padding: 8px 12px;
        border-bottom: 1px solid var(--el-border-color-lighter);
      }

      .track-journey-column-title {
        font-size: 14px;
        font-weight: 500;
      }

      .track-journey-column-sub {
        min-height: 20px;
        font-size: 12px;
        line-height: 20px;
        color: var(--el-text-color-secondary);
      }
    }

    .track-journey-list {
      flex: 1;
      min-height: 120px;
      padding: 4px;
      overflow-y: auto;

      .track-journey-state {
        padding: 24px 12px;
        text-align: center;

        .track-journey-state-text {
          margin-bottom: 12px;
          font-size: 13px;
          color: var(--el-text-color-secondary);
          overflow-wrap: anywhere;
        }
      }

      .track-journey-more {
        display: flex;
        margin: 4px auto;
      }

      .track-journey-note {
        padding: 8px 8px 4px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    .track-journey-foot {
      flex-shrink: 0;
      padding: 4px;
      border-top: 1px solid var(--el-border-color-lighter);
    }

    .track-journey-row {
      display: block;
      width: 100%;
      padding: 8px;
      font: inherit;
      color: var(--el-text-color-primary);
      text-align: left;
      background: transparent;
      border: 0;
      border-radius: 6px;

      &.is-choosable {
        cursor: pointer;

        &:hover {
          background: var(--el-fill-color-light);
        }

        &:focus-visible {
          outline: 2px solid var(--el-color-primary);
          outline-offset: -2px;
        }
      }

      &.is-active,
      &.is-active:hover {
        background: var(--el-color-primary-light-9);

        .track-journey-row-page {
          font-weight: 500;
          color: var(--el-color-primary);
        }
      }

      &.is-ended,
      &.is-others {
        color: var(--el-text-color-secondary);

        .track-journey-row-fill {
          background: var(--el-text-color-placeholder);
        }
      }

      .track-journey-row-main {
        display: flex;
        gap: 8px;
        align-items: baseline;
        line-height: 20px;
      }

      .track-journey-row-page {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .track-journey-row-count {
        flex-shrink: 0;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }

      .track-journey-row-pct {
        flex-shrink: 0;
        width: 48px;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-secondary);
        text-align: right;
      }

      .track-journey-row-bar {
        display: block;
        height: 4px;
        margin-top: 4px;
        overflow: hidden;
        background: var(--el-fill-color);
        border-radius: 2px;
      }

      .track-journey-row-fill {
        display: block;
        height: 100%;
        background: var(--el-color-primary);
        border-radius: 2px;
      }
    }

    // 窄屏：页面不再定高（art-full-height 在 640px 以下是 auto），列区域自己定一个高度，不然会塌成内容高度
    @media (width <= 640px) {
      .track-journey-path {
        flex-wrap: wrap;
      }

      .track-journey-crumbs {
        flex-basis: 100%;
      }

      // 一行放不下时让「多少会话」换到第二行，不要把页面名挤成省略号
      .track-journey-crumb .track-journey-crumb-body {
        flex-wrap: wrap;
        row-gap: 0;
        padding-right: 12px;
        border-radius: 12px;
      }

      .track-journey-columns {
        flex: none;
        height: 60vh;
        min-height: 360px;
      }

      .track-journey-column {
        flex-basis: min(300px, 82vw);
      }
    }
  }
</style>
