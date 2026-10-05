<!-- 我的消息：站内信收件箱，查看详情自动标已读 -->
<template>
  <div class="my-message-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('pages.system.message.searchPlaceholder')"
          style="width: 240px"
          @keyup.enter="search"
          @clear="search"
        />
        <ElSelect
          v-model="readFilter"
          clearable
          :placeholder="$t('pages.system.message.statusPlaceholder')"
          style="width: 140px"
          @change="search"
        >
          <ElOption :label="$t('pages.system.message.statusUnread')" :value="0" />
          <ElOption :label="$t('pages.system.message.statusRead')" :value="1" />
        </ElSelect>
        <ElButton type="primary" @click="search">{{ $t('pages.system.message.search') }}</ElButton>
        <ElButton @click="reset">{{ $t('pages.system.message.reset') }}</ElButton>
        <ElButton @click="readAll">{{ $t('pages.system.message.readAllBtn') }}</ElButton>
        <ElButton type="danger" plain @click="removeSelected">{{
          $t('pages.system.message.deleteSelected')
        }}</ElButton>
      </div>

      <ElTable
        v-loading="loading"
        :data="rows"
        @selection-change="(list: any[]) => (selected = list)"
      >
        <ElTableColumn type="selection" width="42" />
        <ElTableColumn prop="title" :label="$t('pages.system.message.colTitle')" min-width="220" />
        <ElTableColumn :label="$t('pages.system.message.colType')" width="90">
          <template #default="{ row }">{{ typeLabel(row.type) }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.message.colStatus')" width="90">
          <template #default="{ row }">
            <ElTag :type="row.isRead === 1 ? 'info' : 'danger'">
              {{
                row.isRead === 1
                  ? $t('pages.system.message.statusRead')
                  : $t('pages.system.message.statusUnread')
              }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.message.colSendTime')" min-width="170">
          <template #default="{ row }">{{ formatTableTime(row.sendTime) }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.message.colOperation')" width="140" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="view(row)">{{
              $t('pages.system.message.viewBtn')
            }}</ElButton>
            <ElButton link type="danger" @click="removeOne(row)">{{
              $t('pages.system.message.deleteBtn')
            }}</ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <span>{{
            keyword || readFilter === 0 || readFilter === 1
              ? $t('pages.system.message.emptySearch')
              : $t('pages.system.message.emptyList')
          }}</span>
        </template>
      </ElTable>

      <div class="pager">
        <ElPagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="load"
          @size-change="load"
        />
      </div>
    </ElCard>

    <ElDialog v-model="viewVisible" :title="current.title" width="560px" align-center>
      <div class="msg-meta">{{ formatTableTime(current.sendTime) }}</div>
      <div class="msg-content" v-safe-html="current.content"></div>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useMessageStore } from '@/store/modules/message'
  import {
    fetchMyMessagePage,
    fetchReadAllMessage,
    fetchReadMessage,
    fetchRemoveMyMessage
  } from '@/api/message'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Message' })

  const { t } = useI18n()
  const messageStore = useMessageStore()
  const viewVisible = ref(false)
  const current = reactive<any>({ title: '', content: '', sendTime: '' })
  const keyword = ref('')
  const readFilter = ref<number | undefined>(undefined)
  const rows = ref<any[]>([])
  const selected = ref<any[]>([])
  const loading = ref(false)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)

  const typeLabel = (type: string) => {
    if (type === 'system') return t('pages.system.message.typeSystem')
    if (type === 'notice') return t('pages.system.message.typeNotice')
    if (type === 'todo') return t('pages.system.message.typeTodo')
    return type
  }

  const load = async () => {
    loading.value = true
    try {
      const resp: any = await fetchMyMessagePage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: keyword.value.trim() || undefined,
        isRead: readFilter.value
      })
      rows.value = resp?.records ?? []
      total.value = resp?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  const search = () => {
    pageNum.value = 1
    load()
  }

  const reset = () => {
    keyword.value = ''
    readFilter.value = undefined
    search()
  }

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
    messageStore.refreshUnread()
    load()
  }

  const removeRows = async (list: any[]) => {
    await fetchRemoveMyMessage(list.map((row) => row.id))
    messageStore.refreshUnread()
    load()
  }

  const removeOne = (row: any) => {
    ElMessageBox.confirm(
      t('pages.system.message.deleteConfirm', { title: row.title || '' }),
      t('pages.system.message.deleteBtn'),
      { type: 'warning' }
    ).then(() => removeRows([row]))
  }

  const removeSelected = () => {
    if (!selected.value.length) {
      ElMessage.warning(t('pages.system.message.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.message.deleteBatchConfirm', { count: selected.value.length }),
      t('pages.system.message.deleteSelected'),
      { type: 'warning' }
    ).then(() => removeRows(selected.value))
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .msg-meta {
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .msg-content {
    max-height: 50vh;
    overflow-y: auto;
    line-height: 1.7;
  }
</style>
