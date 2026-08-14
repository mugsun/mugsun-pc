<!-- 工作台：登录落地页——概览统计 + echarts 图表 + 我的待办/通知/更新日志卡 + 可配置快捷入口 -->
<template>
  <div class="console-page">
    <!-- 概览统计瓦片 -->
    <ElRow :gutter="16">
      <ElCol v-for="s in statTiles" :key="s.key" :xs="12" :sm="12" :md="6">
        <div class="art-card stat-tile" @click="s.path && go(s.path)">
          <div class="stat-icon" :style="{ background: s.bg, color: s.color }">
            <ArtSvgIcon :icon="s.icon" />
          </div>
          <div class="stat-body">
            <div class="stat-count">{{ s.count }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
        </div>
      </ElCol>
    </ElRow>

    <!-- 图表：租户分布仅平台超管/查看全部下发；普通租户不渲染该卡，饼图占满行 -->
    <ElRow :gutter="16" class="mt-4">
      <ElCol :xs="24" :lg="showTenantChart ? 12 : 24">
        <div class="art-card chart-card" v-loading="overviewLoading">
          <p class="card-title">{{ $t('pages.dashboard.console.userStatusChart') }}</p>
          <!-- 与柱状图同款：空数据时 echarts 只画空环，以 ElEmpty 替代；v-show 保挂载 -->
          <ElEmpty
            v-if="pieEmpty"
            :description="$t('pages.dashboard.console.noData')"
            :image-size="60"
          />
          <div v-show="!pieEmpty" ref="pieRef" class="chart-box"></div>
        </div>
      </ElCol>
      <ElCol v-if="showTenantChart" :xs="24" :lg="12" class="mt-4 mt-lg-0">
        <div class="art-card chart-card" v-loading="overviewLoading">
          <p class="card-title">{{ $t('pages.dashboard.console.tenantUserChart') }}</p>
          <!-- 空数据时 echarts 只画一条轴线，以 ElEmpty 替代；图表容器 v-show 保挂载，有数据后再 init -->
          <ElEmpty
            v-if="barEmpty"
            :description="$t('pages.dashboard.console.noData')"
            :image-size="60"
          />
          <div v-show="!barEmpty" ref="barRef" class="chart-box"></div>
        </div>
      </ElCol>
    </ElRow>

    <!-- 卡片：待办 / 通知 / 更新日志 -->
    <ElRow :gutter="16" class="mt-4">
      <ElCol :xs="24" :lg="8">
        <div class="art-card list-card" v-loading="todoLoading">
          <div class="card-head">
            <span class="card-title">{{ $t('pages.dashboard.console.myTodo') }}</span>
            <ElButton link type="primary" size="small" @click="go('/system/flow-todo')">
              {{ $t('pages.dashboard.console.viewAll') }}
            </ElButton>
          </div>
          <ElEmpty
            v-if="!todoList.length"
            :description="$t('pages.dashboard.console.noTodo')"
            :image-size="60"
          />
          <ul v-else class="mini-list">
            <li v-for="t in todoList" :key="t.taskId" @click="go('/system/flow-todo')">
              <span class="mini-title">{{ t.flowName }} · {{ t.nodeName }}</span>
              <span class="mini-sub">{{ fmt(t.createTime) }}</span>
            </li>
          </ul>
        </div>
      </ElCol>

      <ElCol :xs="24" :lg="8" class="mt-4 mt-lg-0">
        <div class="art-card list-card" v-loading="noticeLoading">
          <div class="card-head">
            <span class="card-title">
              {{ $t('pages.dashboard.console.notice') }}
              <ElBadge
                v-if="overview.noticeUnread"
                :value="overview.noticeUnread"
                class="unread-badge"
              />
            </span>
            <ElButton link type="primary" size="small" @click="go('/system/my-notice')">{{
              $t('pages.dashboard.console.viewAll')
            }}</ElButton>
          </div>
          <ElEmpty
            v-if="!noticeList.length"
            :description="$t('pages.dashboard.console.noNotice')"
            :image-size="60"
          />
          <ul v-else class="mini-list">
            <li v-for="n in noticeList" :key="n.id" @click="go('/system/my-notice')">
              <span class="mini-title">
                <ElTag v-if="n.isTop === 1" type="danger" size="small" class="top-tag">{{
                  $t('pages.dashboard.console.topTag')
                }}</ElTag>
                {{ n.title }}
              </span>
              <span class="mini-sub">{{ fmt(n.releaseTime || n.createTime) }}</span>
            </li>
          </ul>
        </div>
      </ElCol>

      <ElCol :xs="24" :lg="8" class="mt-4 mt-lg-0">
        <ArtTimelineListCard
          v-if="changelogList.length"
          :title="$t('pages.dashboard.console.changelog')"
          :subtitle="$t('pages.dashboard.console.changelogSubtitle')"
          :list="changelogList"
          :max-count="6"
        />
        <!-- ArtTimelineListCard 无内置空态，空列表时以同款标题卡兜底 -->
        <div v-else class="art-card list-card" v-loading="changelogLoading">
          <div class="card-head">
            <span class="card-title">{{ $t('pages.dashboard.console.changelog') }}</span>
          </div>
          <ElEmpty
            v-if="!changelogLoading"
            :description="$t('pages.dashboard.console.noChangelog')"
            :image-size="60"
          />
        </div>
      </ElCol>
    </ElRow>

    <!-- 可配置快捷入口 -->
    <div class="art-card p-5 mt-4">
      <div class="card-head">
        <span class="card-title">{{ $t('pages.dashboard.console.shortcuts') }}</span>
        <ElButton link type="primary" size="small" @click="openShortcutEditor">{{
          $t('pages.dashboard.console.edit')
        }}</ElButton>
      </div>
      <ElEmpty
        v-if="!shortcuts.length"
        :description="$t('pages.dashboard.console.shortcutsEmpty')"
        :image-size="60"
      />
      <div v-else class="quick-grid">
        <div v-for="q in shortcuts" :key="q.path" class="quick-item" @click="go(q.path)">
          <span class="quick-name">{{ q.name }}</span>
        </div>
      </div>
    </div>

    <!-- 快捷入口编辑弹窗 -->
    <ElDialog
      v-model="editorVisible"
      :title="$t('pages.dashboard.console.shortcutsDialogTitle')"
      width="560px"
      align-center
    >
      <p class="editor-tip">{{ $t('pages.dashboard.console.shortcutsDialogTip') }}</p>
      <ElCheckboxGroup v-model="selectedPaths" class="catalog-grid">
        <ElCheckbox v-for="c in CATALOG" :key="c.path" :value="c.path" :label="c.path">
          {{ c.name }}
        </ElCheckbox>
      </ElCheckboxGroup>
      <template #footer>
        <ElButton @click="editorVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="saveShortcuts">{{
          $t('pages.dashboard.console.save')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { echarts } from '@/plugins/echarts'
  import { ElMessage } from 'element-plus'
  import { fetchChangelogRecent } from '@/api/feedback'
  import { fetchFlowMyTodo, fetchMyNoticePage } from '@/api/system-manage'
  import {
    fetchWorkbenchOverview,
    fetchWorkbenchShortcuts,
    saveWorkbenchShortcuts
  } from '@/api/workbench'
  import { useSettingStore } from '@/store/modules/setting'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Console' })

  const { t } = useI18n()

  const router = useRouter()
  const go = (path: string) => router.push(path)
  const { isDark } = storeToRefs(useSettingStore())

  // ===== 快捷入口候选目录（真实路由，验证过 path）=====
  const CATALOG = computed(() => [
    { name: t('pages.dashboard.console.catalog.user'), path: '/system/user' },
    { name: t('pages.dashboard.console.catalog.role'), path: '/system/role' },
    { name: t('pages.dashboard.console.catalog.menu'), path: '/system/menu' },
    { name: t('pages.dashboard.console.catalog.dept'), path: '/system/dept' },
    { name: t('pages.dashboard.console.catalog.post'), path: '/system/post' },
    { name: t('pages.dashboard.console.catalog.dict'), path: '/system/dict' },
    { name: t('pages.dashboard.console.catalog.param'), path: '/system/param' },
    { name: t('pages.dashboard.console.catalog.tenant'), path: '/saas/tenant' },
    { name: t('pages.dashboard.console.catalog.notice'), path: '/system/notice' },
    { name: t('pages.dashboard.console.catalog.myNotice'), path: '/system/my-notice' },
    { name: t('pages.dashboard.console.catalog.codegen'), path: '/system/gen' },
    { name: t('pages.dashboard.console.catalog.job'), path: '/system/job' },
    { name: t('pages.dashboard.console.catalog.report'), path: '/system/report' },
    { name: t('pages.dashboard.console.catalog.flowTodo'), path: '/system/flow-todo' },
    { name: t('pages.dashboard.console.catalog.helpDoc'), path: '/system/help-doc' },
    { name: t('pages.dashboard.console.catalog.changelog'), path: '/system/changelog' }
  ])
  const DEFAULT_PATHS = [
    '/system/user',
    '/system/role',
    '/system/menu',
    '/system/dict',
    '/system/notice',
    '/system/changelog'
  ]

  const fmt = (t?: string) => (t || '').replace('T', ' ').slice(0, 16)

  // ===== 概览统计 =====
  const overview = reactive<any>({
    userCount: 0,
    deptCount: 0,
    roleCount: 0,
    todoCount: 0,
    noticeUnread: 0
  })
  const statTiles = computed(() => [
    {
      key: 'user',
      label: t('pages.dashboard.console.statUserCount'),
      count: overview.userCount,
      path: '/system/user',
      bg: 'var(--el-color-primary-light-9)',
      color: 'var(--el-color-primary)',
      icon: 'ri:user-3-line'
    },
    {
      key: 'dept',
      label: t('pages.dashboard.console.statDeptCount'),
      count: overview.deptCount,
      path: '/system/dept',
      bg: 'var(--el-color-success-light-9)',
      color: 'var(--el-color-success)',
      icon: 'ri:building-line'
    },
    {
      key: 'role',
      label: t('pages.dashboard.console.statRoleCount'),
      count: overview.roleCount,
      path: '/system/role',
      bg: 'var(--el-color-warning-light-9)',
      color: 'var(--el-color-warning)',
      icon: 'ri:key-2-line'
    },
    {
      key: 'todo',
      label: t('pages.dashboard.console.myTodo'),
      count: overview.todoCount,
      path: '/system/flow-todo',
      bg: 'var(--el-color-danger-light-9)',
      color: 'var(--el-color-danger)',
      icon: 'ri:file-list-3-line'
    }
  ])

  // ===== echarts =====
  const pieRef = ref<HTMLElement>()
  const barRef = ref<HTMLElement>()
  const pieEmpty = ref(false)
  const barEmpty = ref(false)
  /** 后端未下发 tenantUser（普通租户）时隐藏整卡，避免「暂无数据」误导 */
  const showTenantChart = ref(false)
  let pieChart: echarts.ECharts | null = null
  let barChart: echarts.ECharts | null = null
  // 缓存最近一次图表数据：主题切换时按明暗重建 option（track/funnel 同款）
  let pieData: any[] = []
  let barData: any[] = []
  const COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#9c6cff']

  const renderPie = (data: any[]) => {
    if (!pieRef.value) return
    pieChart = echarts.init(pieRef.value)
    pieChart.setOption({
      color: COLORS,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, textStyle: { color: isDark.value ? '#fff' : '#333' } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          data: data.map((d) => ({ name: d.name, value: Number(d.value) })),
          label: { formatter: '{b}\n{c}', color: isDark.value ? '#fff' : '#333' }
        }
      ]
    })
  }

  const renderBar = (data: any[]) => {
    if (!barRef.value) return
    barChart = echarts.init(barRef.value)
    barChart.setOption({
      color: COLORS,
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.name),
        axisLabel: { interval: 0, color: isDark.value ? '#fff' : '#333' }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: isDark.value ? '#fff' : '#333' }
      },
      series: [{ type: 'bar', barMaxWidth: 40, data: data.map((d) => Number(d.value)) }]
    })
  }

  const resize = () => {
    pieChart?.resize()
    barChart?.resize()
  }

  // ===== 各卡片数据 =====
  const todoList = ref<any[]>([])
  const todoLoading = ref(false)
  const noticeList = ref<any[]>([])
  const noticeLoading = ref(false)
  const changelogList = ref<any[]>([])
  const changelogLoading = ref(false)
  const overviewLoading = ref(false)

  const typeColor = (type: string) =>
    type === 'fix' ? '#f56c6c' : type === 'optimize' ? '#e6a23c' : '#409eff'

  const loadOverview = async () => {
    overviewLoading.value = true
    try {
      const d = (await fetchWorkbenchOverview()) || {}
      Object.assign(overview, {
        userCount: d.userCount ?? 0,
        deptCount: d.deptCount ?? 0,
        roleCount: d.roleCount ?? 0,
        todoCount: d.todoCount ?? 0,
        noticeUnread: d.noticeUnread ?? 0
      })
      pieData = d.charts?.userStatus || []
      // 键缺失=无权限看平台分布；键存在但空数组才走空态
      showTenantChart.value = Object.prototype.hasOwnProperty.call(d.charts || {}, 'tenantUser')
      barData = showTenantChart.value ? d.charts.tenantUser || [] : []
      pieEmpty.value = pieData.length === 0
      barEmpty.value = showTenantChart.value && barData.length === 0
      await nextTick()
      if (!pieEmpty.value) renderPie(pieData)
      if (showTenantChart.value && !barEmpty.value) renderBar(barData)
    } finally {
      overviewLoading.value = false
    }
  }

  // 主题切换重绘：echarts 默认文字色在暗色下不可读，按明暗重建 option
  watch(isDark, () => {
    if (pieData.length) renderPie(pieData)
    if (barData.length) renderBar(barData)
  })

  const loadTodo = async () => {
    todoLoading.value = true
    try {
      todoList.value = ((await fetchFlowMyTodo()) || []).slice(0, 6)
    } finally {
      todoLoading.value = false
    }
  }

  const loadNotice = async () => {
    noticeLoading.value = true
    try {
      const resp: any = await fetchMyNoticePage({ pageNum: 1, pageSize: 6 })
      noticeList.value = resp?.records ?? []
    } finally {
      noticeLoading.value = false
    }
  }

  const loadChangelog = async () => {
    changelogLoading.value = true
    try {
      const rows = (await fetchChangelogRecent(6)) || []
      changelogList.value = rows.map((r: any) => ({
        time: (r.publishTime || r.createTime || '').slice(0, 10),
        content: r.title,
        status: typeColor(r.type),
        code: r.version
      }))
    } finally {
      changelogLoading.value = false
    }
  }

  // ===== 快捷入口 =====
  const shortcuts = ref<Array<{ name: string; path: string }>>([])
  const editorVisible = ref(false)
  const selectedPaths = ref<string[]>([])
  const saving = ref(false)

  const loadShortcuts = async () => {
    const json = await fetchWorkbenchShortcuts()
    let paths: string[]
    if (json) {
      try {
        paths = (JSON.parse(json) as Array<{ path: string }>).map((s) => s.path)
      } catch {
        paths = DEFAULT_PATHS
      }
    } else {
      paths = DEFAULT_PATHS
    }
    applyShortcuts(paths)
  }

  // 按候选目录顺序过滤，剔除失效 path，保证名称与路由一致
  const applyShortcuts = (paths: string[]) => {
    shortcuts.value = CATALOG.value.filter((c) => paths.includes(c.path))
  }

  const openShortcutEditor = () => {
    selectedPaths.value = shortcuts.value.map((s) => s.path)
    editorVisible.value = true
  }

  const saveShortcuts = async () => {
    saving.value = true
    try {
      const list = CATALOG.value.filter((c) => selectedPaths.value.includes(c.path))
      await saveWorkbenchShortcuts(JSON.stringify(list))
      shortcuts.value = list
      editorVisible.value = false
      ElMessage.success(t('pages.dashboard.console.saveSuccess'))
    } finally {
      saving.value = false
    }
  }

  onMounted(() => {
    loadOverview()
    loadTodo()
    loadNotice()
    loadChangelog()
    loadShortcuts()
    window.addEventListener('resize', resize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', resize)
    pieChart?.dispose()
    barChart?.dispose()
  })
</script>

<style lang="scss" scoped>
  .console-page {
    .mt-4 {
      margin-top: 16px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 500;
    }

    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    // 统计瓦片
    .stat-tile {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 18px;
      cursor: pointer;
      transition: box-shadow 0.2s;

      &:hover {
        box-shadow: 0 4px 16px rgb(0 0 0 / 8%);
      }

      .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        font-size: 22px;
        border-radius: 12px;
      }

      .stat-count {
        font-size: 24px;
        font-weight: 600;
      }

      .stat-label {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }

    // 图表
    .chart-card {
      padding: 16px;

      .chart-box {
        width: 100%;
        height: 280px;
        margin-top: 8px;
      }
    }

    // 列表卡
    .list-card {
      min-height: 340px;
      padding: 16px;

      .unread-badge {
        margin-left: 6px;
      }

      .mini-list {
        li {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 4px;
          cursor: pointer;
          border-bottom: 1px solid var(--el-border-color-lighter);

          &:hover .mini-title {
            color: var(--el-color-primary);
          }
        }

        .mini-title {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 14px;
        }

        .mini-sub {
          font-size: 12px;
          color: var(--el-text-color-secondary);
        }

        .top-tag {
          flex-shrink: 0;
        }
      }
    }

    // 快捷入口
    .quick-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;

      @media (width <= 768px) {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .quick-item {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 8px;
      cursor: pointer;
      background: var(--el-fill-color-light);
      border-radius: 8px;
      transition: all 0.2s;

      &:hover {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }

      .quick-name {
        font-size: 14px;
      }
    }

    .editor-tip {
      margin-bottom: 14px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .catalog-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .mt-lg-0 {
      @media (width >= 992px) {
        margin-top: 0;
      }
    }
  }
</style>
