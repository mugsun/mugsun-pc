<!-- 报表管理：多图表仪表盘设计 + echarts 预览（对接 /system/report） -->
<template>
  <div class="report-page art-full-height">
    <ElCard class="art-table-card">
      <div class="report-toolbar">
        <ElButton v-perm="'sys:report:save'" type="primary" @click="showDialog()">{{
          $t('pages.system.report.createReport')
        }}</ElButton>
      </div>

      <!-- 表格自由增长：包一层 flex:1 定高壳内部滚动，防矮视口裁切 -->
      <div class="report-table-wrap">
        <ElTable :data="tableData" border height="100%" v-loading="loading">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn
            prop="reportName"
            :label="$t('pages.system.report.reportName')"
            min-width="160"
          />
          <ElTableColumn :label="$t('pages.system.report.chartCount')" width="90">
            <template #default="{ row }">{{ chartCount(row) }}</template>
          </ElTableColumn>
          <ElTableColumn
            prop="remark"
            :label="$t('pages.system.report.remark')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.report.colOperation')" width="200" fixed="right">
            <template #default="{ row }">
              <ElButton link type="success" @click="preview(row)">{{
                $t('pages.system.report.preview')
              }}</ElButton>
              <ElButton v-perm="'sys:report:save'" link type="primary" @click="showDialog(row)">{{
                $t('pages.system.report.edit')
              }}</ElButton>
              <ElButton v-perm="'sys:report:remove'" link type="danger" @click="remove(row)">{{
                $t('pages.system.report.remove')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 设计（多图表仪表盘） -->
    <ElDialog
      v-model="dialogVisible"
      :title="
        form.id ? $t('pages.system.report.editReport') : $t('pages.system.report.createReport')
      "
      width="640px"
      align-center
      destroy-on-close
      class="report-design-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.report.reportName')" prop="reportName">
          <ElInput
            v-model="form.reportName"
            :placeholder="$t('pages.system.report.reportNamePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.report.charts')">
          <ElButton size="small" type="primary" @click="addChart">{{
            $t('pages.system.report.addChart')
          }}</ElButton>
        </ElFormItem>
        <div class="chart-list">
          <div v-for="(c, idx) in form.charts" :key="idx" class="chart-row">
            <ElInput
              v-model="c.title"
              size="small"
              :placeholder="$t('pages.system.report.chartTitlePlaceholder')"
              class="chart-title"
            />
            <ElSelect
              v-model="c.dataset"
              size="small"
              :placeholder="$t('pages.system.report.datasetPlaceholder')"
              class="chart-ds"
            >
              <ElOption v-for="d in datasets" :key="d.key" :label="d.label" :value="d.key" />
            </ElSelect>
            <ElSelect v-model="c.chartType" size="small" class="chart-type">
              <ElOption :label="$t('pages.system.report.chartBar')" value="bar" />
              <ElOption :label="$t('pages.system.report.chartPie')" value="pie" />
              <ElOption :label="$t('pages.system.report.chartLine')" value="line" />
            </ElSelect>
            <ElButton link type="danger" size="small" @click="removeChart(idx)">{{
              $t('pages.system.report.remove')
            }}</ElButton>
          </div>
        </div>
        <ElFormItem :label="$t('pages.system.report.remark')">
          <ElInput
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('pages.system.report.remark')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">{{
          $t('table.form.submit')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 预览（仪表盘：多图并列） -->
    <ElDialog
      v-model="previewVisible"
      :title="$t('pages.system.report.previewTitle', { name: previewName })"
      width="880px"
      align-center
      destroy-on-close
      class="report-preview-dialog"
      @closed="disposeCharts"
    >
      <div class="dashboard-grid">
        <div v-for="(c, idx) in previewCharts" :key="idx" class="dashboard-cell">
          <div class="dashboard-title">{{ c.title }}</div>
          <div :ref="(el) => (chartEls[idx] = el as HTMLElement)" class="dashboard-chart"></div>
        </div>
      </div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onDeactivated, nextTick } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { storeToRefs } from 'pinia'
  import { echarts } from '@/plugins/echarts'
  import { useSettingStore } from '@/store/modules/setting'
  import {
    fetchReportDatasets,
    fetchReportList,
    fetchSaveReport,
    fetchRemoveReport,
    fetchReportPreviewDataset
  } from '@/api/system-manage'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Report' })

  const { t } = useI18n()

  interface ChartCfg {
    title: string
    dataset: string
    chartType: string
  }

  const tableData = ref<any[]>([])
  const datasets = ref<any[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const previewVisible = ref(false)
  const previewName = ref('')
  const previewCharts = ref<ChartCfg[]>([])
  const chartEls = ref<Record<number, HTMLElement>>({})
  const formRef = ref<FormInstance>()
  let charts: echarts.ECharts[] = []
  const { isDark } = storeToRefs(useSettingStore())

  const form = reactive<{ id?: number; reportName: string; charts: ChartCfg[]; remark: string }>({
    id: undefined,
    reportName: '',
    charts: [],
    remark: ''
  })

  const rules: FormRules = {
    reportName: [
      { required: true, message: t('pages.system.report.reportNamePlaceholder'), trigger: 'blur' }
    ]
  }

  const parseCharts = (row: any): ChartCfg[] => {
    if (row.charts) {
      try {
        return JSON.parse(row.charts)
      } catch {
        /* fall through */
      }
    }
    // 兼容 G31 单图表报表
    if (row.reportKey) {
      return [{ title: row.reportName, dataset: row.reportKey, chartType: row.chartType || 'bar' }]
    }
    return []
  }

  const chartCount = (row: any): number => parseCharts(row).length

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      tableData.value = (await fetchReportList()) || []
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    datasets.value = (await fetchReportDatasets()) || []
    loadData()
  })

  const closeDialogs = (): void => {
    dialogVisible.value = false
    previewVisible.value = false
    disposeCharts()
  }

  const showDialog = (row?: any): void => {
    closeDialogs()
    formRef.value?.clearValidate()
    Object.assign(form, { id: undefined, reportName: '', charts: [], remark: '' })
    if (row) {
      form.id = row.id
      form.reportName = row.reportName
      form.remark = row.remark
      form.charts = parseCharts(row)
    }
    if (!form.charts.length) {
      form.charts = [
        {
          title: t('pages.system.report.chartN', { n: 1 }),
          dataset: datasets.value[0]?.key ?? '',
          chartType: 'bar'
        }
      ]
    }
    dialogVisible.value = true
  }

  const addChart = (): void => {
    form.charts.push({
      title: t('pages.system.report.chartN', { n: form.charts.length + 1 }),
      dataset: datasets.value[0]?.key ?? '',
      chartType: 'bar'
    })
  }

  const removeChart = (idx: number): void => {
    form.charts.splice(idx, 1)
  }

  const saving = ref(false)

  const submit = async (): Promise<void> => {
    if (!formRef.value || saving.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      if (!form.charts.length) {
        ElMessage.warning(t('pages.system.report.atLeastOneChart'))
        return
      }
      saving.value = true
      try {
        // 首图冗余存 reportKey/chartType 兼容旧预览接口
        await fetchSaveReport({
          id: form.id,
          reportName: form.reportName,
          reportKey: form.charts[0].dataset,
          chartType: form.charts[0].chartType,
          charts: JSON.stringify(form.charts),
          remark: form.remark
        })
        dialogVisible.value = false
        ElMessage.success(t('pages.system.report.saveSuccess'))
        loadData()
      } finally {
        saving.value = false
      }
    })
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.report.removeConfirm', { name: row.reportName }),
      t('pages.system.report.removeTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveReport(row.id)
      ElMessage.success(t('pages.system.report.removeSuccess'))
      loadData()
    })
  }

  const preview = async (row: any): Promise<void> => {
    dialogVisible.value = false
    previewName.value = row.reportName
    previewCharts.value = parseCharts(row)
    chartEls.value = {}
    previewVisible.value = true
    await nextTick()
    disposeCharts()
    for (let i = 0; i < previewCharts.value.length; i++) {
      const cfg = previewCharts.value[i]
      const el = chartEls.value[i]
      if (!el) continue
      const data = (await fetchReportPreviewDataset(cfg.dataset)) || []
      const chart = echarts.init(el)
      chart.setOption(buildOption(cfg.chartType, data))
      charts.push(chart)
    }
  }

  const buildOption = (type: string, data: any[]): any => {
    const items = data.map((d) => ({ name: d.name, value: Number(d.value) }))
    const textColor = isDark.value ? '#fff' : '#333'
    if (type === 'pie') {
      return {
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { color: textColor } },
        series: [{ type: 'pie', radius: '60%', data: items }]
      }
    }
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'category', data: items.map((i) => i.name), axisLabel: { color: textColor } },
      yAxis: { type: 'value', axisLabel: { color: textColor } },
      series: [{ type: type === 'line' ? 'line' : 'bar', data: items.map((i) => i.value) }]
    }
  }

  const disposeCharts = (): void => {
    charts.forEach((c) => c.dispose())
    charts = []
  }

  onDeactivated(closeDialogs)
</script>

<style scoped>
  .report-toolbar {
    margin-bottom: 12px;
  }

  .chart-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 12px 90px;
  }

  .chart-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .chart-title {
    width: 160px;
  }

  .chart-ds {
    width: 160px;
  }

  .chart-type {
    width: 110px;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .dashboard-cell {
    padding: 8px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
  }

  .dashboard-title {
    margin-bottom: 6px;
    font-weight: 600;
    text-align: center;
  }

  .dashboard-chart {
    width: 100%;
    height: 300px;
  }

  /* 表格自由增长：卡片体改 flex 列布局 + 表格壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .report-table-wrap {
    flex: 1;
    min-height: 0;
  }
</style>

<!-- 设计/预览弹窗内容 teleport 到 body，图表数不定：非 scoped 类限定滚动（同 track-app-dialog 范式），防矮视口截断 -->
<style>
  .report-design-dialog .el-dialog__body,
  .report-preview-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
