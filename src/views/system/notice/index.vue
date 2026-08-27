<!-- 通知公告管理页面：CRUD + 可见范围 + 阅读记录/UV -->
<template>
  <div class="notice-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton v-perm="'sys:notice:manage'" @click="showDialog('add')" v-ripple>{{
            $t('pages.system.notice.addBtn')
          }}</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <NoticeDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :notice-data="currentData"
        :saving="dialogSaving"
        @submit="onDialogSubmit"
      />

      <ReadRecordDialog v-model:visible="readVisible" :notice="currentData" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, nextTick } from 'vue'
  import ArtDictTag from '@/components/core/base/art-dict-tag/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchNoticePage, fetchSaveNotice, fetchRemoveNotice } from '@/api/system-manage'
  import NoticeDialog from './modules/notice-dialog.vue'
  import ReadRecordDialog from './modules/read-record-dialog.vue'
  import { ElButton, ElTag, ElMessageBox, ElMessage } from 'element-plus'
  import { DICT_CODE } from '@/utils/constants'
  import { formatTableTime } from '@/utils/date'
  import { hasPerm } from '@/utils/permission'
  import { DialogType } from '@/types'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Notice' })

  const { t } = useI18n()

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const readVisible = ref(false)
  const currentData = ref<Record<string, any>>({})

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
      apiFn: fetchNoticePage,
      apiParams: { pageNum: 1, pageSize: 20 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.system.notice.colIndex') },
        { prop: 'title', label: t('pages.system.notice.colTitle'), minWidth: 200 },
        {
          prop: 'category',
          label: t('pages.system.notice.colCategory'),
          width: 100,
          // 字典运行时驱动：改用 ArtDictTag，不再手写 CATEGORY_MAP
          formatter: (row: any) =>
            h(ArtDictTag, { code: DICT_CODE.NOTICE_CATEGORY, value: row.category })
        },
        {
          prop: 'isTop',
          label: t('pages.system.notice.colTop'),
          width: 90,
          formatter: (row: any) =>
            row.isTop === 1
              ? h(ElTag, { type: 'danger' }, () => t('pages.system.notice.colTop'))
              : h(ElTag, { type: 'info' }, () => t('pages.system.notice.tagNormal'))
        },
        {
          prop: 'allVisible',
          label: t('pages.system.notice.colScope'),
          width: 100,
          formatter: (row: any) =>
            row.allVisible === 0
              ? h(ElTag, { type: 'warning' }, () => t('pages.system.notice.scopeCustom'))
              : h(ElTag, { type: 'success' }, () => t('pages.system.notice.scopeAll'))
        },
        { prop: 'viewUv', label: t('pages.system.notice.colViewUv'), width: 90 },
        { prop: 'viewPv', label: t('pages.system.notice.colViewPv'), width: 90 },
        {
          prop: 'releaseTime',
          label: t('pages.system.notice.colReleaseTime'),
          minWidth: 170,
          formatter: (row: any) => formatTableTime(row.releaseTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.notice.colOperation'),
          width: 180,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', [
              hasPerm('sys:notice:manage')
                ? h(
                    ElButton,
                    {
                      size: 'small',
                      link: true,
                      type: 'primary',
                      onClick: () => showDialog('edit', row)
                    },
                    () => t('common.edit')
                  )
                : null,
              hasPerm('sys:notice:manage')
                ? h(
                    ElButton,
                    { size: 'small', link: true, type: 'primary', onClick: () => showRead(row) },
                    () => t('pages.system.notice.readRecord')
                  )
                : null,
              hasPerm('sys:notice:manage')
                ? h(
                    ElButton,
                    {
                      size: 'small',
                      link: true,
                      type: 'danger',
                      onClick: () => deleteRow(row)
                    },
                    () => t('common.delete')
                  )
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
        size: resp?.pageSize ?? 20
      })
    }
  })

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const showRead = (row: Record<string, any>): void => {
    currentData.value = { ...row }
    nextTick(() => {
      readVisible.value = true
    })
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.notice.deleteConfirm', { name: row.title }),
      t('pages.system.notice.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveNotice(row.id)
      ElMessage.success(t('pages.system.notice.deleteSuccess'))
      refreshData()
    })
  }

  const onDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveNotice(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.notice.saveSuccess'))
      await refreshData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>
