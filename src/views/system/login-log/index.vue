<!-- 登录日志页面（只读 + 账号解锁入口，含成功/失败） -->
<template>
  <div class="login-log-page art-full-height">
    <!-- 查询栏：账号/IP/状态，条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        border
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>
    </ElCard>

    <ElDialog
      v-model="detailVisible"
      :title="$t('pages.system.loginLog.detailTitle')"
      width="520px"
      align-center
    >
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.username')">{{
          detail.username
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.grantType')">{{
          grantLabel(detail.grantType)
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.client')">{{
          detail.device || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="IP">{{ detail.ip || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.location')">{{
          detail.loginLocation || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.browser')">{{
          detail.browser || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.os')">{{
          detail.os || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.result')">{{
          detail.status === 1
            ? $t('pages.system.loginLog.statusSuccess')
            : $t('pages.system.loginLog.statusFail')
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.msg')">{{
          detail.msg || '—'
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.loginTime')">{{
          formatTableTime(detail.loginTime)
        }}</ElDescriptionsItem>
        <ElDescriptionsItem :label="$t('pages.system.loginLog.userAgent')">{{
          detail.userAgent || $t('pages.system.loginLog.userAgentEmpty')
        }}</ElDescriptionsItem>
      </ElDescriptions>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, h, onDeactivated, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import ArtStatusTag from '@/components/core/base/art-status-tag/index.vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchLoginLogDetail, fetchLoginLogPage } from '@/api/system-manage'
  import { unlockLoginAccount } from '@/api/log'
  import { ElButton, ElMessageBox, ElMessage } from 'element-plus'
  import { DICT_CODE } from '@/utils/constants'
  import { hasPerm } from '@/utils/permission'
  import { formatTableTime } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'LoginLog' })

  const { t } = useI18n()
  const route = useRoute()
  const detailVisible = ref(false)
  const detail = ref<any>(null)

  function grantLabel(value?: string) {
    if (value === 'password') return t('pages.system.loginLog.grantPassword')
    if (value === 'sms') return t('pages.system.loginLog.grantSms')
    if (value === 'social') return t('pages.system.loginLog.grantSocial')
    if (value === 'refresh_token') return t('pages.system.loginLog.grantRefresh')
    return t('pages.system.loginLog.grantUnknown')
  }

  async function openDetail(row: any) {
    detail.value = await fetchLoginLogDetail(row.id)
    detailVisible.value = true
  }

  // ===== 查询栏 =====
  const searchForm = ref({
    username: '',
    ip: '',
    status: undefined as number | undefined,
    grantType: ''
  })
  const searchItems = computed(() => [
    {
      key: 'username',
      label: t('pages.system.loginLog.username'),
      type: 'input',
      props: { placeholder: t('pages.system.loginLog.usernamePlaceholder'), clearable: true }
    },
    {
      key: 'ip',
      label: 'IP',
      type: 'input',
      props: { placeholder: t('pages.system.loginLog.ipPlaceholder'), clearable: true }
    },
    {
      key: 'status',
      label: t('pages.system.loginLog.status'),
      type: 'select',
      props: {
        placeholder: t('pages.system.loginLog.statusPlaceholder'),
        clearable: true,
        options: [
          { label: t('pages.system.loginLog.statusSuccess'), value: 1 },
          { label: t('pages.system.loginLog.statusFail'), value: 0 }
        ]
      }
    },
    {
      key: 'grantType',
      label: t('pages.system.loginLog.grantType'),
      type: 'select',
      props: {
        placeholder: t('pages.system.loginLog.grantPlaceholder'),
        clearable: true,
        options: [
          { label: t('pages.system.loginLog.grantPassword'), value: 'password' },
          { label: t('pages.system.loginLog.grantSms'), value: 'sms' },
          { label: t('pages.system.loginLog.grantSocial'), value: 'social' },
          { label: t('pages.system.loginLog.grantRefresh'), value: 'refresh_token' }
        ]
      }
    }
  ])

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    fetchData,
    replaceSearchParams,
    resetSearchParams
  } = useTable({
    core: {
      apiFn: fetchLoginLogPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 后端分页参数为 pageNum/pageSize
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('table.column.index') },
        { prop: 'username', label: t('pages.system.loginLog.username'), minWidth: 72 },
        {
          prop: 'grantType',
          label: t('pages.system.loginLog.grantType'),
          width: 96,
          showOverflowTooltip: true,
          formatter: (row: any) => grantLabel(row.grantType)
        },
        {
          prop: 'device',
          label: t('pages.system.loginLog.client'),
          width: 84,
          showOverflowTooltip: true,
          formatter: (row: any) => row.device || '—'
        },
        { prop: 'ip', label: 'IP', minWidth: 78, showOverflowTooltip: true },
        {
          prop: 'loginLocation',
          label: t('pages.system.loginLog.location'),
          minWidth: 76,
          showOverflowTooltip: true,
          // ip2region 关闭/内网/未命中时为空，统一占位
          formatter: (row: any) => row.loginLocation || '-'
        },
        {
          prop: 'browser',
          label: t('pages.system.loginLog.browser'),
          minWidth: 68,
          showOverflowTooltip: true
        },
        {
          prop: 'os',
          label: t('pages.system.loginLog.os'),
          minWidth: 80,
          showOverflowTooltip: true
        },
        {
          prop: 'status',
          label: t('pages.system.loginLog.result'),
          width: 64,
          // 字典运行时驱动（login_result：1 成功 / 0 失败）
          formatter: (row: any) =>
            h(ArtStatusTag, { code: DICT_CODE.LOGIN_RESULT, value: row.status })
        },
        {
          prop: 'msg',
          label: t('pages.system.loginLog.msg'),
          minWidth: 64,
          showOverflowTooltip: true
        },
        {
          // 与操作列一并右固定：窄视口横向溢出时仍能看到完整时间
          prop: 'loginTime',
          label: t('pages.system.loginLog.loginTime'),
          width: 188,
          className: 'login-log-time',
          fixed: 'right',
          formatter: (row: any) => formatTableTime(row.loginTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.loginLog.colOperation'),
          width: 110,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', [
              h(
                ElButton,
                { link: true, type: 'primary', size: 'small', onClick: () => openDetail(row) },
                () => t('pages.system.loginLog.detail')
              ),
              hasPerm('sys:login-log:unlock') && row.locked
                ? h(
                    ElButton,
                    { link: true, type: 'warning', size: 'small', onClick: () => unlock(row) },
                    () => t('pages.system.loginLog.unlock')
                  )
                : null
            ])
        }
      ]
    },
    transform: {
      // 适配后端 mybatis-flex Page：records + totalRow
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 20
      })
    }
  })

  /** 解锁账号：清除该日志行 租户+账号 维度的登录失败锁定 */
  const unlock = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.loginLog.unlockConfirm', { username: row.username }),
      t('pages.system.loginLog.unlockTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await unlockLoginAccount(row.id)
        ElMessage.success(t('pages.system.loginLog.unlockSuccess'))
        // 解锁后刷新行级锁定标记（按钮随之隐藏）
        refreshData()
      })
      .catch(() => {})
  }

  onDeactivated(() => {
    ElMessageBox.close()
  })

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      username: '',
      ip: '',
      status: undefined,
      grantType: ''
    }
    resetSearchParams()
    await fetchData()
  }

  onMounted(async () => {
    const username = typeof route.query.username === 'string' ? route.query.username : ''
    if (!username) return
    searchForm.value.username = username
    replaceSearchParams({
      username,
      exact: route.query.exact === '1' ? true : undefined,
      pageNum: 1,
      pageSize: 20
    })
    await fetchData()
  })
</script>

<style scoped>
  :deep(.login-log-time .cell) {
    white-space: nowrap;
  }
</style>
