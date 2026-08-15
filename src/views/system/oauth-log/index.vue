<!-- 开放接口调用日志（对接 /system/oauth-log） -->
<template>
  <div class="oauth-log-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 卡片体为定高裁剪（全局 overflow:hidden），内容须自备内部滚动，防矮视口裁切 -->
      <div class="oauth-log-scroll">
        <div class="oauth-log-toolbar">
          <ElSelect
            v-model="statusFilter"
            :placeholder="$t('pages.system.oauthLog.allStatus')"
            clearable
            style="width: 140px"
            @change="loadData"
          >
            <ElOption :label="$t('pages.system.oauthLog.pass')" :value="1" />
            <ElOption :label="$t('pages.system.oauthLog.deny')" :value="0" />
          </ElSelect>
          <ElButton type="primary" @click="loadData">{{
            $t('pages.system.oauthLog.refresh')
          }}</ElButton>
        </div>

        <ElTable :data="tableData" border v-loading="loading">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn prop="clientId" label="ClientId" min-width="170" />
          <ElTableColumn prop="apiPath" :label="$t('pages.system.oauthLog.api')" min-width="180" />
          <ElTableColumn
            prop="scope"
            :label="$t('pages.system.oauthLog.scopeRequired')"
            min-width="110"
          />
          <ElTableColumn :label="$t('pages.system.oauthLog.result')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'danger'">
                {{
                  row.status === 1
                    ? $t('pages.system.oauthLog.pass')
                    : $t('pages.system.oauthLog.deny')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="msg"
            :label="$t('pages.system.oauthLog.description')"
            min-width="180"
            show-overflow-tooltip
          />
          <ElTableColumn prop="ip" label="IP" width="130" />
          <ElTableColumn
            prop="createTime"
            :label="$t('pages.system.oauthLog.time')"
            width="170"
            fixed="right"
          >
            <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
          </ElTableColumn>
        </ElTable>

        <div class="oauth-log-pager">
          <ElPagination
            layout="total, prev, pager, next"
            :total="total"
            :page-size="pageSize"
            :current-page="pageNum"
            @current-change="onPage"
          />
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { fetchOauthLogPage } from '@/api/oauth'
  import { formatTableTime } from '@/utils/date'

  defineOptions({ name: 'OauthLog' })

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const total = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const statusFilter = ref<number | undefined>(undefined)

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const params: Record<string, any> = { pageNum: pageNum.value, pageSize: pageSize.value }
      if (statusFilter.value !== undefined && statusFilter.value !== null) {
        params.status = statusFilter.value
      }
      const resp = await fetchOauthLogPage(params)
      tableData.value = resp?.records ?? []
      total.value = resp?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  const onPage = (p: number): void => {
    pageNum.value = p
    loadData()
  }

  onMounted(loadData)
</script>

<style scoped>
  /* 卡片体为定高裁剪（全局 overflow:hidden），内容须自备内部滚动，防矮视口裁切 */
  .oauth-log-scroll {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
  }

  .oauth-log-toolbar {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .oauth-log-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
