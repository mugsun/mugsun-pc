<!-- 服务监控：关键指标卡片（数据源 /actuator/metrics，经 /api 代理，端点受 sys:monitor:list 鉴权）+ 在线数据库文档 -->
<template>
  <div class="monitor-page art-full-height">
    <ElCard class="art-table-card">
      <div class="monitor-toolbar">
        <span class="monitor-title">{{ $t('pages.system.monitor.title') }}</span>
        <div>
          <ElButton
            v-perm="'sys:monitor:db-doc'"
            :loading="docLoading"
            @click="openDbDoc"
            v-ripple
            >{{ $t('pages.system.monitor.dbDoc') }}</ElButton
          >
          <ElButton :loading="loading" @click="loadAll" v-ripple>{{
            $t('pages.system.monitor.refresh')
          }}</ElButton>
        </div>
      </div>

      <div class="monitor-grid" v-loading="loading">
        <ElEmpty
          v-if="!loading && cards.length === 0"
          class="monitor-empty"
          :description="$t('pages.system.monitor.emptyData')"
          :image-size="80"
        />
        <ElCard v-for="card in cards" :key="card.title" shadow="never" class="monitor-card">
          <div class="monitor-card-title">{{ card.title }}</div>
          <div class="monitor-card-value">{{ card.value }}</div>
          <ElProgress
            v-if="card.percent !== undefined"
            :percentage="card.percent"
            :stroke-width="8"
            :format="card.format"
            :status="card.percent > 90 ? 'exception' : undefined"
          />
          <div class="monitor-card-sub">{{ card.sub }}</div>
        </ElCard>
      </div>

      <ElDialog
        v-model="docVisible"
        :title="$t('pages.system.monitor.dbDoc')"
        width="820px"
        align-center
        destroy-on-close
        @closed="dbDoc = ''"
      >
        <div class="monitor-docbar">
          <ElButton size="small" type="primary" @click="downloadDoc" v-ripple>{{
            $t('pages.system.monitor.downloadMd')
          }}</ElButton>
        </div>
        <div class="monitor-doc">{{ dbDoc }}</div>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { onDeactivated, onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { fetchActuatorMetric, fetchDbDoc } from '@/api/system-manage'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'ServerMonitor' })

  const { t } = useI18n()

  interface MetricCard {
    title: string
    value: string
    sub: string
    percent?: number
    format?: (percentage: number) => string
  }

  /** 进度条标签与大字同口径：一位小数（默认取整标签与 0.1% 大字不一致） */
  const percentLabel = (p: number): string => `${p.toFixed(1)}%`

  const loading = ref(false)
  const cards = ref<MetricCard[]>([])

  const docVisible = ref(false)
  const docLoading = ref(false)
  const dbDoc = ref('')

  /** 指标 measurements 中取指定统计量（缺省第一个） */
  const measure = (metric: any, statistic?: string): number => {
    const list = metric?.measurements ?? []
    const hit = statistic ? list.find((m: any) => m.statistic === statistic) : list[0]
    return hit?.value ?? 0
  }

  const loadAll = async (): Promise<void> => {
    loading.value = true
    try {
      const [cpuCount, cpuUsage, memUsed, memMax, threads, uptime, httpReq] = await Promise.all([
        fetchActuatorMetric('system.cpu.count'),
        fetchActuatorMetric('process.cpu.usage'),
        fetchActuatorMetric('jvm.memory.used'),
        fetchActuatorMetric('jvm.memory.max'),
        fetchActuatorMetric('jvm.threads.live'),
        fetchActuatorMetric('process.uptime'),
        fetchActuatorMetric('http.server.requests')
      ])
      const used = measure(memUsed)
      const max = measure(memMax)
      const cpu = measure(cpuUsage)
      const uptimeSec = measure(uptime)
      const hours = Math.floor(uptimeSec / 3600)
      const minutes = Math.floor((uptimeSec % 3600) / 60)
      cards.value = [
        {
          title: t('pages.system.monitor.jvmMemory'),
          value: `${(used / 1048576).toFixed(0)} MB`,
          sub: t('pages.system.monitor.jvmMemoryMax', { max: (max / 1048576).toFixed(0) }),
          percent: max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
        },
        {
          title: t('pages.system.monitor.processCpu'),
          value: `${(cpu * 100).toFixed(1)}%`,
          sub: t('pages.system.monitor.cpuCores', { count: measure(cpuCount) }),
          percent: Math.min(100, Number((cpu * 100).toFixed(1))),
          format: percentLabel
        },
        {
          title: t('pages.system.monitor.jvmThreads'),
          value: String(measure(threads)),
          sub: t('pages.system.monitor.activeThreads')
        },
        {
          title: t('pages.system.monitor.uptime'),
          value: `${hours}h ${minutes}m`,
          sub: t('pages.system.monitor.uptimeSub')
        },
        {
          title: t('pages.system.monitor.httpRequests'),
          value: String(measure(httpReq, 'COUNT')),
          sub: t('pages.system.monitor.httpRequestsSub', {
            total: measure(httpReq, 'TOTAL_TIME').toFixed(1),
            max: measure(httpReq, 'MAX').toFixed(2)
          })
        }
      ]
    } catch {
      ElMessage.error(t('pages.system.monitor.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  const closeDocDialog = (): void => {
    docVisible.value = false
    dbDoc.value = ''
  }

  const openDbDoc = async (): Promise<void> => {
    docLoading.value = true
    try {
      dbDoc.value = (await fetchDbDoc()) ?? ''
      docVisible.value = true
    } finally {
      docLoading.value = false
    }
  }

  const downloadDoc = (): void => {
    const blob = new Blob([dbDoc.value], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${t('pages.system.monitor.dbDocFileName')}-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  onMounted(loadAll)
  onDeactivated(closeDocDialog)
</script>

<style scoped>
  /* 指标网格为自由增长内容：.art-table-card 定高 + .el-card__body 裁剪，
     网格须自备内部滚动，否则窄视口多行时底部卡片被切断不可达（范式同 track/user 时间线） */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .monitor-toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .monitor-title {
    font-size: 15px;
    font-weight: 500;
  }

  .monitor-grid {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    min-height: 0;
    overflow-y: auto;
  }

  .monitor-empty {
    grid-column: 1 / -1;
  }

  .monitor-card-title {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .monitor-card-value {
    margin: 8px 0;
    font-size: 24px;
    font-weight: 600;
  }

  .monitor-card-sub {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .monitor-docbar {
    margin-bottom: 12px;
    text-align: right;
  }

  .monitor-doc {
    max-height: 60vh;
    padding: 12px;
    overflow: auto;
    font-family: monospace;
    font-size: 12px;
    word-break: break-all;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
    border-radius: 6px;
  }
</style>
