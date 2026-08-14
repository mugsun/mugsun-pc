<!-- 在线会话管理：枚举当前所有在线终端（多端），支持强制下线 / 清理失效会话；会话落 Redis，重启不失效 -->
<template>
  <div class="online-page art-full-height">
    <ElCard class="art-table-card">
      <div class="online-toolbar">
        <span class="online-title">{{ $t('pages.system.online.pageTitle') }}</span>
        <div class="online-actions">
          <ElTag type="info" size="small" class="online-hint">{{
            $t('pages.system.online.redisHint')
          }}</ElTag>
          <ElButton
            v-if="staleCount > 0"
            v-perm="'sys:session:kickout'"
            type="warning"
            plain
            :loading="cleaning"
            @click="cleanupStale"
          >
            {{ $t('pages.system.online.cleanupStaleBtn', { count: staleCount }) }}
          </ElButton>
          <ElButton :loading="loading" @click="loadData">{{
            $t('pages.system.online.refreshBtn')
          }}</ElButton>
        </div>
      </div>

      <div class="online-table-scroll">
        <ElTable :data="tableData" border v-loading="loading">
          <ElTableColumn type="index" :label="$t('pages.system.online.colIndex')" width="60" />
          <ElTableColumn
            prop="username"
            :label="$t('pages.system.online.colUsername')"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span>{{ row.username }}</span>
              <ElTag v-if="row.stale" type="danger" size="small" class="stale-tag">{{
                $t('pages.system.online.staleTag')
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="nickname"
            :label="$t('pages.system.online.colNickname')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="deviceType"
            :label="$t('pages.system.online.colDevice')"
            width="100"
          />
          <ElTableColumn
            prop="ip"
            :label="$t('pages.system.online.colIp')"
            min-width="130"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="userAgent"
            :label="$t('pages.system.online.colUa')"
            min-width="220"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="tokenMask"
            :label="$t('pages.system.online.colToken')"
            min-width="160"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="loginTime"
            :label="$t('pages.system.online.colLoginTime')"
            min-width="180"
          >
            <template #default="{ row }">{{ formatTableTime(row.loginTime) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.online.colOperation')" width="120" fixed="right">
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:session:kickout'"
                link
                type="danger"
                size="small"
                @click="kickout(row)"
                >{{ $t('pages.system.online.kickoutBtn') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="online-count">
        {{ $t('pages.system.online.totalText', { count: tableData.length }) }}
        <template v-if="staleCount > 0">
          · {{ $t('pages.system.online.staleText', { count: staleCount }) }}
        </template>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { fetchOnlineList, fetchKickoutOnline, fetchCleanupStaleOnline } from '@/api/system-manage'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Online' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const cleaning = ref(false)

  const staleCount = computed(
    () => tableData.value.filter((r) => r.stale === true || r.stale === 1).length
  )

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      tableData.value = (await fetchOnlineList()) ?? []
    } finally {
      loading.value = false
    }
  }

  const displayName = (row: any): string =>
    row.stale ? String(row.loginId || row.username || '') : row.nickname || row.username || ''

  const kickout = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.online.kickoutConfirm', { name: displayName(row) }),
      t('pages.system.online.kickoutBtn'),
      { type: 'warning' }
    ).then(async () => {
      await fetchKickoutOnline({
        loginId: row.loginId,
        deviceType: row.deviceType,
        tokenMask: row.tokenMask
      })
      ElMessage.success(t('pages.system.online.kickoutSuccess'))
      loadData()
    })
  }

  const cleanupStale = (): void => {
    ElMessageBox.confirm(
      t('pages.system.online.cleanupStaleConfirm', { count: staleCount.value }),
      t('pages.system.online.cleanupStaleTitle'),
      { type: 'warning' }
    ).then(async () => {
      cleaning.value = true
      try {
        const n = (await fetchCleanupStaleOnline()) ?? 0
        ElMessage.success(t('pages.system.online.cleanupStaleSuccess', { count: n }))
        await loadData()
      } finally {
        cleaning.value = false
      }
    })
  }

  onMounted(loadData)
</script>

<style scoped>
  /* 在线终端列表无分页、行数无上限：.art-table-card 定高 + .el-card__body 裁剪下
     表格须自备内部滚动，否则矮视口/多会话时底部行被切断不可达（范式同 monitor/track-user） */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .online-toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .online-title {
    font-size: 15px;
    font-weight: 500;
  }

  .online-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .online-hint {
    margin-right: 4px;
  }

  .stale-tag {
    margin-left: 6px;
    vertical-align: middle;
  }

  .online-table-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .online-count {
    flex-shrink: 0;
    margin-top: 12px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    text-align: right;
  }
</style>
