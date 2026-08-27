<!-- 数据变更记录：字段级 diff 时间轴 + 原始快照前后对比高亮 -->
<template>
  <div class="data-audit-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

      <ArtTable
        :loading="loading || detailLoading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <ElDialog
        v-model="detailVisible"
        :title="$t('pages.system.dataAudit.detailTitle')"
        width="820px"
        align-center
        destroy-on-close
      >
        <ElDescriptions :column="2" border size="small">
          <ElDescriptionsItem :label="$t('pages.system.dataAudit.bizObject')">{{
            bizLabel(current.bizTable)
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.dataAudit.bizId')">{{
            current.bizId
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.dataAudit.operator')">{{
            current.operator
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('pages.system.dataAudit.time')">{{
            formatTableTime(current.createTime)
          }}</ElDescriptionsItem>
        </ElDescriptions>

        <ElDivider content-position="left">{{
          $t('pages.system.dataAudit.fieldChanges')
        }}</ElDivider>
        <ElTimeline v-if="changes.length">
          <ElTimelineItem
            v-for="(c, i) in changes"
            :key="i"
            type="primary"
            :hollow="true"
            :timestamp="c.label"
            placement="top"
          >
            <div class="change-line">
              <span class="old">{{ c.old || $t('pages.system.dataAudit.emptyText') }}</span>
              <ArtSvgIcon class="arrow" icon="ri:arrow-right-line" />
              <span class="new">{{ c.new || $t('pages.system.dataAudit.emptyText') }}</span>
            </div>
          </ElTimelineItem>
        </ElTimeline>
        <ElEmpty
          v-else
          :description="$t('pages.system.dataAudit.noFieldChanges')"
          :image-size="60"
        />

        <ElDivider content-position="left">{{
          $t('pages.system.dataAudit.snapshotDiff')
        }}</ElDivider>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="diff-view" v-html="diffHtmlStr"></div>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, onDeactivated, ref } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchDataAuditPage, fetchDataAuditDetail } from '@/api/system-manage'
  import { formatTableTime } from '@/utils/date'
  import { ElTag } from 'element-plus'
  import { createTwoFilesPatch } from 'diff'
  import { html as renderDiff } from 'diff2html'
  import 'diff2html/bundles/css/diff2html.min.css'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'DataAudit' })

  const { t } = useI18n()

  interface FieldChange {
    label: string
    old: string
    new: string
  }

  const BIZ_LABEL_KEYS: Record<string, string> = { sys_user: 'pages.system.dataAudit.bizSysUser' }
  const bizLabel = (key: string): string => (BIZ_LABEL_KEYS[key] ? t(BIZ_LABEL_KEYS[key]) : key)

  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const current = ref<Record<string, any>>({})
  const changes = ref<FieldChange[]>([])
  const diffHtmlStr = ref('')

  const parseChanges = (raw: string): FieldChange[] => {
    if (!raw) return []
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }

  const buildDiff = (before: string, after: string): string => {
    const pretty = (s: string): string => {
      if (!s) return ''
      try {
        return JSON.stringify(JSON.parse(s), null, 2)
      } catch {
        return s
      }
    }
    const patch = createTwoFilesPatch(
      t('pages.system.dataAudit.before'),
      t('pages.system.dataAudit.after'),
      pretty(before),
      pretty(after),
      '',
      ''
    )
    return renderDiff(patch, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: 'side-by-side'
    })
  }

  const closeDetail = (): void => {
    detailVisible.value = false
    current.value = {}
    changes.value = []
    diffHtmlStr.value = ''
  }

  const showDetail = async (row: Record<string, any>): Promise<void> => {
    // 详情需二次请求快照，加载期间给表格遮罩反馈（失败提示由 http 拦截器统一弹出）
    detailLoading.value = true
    try {
      const res: any = await fetchDataAuditDetail({ id: row.id })
      const detail = res ?? row
      current.value = detail
      changes.value = parseChanges(detail.changeContent)
      diffHtmlStr.value = buildDiff(detail.beforeData, detail.afterData)
      detailVisible.value = true
    } finally {
      detailLoading.value = false
    }
  }

  const summary = (row: Record<string, any>): string => {
    const cs = parseChanges(row.changeContent)
    return cs.length ? cs.map((c) => c.label).join(t('pages.system.dataAudit.summarySep')) : '—'
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchDataAuditPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('table.column.index') },
        {
          prop: 'bizTable',
          label: t('pages.system.dataAudit.bizObject'),
          width: 120,
          formatter: (row: any) => h(ElTag, { type: 'info' }, () => bizLabel(row.bizTable))
        },
        { prop: 'bizId', label: t('pages.system.dataAudit.bizId'), minWidth: 170 },
        {
          prop: 'summary',
          label: t('pages.system.dataAudit.changedFields'),
          minWidth: 160,
          formatter: (row: any) => summary(row)
        },
        { prop: 'operator', label: t('pages.system.dataAudit.operator'), minWidth: 170 },
        {
          prop: 'createTime',
          label: t('pages.system.dataAudit.time'),
          minWidth: 180,
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.dataAudit.colOperation'),
          width: 90,
          fixed: 'right',
          formatter: (row: any) =>
            h(ArtButtonTable, { type: 'view', onClick: () => showDetail(row) })
        }
      ]
    },
    transform: {
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 20
      })
    }
  })

  onDeactivated(closeDetail)
</script>

<style scoped>
  .change-line {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .change-line .old {
    color: var(--el-color-danger);
    text-decoration: line-through;
  }

  .change-line .new {
    font-weight: 600;
    color: var(--el-color-success);
  }

  .change-line .arrow {
    color: var(--el-text-color-secondary);
  }

  .diff-view {
    max-height: 340px;
    overflow: auto;
  }
</style>
