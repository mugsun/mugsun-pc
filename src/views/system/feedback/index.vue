<!-- 意见反馈管理：查看用户反馈、附件、处理状态 -->
<template>
  <div class="feedback-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />
      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, onDeactivated } from 'vue'
  import { ElButton, ElMessage, ElMessageBox, ElTooltip } from 'element-plus'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictTag from '@/components/core/base/art-dict-tag/index.vue'
  import request from '@/utils/http'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchFeedbackPage, fetchFeedbackStatus, fetchRemoveFeedback } from '@/api/feedback'
  import { DICT_CODE } from '@/utils/constants'
  import { hasPerm } from '@/utils/permission'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Feedback' })

  const { t } = useI18n()

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
      apiFn: fetchFeedbackPage,
      apiParams: { pageNum: 1, pageSize: 10 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        {
          prop: 'content',
          label: t('pages.system.feedback.colContent'),
          minWidth: 260,
          showOverflowTooltip: true
        },
        {
          prop: 'contact',
          label: t('pages.system.feedback.colContact'),
          width: 150,
          showOverflowTooltip: true
        },
        {
          prop: 'attachName',
          label: t('pages.system.feedback.colAttach'),
          width: 160,
          // 附件名截断补省略号 + tooltip（link 按钮无内建省略，样式内联：scoped 够不到 h() 渲染的 vnode）
          formatter: (row: any) =>
            row.attachId
              ? h(
                  ElTooltip,
                  {
                    content: row.attachName || t('pages.system.feedback.downloadAttach'),
                    placement: 'top'
                  },
                  () =>
                    h(
                      ElButton,
                      {
                        link: true,
                        type: 'primary',
                        style:
                          'max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:middle',
                        onClick: () =>
                          request.download({
                            url: `/api/system/file/download-stream/${row.attachId}`
                          })
                      },
                      () => row.attachName || t('pages.system.feedback.downloadAttach')
                    )
                )
              : '—'
        },
        {
          prop: 'status',
          label: t('pages.system.feedback.colStatus'),
          width: 100,
          // 字典运行时驱动：改用 ArtDictTag，不再手写 已处理/未处理 判断
          formatter: (row: any) =>
            h(ArtDictTag, { code: DICT_CODE.FEEDBACK_STATUS, value: row.status })
        },
        {
          prop: 'createTime',
          label: t('pages.system.feedback.colCreateTime'),
          minWidth: 170,
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.feedback.colOperation'),
          width: 160,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', [
              hasPerm('sys:feedback:manage')
                ? h(
                    ElButton,
                    {
                      link: true,
                      type: 'primary',
                      size: 'small',
                      onClick: () => toggleStatus(row)
                    },
                    () =>
                      row.status === 1
                        ? t('pages.system.feedback.markPending')
                        : t('pages.system.feedback.markHandled')
                  )
                : null,
              hasPerm('sys:feedback:manage')
                ? h(ArtButtonTable, { type: 'delete', onClick: () => remove(row) })
                : null
            ])
        }
      ]
    },
    transform: {
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 10
      })
    }
  })

  const toggleStatus = async (row: any) => {
    await fetchFeedbackStatus(row.id)
    ElMessage.success(t('pages.system.feedback.opSuccess'))
    refreshData()
  }

  const remove = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.feedback.removeConfirm'),
      t('pages.system.feedback.removeTitle'),
      { type: 'warning' }
    )
      .then(async () => {
        await fetchRemoveFeedback([row.id])
        ElMessage.success(t('pages.system.feedback.removeSuccess'))
        refreshData()
      })
      .catch(() => {})
  }

  onDeactivated(() => {
    ElMessageBox.close()
  })
</script>
