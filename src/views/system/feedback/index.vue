<!-- 意见反馈：按内容查找，处理状态和删除会说明下一步 -->
<template>
  <div class="feedback-page art-full-height">
    <ElCard class="art-table-card">
      <div class="fb-body">
        <div class="fb-toolbar">
          <ElInput
            v-model="keyword"
            clearable
            class="fb-search"
            :placeholder="$t('pages.system.feedback.searchPlaceholder')"
            @keyup.enter="search"
          />
          <ElSelect
            v-model="status"
            clearable
            class="fb-status"
            :placeholder="$t('pages.system.feedback.colStatus')"
          >
            <ElOption :value="0" :label="$t('pages.system.feedback.statusPending')" />
            <ElOption :value="1" :label="$t('pages.system.feedback.statusHandled')" />
          </ElSelect>
          <ElButton type="primary" @click="search">{{
            $t('pages.system.feedback.search')
          }}</ElButton>
          <ElButton @click="resetSearch">{{ $t('pages.system.feedback.reset') }}</ElButton>
          <ElButton v-perm="'sys:feedback:manage'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.feedback.deleteSelected')
          }}</ElButton>
        </div>

        <div class="fb-table-wrap">
          <ElTable
            v-loading="loading"
            :data="tableData"
            border
            height="100%"
            :empty-text="emptyText"
            @selection-change="onSelectionChange"
          >
            <ElTableColumn type="selection" width="48" />
            <ElTableColumn
              prop="content"
              :label="$t('pages.system.feedback.colContent')"
              min-width="220"
              show-overflow-tooltip
            />
            <ElTableColumn
              prop="contact"
              :label="$t('pages.system.feedback.colContact')"
              width="140"
              show-overflow-tooltip
            />
            <ElTableColumn :label="$t('pages.system.feedback.colStatus')" width="100">
              <template #default="{ row }">
                <ElTag :type="row.status === 1 ? 'success' : 'warning'">
                  {{
                    row.status === 1
                      ? $t('pages.system.feedback.statusHandled')
                      : $t('pages.system.feedback.statusPending')
                  }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.feedback.colCreateTime')" width="170">
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.feedback.colOperation')" width="180">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:feedback:manage'"
                  link
                  type="primary"
                  @click="toggleStatus(row)"
                >
                  {{
                    row.status === 1
                      ? $t('pages.system.feedback.markPending')
                      : $t('pages.system.feedback.markHandled')
                  }}
                </ElButton>
                <ElButton
                  v-perm="'sys:feedback:manage'"
                  link
                  type="danger"
                  @click="deleteRow(row)"
                  >{{ $t('common.delete') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <div class="fb-pager">
          <ElPagination
            v-model:current-page="pageNum"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            background
            @current-change="loadData"
          />
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { formatTableTime } from '@/utils/date'
  import { fetchFeedbackPage, fetchFeedbackStatus, fetchRemoveFeedback } from '@/api/feedback'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Feedback' })

  const { t } = useI18n()
  const tableData = ref<any[]>([])
  const loading = ref(false)
  const keyword = ref('')
  const status = ref<number | undefined>()
  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)

  const emptyText = computed(() =>
    filtering.value ? t('pages.system.feedback.emptySearch') : t('pages.system.feedback.emptyList')
  )

  const loadData = async () => {
    loading.value = true
    try {
      const res = await fetchFeedbackPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: keyword.value.trim() || undefined,
        status: status.value === 0 || status.value === 1 ? status.value : undefined
      })
      tableData.value = res?.records || []
      total.value = res?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  const search = () => {
    filtering.value = !!keyword.value.trim() || status.value === 0 || status.value === 1
    pageNum.value = 1
    loadData()
  }

  const resetSearch = () => {
    keyword.value = ''
    status.value = undefined
    filtering.value = false
    pageNum.value = 1
    loadData()
  }

  const onSelectionChange = (rows: any[]) => {
    selectedRows.value = rows
  }

  const toggleStatus = async (row: any) => {
    await fetchFeedbackStatus(row.id)
    await loadData()
  }

  const deleteRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.feedback.removeConfirm', { content: row.content }),
      t('pages.system.feedback.removeTitle'),
      { type: 'warning' }
    )
    await fetchRemoveFeedback([row.id])
    await loadData()
  }

  const deleteSelected = async () => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.feedback.deleteEmpty'))
      return
    }
    await ElMessageBox.confirm(
      t('pages.system.feedback.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.feedback.removeTitle'),
      { type: 'warning' }
    )
    await fetchRemoveFeedback(selectedRows.value.map((row) => row.id))
    await loadData()
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .fb-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .fb-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .fb-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .fb-search {
    width: 220px;
  }

  .fb-status {
    width: 140px;
  }

  .fb-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
