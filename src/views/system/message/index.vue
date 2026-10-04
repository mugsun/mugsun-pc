<!-- 我的消息：站内信收件箱，查看详情自动标已读 -->
<template>
  <div class="my-message-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton @click="readAll" v-ripple>{{ $t('pages.system.message.readAllBtn') }}</ElButton>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDialog v-model="viewVisible" :title="current.title" width="560px">
      <div class="msg-meta">{{ formatTableTime(current.sendTime) }}</div>
      <div class="msg-content" v-safe-html="current.content"></div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h, reactive } from 'vue'
  import { ElButton, ElTag, ElMessage, ElMessageBox } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import { useMessageStore } from '@/store/modules/message'
  import {
    fetchMyMessagePage,
    fetchReadMessage,
    fetchReadAllMessage,
    fetchRemoveMyMessage
  } from '@/api/message'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Message' })

  const { t } = useI18n()

  const messageStore = useMessageStore()
  const viewVisible = ref(false)
  const current = reactive<any>({ title: '', content: '', sendTime: '' })

  const TYPE_LABEL: Record<string, string> = {
    system: t('pages.system.message.typeSystem'),
    notice: t('pages.system.message.typeNotice'),
    todo: t('pages.system.message.typeTodo')
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
      apiFn: fetchMyMessagePage,
      apiParams: { pageNum: 1, pageSize: 10 },
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { prop: 'title', label: t('pages.system.message.colTitle'), minWidth: 240 },
        {
          prop: 'type',
          label: t('pages.system.message.colType'),
          width: 90,
          formatter: (row: any) => TYPE_LABEL[row.type] || row.type
        },
        {
          prop: 'isRead',
          label: t('pages.system.message.colStatus'),
          width: 90,
          formatter: (row: any) =>
            h(ElTag, { type: row.isRead === 1 ? 'info' : 'danger' }, () =>
              row.isRead === 1
                ? t('pages.system.message.statusRead')
                : t('pages.system.message.statusUnread')
            )
        },
        {
          prop: 'sendTime',
          label: t('pages.system.message.colSendTime'),
          minWidth: 180,
          formatter: (row: any) => formatTableTime(row.sendTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.message.colOperation'),
          width: 140,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', [
              h(
                ElButton,
                { link: true, type: 'primary', size: 'small', onClick: () => view(row) },
                () => t('pages.system.message.viewBtn')
              ),
              h(
                ElButton,
                { link: true, type: 'danger', size: 'small', onClick: () => remove(row) },
                () => t('pages.system.message.deleteBtn')
              )
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

  // 查看详情：未读则标已读并刷新角标
  const view = async (row: any) => {
    Object.assign(current, { title: row.title, content: row.content, sendTime: row.sendTime })
    viewVisible.value = true
    if (row.isRead === 0) {
      await fetchReadMessage(row.messageId)
      row.isRead = 1
      messageStore.refreshUnread()
    }
  }

  const readAll = async () => {
    await fetchReadAllMessage()
    ElMessage.success(t('pages.system.message.readAllSuccess'))
    messageStore.refreshUnread()
    refreshData()
  }

  const remove = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.message.deleteConfirm'),
      t('pages.system.message.deleteBtn'),
      { type: 'warning' }
    ).then(async () => {
      await fetchRemoveMyMessage([row.id])
      ElMessage.success(t('pages.system.message.deleteSuccess'))
      messageStore.refreshUnread()
      refreshData()
    })
  }

  let seenMessage = false
  onActivated(() => {
    if (!seenMessage) {
      seenMessage = true
      return
    }
    refreshData()
  })
</script>

<style lang="scss" scoped>
  .msg-meta {
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .msg-content {
    // 消息内容可能很长：限高 + 内部滚动，防矮视口下弹窗整体挤出视口
    max-height: 60vh;
    overflow-y: auto;
    line-height: 1.7;
  }
</style>
