<!-- 错误问题单：按指纹沉淀的问题闭环（指派/解决/重开）+ release 新增/复发标记；
     列表/详情走 /api/system/track/error-issues*；组内事件仍用 /errors/detail。
     后端未合前 404 → 友好空态「后端未就绪」。不做 warm-flow。 -->
<template>
  <div class="track-error-issue-page art-full-height">
    <div class="track-toolbar">
      <ElSelect
        v-model="appKey"
        :loading="appsLoading"
        :placeholder="$t('pages.track.shared.appPlaceholder')"
        class="track-app-select"
      >
        <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
      </ElSelect>
      <ElInput
        v-model="release"
        clearable
        :placeholder="$t('pages.track.errorIssue.releasePlaceholder')"
        class="track-release-input"
      />
      <ElSelect
        v-model="statusFilter"
        clearable
        :placeholder="$t('pages.track.errorIssue.statusPlaceholder')"
        class="track-status-select"
      >
        <ElOption v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
      </ElSelect>
      <ElCheckbox v-model="regressedOnly">{{
        $t('pages.track.errorIssue.regressedOnly')
      }}</ElCheckbox>
      <ElButton type="primary" :loading="loading" @click="loadPage">{{
        $t('pages.track.shared.search')
      }}</ElButton>
    </div>

    <ElAlert
      v-if="backendMissing"
      type="info"
      show-icon
      :closable="false"
      class="track-backend-missing"
      :title="$t('pages.track.errorIssue.backendMissing')"
    />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>
    </ElCard>

    <!-- 问题单详情抽屉 -->
    <ElDrawer v-model="detailVisible" size="760px" :title="detailTitle" destroy-on-close>
      <div v-loading="detailLoading" class="track-issue-detail">
        <ElEmpty
          v-if="detailBackendMissing"
          :description="$t('pages.track.errorIssue.backendMissing')"
        />
        <template v-else-if="detail">
          <div class="track-detail-meta">
            <ElTag size="small" :type="errorIssueStatusTagType(detail.status)" effect="plain">
              {{ statusLabel(detail.status) }}
            </ElTag>
            <ElTag
              v-if="releaseFlagKey(detail.releaseFlag)"
              size="small"
              :type="errorIssueReleaseFlagTagType(detail.releaseFlag)"
              effect="plain"
            >
              {{ releaseFlagLabel(detail.releaseFlag) }}
            </ElTag>
            <ElTag size="small" type="danger" effect="plain">
              {{ $t('pages.track.error.fingerprint') }} {{ detail.fingerprint || '-' }}
            </ElTag>
          </div>

          <div class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.errorIssue.summary') }}</span>
            <span>{{ errorIssueSummary(detail) }}</span>
          </div>
          <div class="track-issue-kv">
            <span class="track-issue-k">Release</span>
            <span>
              {{ detail.firstRelease || '-' }}
              <template v-if="detail.lastRelease && detail.lastRelease !== detail.firstRelease">
                → {{ detail.lastRelease }}
              </template>
            </span>
          </div>
          <div class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.errorIssue.assignee') }}</span>
            <span>{{ detail.assigneeName || detail.assigneeId || '-' }}</span>
          </div>
          <div class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.shared.count') }}</span>
            <span>
              {{
                $t('pages.track.errorIssue.countLine', {
                  events: detail.eventCount ?? '-',
                  sessions: detail.sessionCount ?? '-',
                  users: detail.userCount ?? '-'
                })
              }}
            </span>
          </div>
          <div class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.shared.lastSeen') }}</span>
            <span>{{ fmtTrackTime(detail.lastSeenAt as any) }}</span>
          </div>
          <div v-if="detail.latestUrlPath || detail.latestRoutePath" class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.shared.page') }}</span>
            <span>
              {{ detail.latestUrlPath || '-'
              }}{{ $t('pages.track.error.routeSuffix', { route: detail.latestRoutePath || '-' }) }}
            </span>
          </div>
          <div v-if="detail.latestStack" class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.error.stack') }}</span>
            <pre class="track-issue-pre">{{ detail.latestStack }}</pre>
          </div>
          <div v-if="detail.recentReleases && detail.recentReleases.length" class="track-issue-kv">
            <span class="track-issue-k">{{ $t('pages.track.errorIssue.recentReleases') }}</span>
            <span>{{ detail.recentReleases.join(', ') }}</span>
          </div>

          <div class="track-issue-actions">
            <ElButton v-if="canEdit" type="primary" @click="openAssign">
              {{ $t('pages.track.errorIssue.assign') }}
            </ElButton>
            <ElButton
              v-if="canEdit && detail.status !== 'RESOLVED'"
              type="success"
              @click="doResolve"
            >
              {{ $t('pages.track.errorIssue.resolve') }}
            </ElButton>
            <ElButton v-if="canEdit && detail.status === 'RESOLVED'" @click="doReopen">
              {{ $t('pages.track.errorIssue.reopen') }}
            </ElButton>
            <ElButton
              v-if="canReplay && detail.latestSessionId"
              type="primary"
              link
              @click="openReplay(String(detail.latestSessionId))"
            >
              {{ $t('pages.track.errorIssue.openReplay') }}
            </ElButton>
            <ElTooltip
              v-else-if="canReplay"
              :content="$t('pages.track.errorIssue.noSession')"
              placement="top"
            >
              <span>
                <ElButton type="primary" link disabled>{{
                  $t('pages.track.errorIssue.openReplay')
                }}</ElButton>
              </span>
            </ElTooltip>
            <ElButton
              v-if="detail.latestUserId || detail.latestDistinctId"
              type="primary"
              link
              @click="goUser"
            >
              {{ $t('pages.track.errorIssue.openUser') }}
            </ElButton>
            <ElTooltip v-else :content="$t('pages.track.errorIssue.noUser')" placement="top">
              <span>
                <ElButton type="primary" link disabled>{{
                  $t('pages.track.errorIssue.openUser')
                }}</ElButton>
              </span>
            </ElTooltip>
          </div>

          <!-- 组内最近错误事件（现有 errors/detail） -->
          <div v-if="detail.fingerprint" class="track-issue-events">
            <p class="track-issue-events-title">{{ $t('pages.track.errorIssue.relatedEvents') }}</p>
            <ArtTable
              :loading="eventsLoading"
              :data="eventsData as any[]"
              :columns="eventsColumns"
              :pagination="eventsPagination"
              @pagination:size-change="handleEventsSizeChange"
              @pagination:current-change="handleEventsCurrentChange"
            >
            </ArtTable>
          </div>
        </template>
      </div>
    </ElDrawer>

    <!-- 指派对话框 -->
    <ElDialog
      v-model="assignVisible"
      :title="$t('pages.track.errorIssue.assignTitle')"
      width="420px"
      destroy-on-close
    >
      <ElSelect
        v-model="assignUserId"
        filterable
        remote
        clearable
        :remote-method="searchAssignees"
        :loading="assignSearching"
        :placeholder="$t('pages.track.errorIssue.assigneePlaceholder')"
        class="track-assign-select"
      >
        <ElOption v-for="u in assignOptions" :key="u.id" :label="u.label" :value="u.id" />
      </ElSelect>
      <p class="track-assign-hint">{{ $t('pages.track.errorIssue.assignClearHint') }}</p>
      <template #footer>
        <ElButton @click="assignVisible = false">{{
          $t('pages.track.errorIssue.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="assignSaving" @click="doAssign">{{
          $t('pages.track.errorIssue.confirmAssign')
        }}</ElButton>
      </template>
    </ElDialog>

    <ReplayPlayerDrawer v-model:visible="replayVisible" :session-id="replaySessionId" />
  </div>
</template>

<script setup lang="ts">
  import { computed, h, onDeactivated, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave, useRouter } from 'vue-router'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchAssignTrackErrorIssue,
    fetchReopenTrackErrorIssue,
    fetchResolveTrackErrorIssue,
    fetchTrackErrorDetail,
    fetchTrackErrorIssueDetail,
    fetchTrackErrorIssuePage
  } from '@/api/track'
  import { fetchUserPage } from '@/api/user'
  import { fmtTrackTime, useTrackApp } from '@/views/track/shared/useTrackApp'
  import ReplayPlayerDrawer from '@/views/track/shared/ReplayPlayerDrawer.vue'
  import { hasPerm } from '@/utils/permission'
  import { isHttpError } from '@/utils/http/error'
  import {
    errorIssueReleaseFlagKey,
    errorIssueReleaseFlagTagType,
    errorIssueStatusKey,
    errorIssueStatusTagType,
    errorIssueSummary,
    isErrorIssueBackendMissing,
    type ErrorIssueDetail,
    type ErrorIssueStatus
  } from '../../error-issue'
  import {
    ElAlert,
    ElButton,
    ElCheckbox,
    ElDialog,
    ElEmpty,
    ElInput,
    ElMessage,
    ElMessageBox,
    ElOption,
    ElSelect,
    ElTag,
    ElTooltip
  } from 'element-plus'

  defineOptions({ name: 'TrackErrorIssue' })

  const { t } = useI18n()
  const router = useRouter()

  const { appOptions, appKey, appsLoading } = useTrackApp()

  const release = ref('')
  const statusFilter = ref<ErrorIssueStatus | ''>('')
  const regressedOnly = ref(false)
  const backendMissing = ref(false)

  // 读：登录即可 / 复用 sys:track-error:list；写：sys:track-error-issue:edit（boot 种子未合前超管可测）
  const canEdit = computed(() => hasPerm('sys:track-error-issue:edit'))
  const canReplay = computed(() => hasPerm('sys:track-replay:view'))

  const statusOptions = computed(() =>
    (['OPEN', 'ASSIGNED', 'RESOLVED'] as ErrorIssueStatus[]).map((value) => ({
      value,
      label: t(`pages.track.errorIssue.status.${errorIssueStatusKey(value)}`)
    }))
  )

  const statusLabel = (status?: string | null): string =>
    t(`pages.track.errorIssue.status.${errorIssueStatusKey(status)}`)

  const releaseFlagKey = errorIssueReleaseFlagKey
  const releaseFlagLabel = (flag?: string | null): string => {
    const key = errorIssueReleaseFlagKey(flag)
    return key ? t(`pages.track.errorIssue.releaseFlag.${key}`) : ''
  }

  /** 包装列表 API：404 → 空列表 + backendMissing；其它错误仍抛出 */
  const fetchPage = async (params: Record<string, any>) => {
    try {
      const resp = await fetchTrackErrorIssuePage(params)
      backendMissing.value = false
      return resp
    } catch (err) {
      if (isErrorIssueBackendMissing(err) || (isHttpError(err) && err.code === 404)) {
        backendMissing.value = true
        return {
          records: [],
          totalRow: 0,
          pageNumber: params.pageNum ?? 1,
          pageSize: params.pageSize ?? 20
        }
      }
      backendMissing.value = false
      throw err
    }
  }

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
    replaceSearchParams
  } = useTable({
    core: {
      apiFn: fetchPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.track.shared.index') },
        {
          prop: 'summary',
          label: t('pages.track.errorIssue.summary'),
          minWidth: 220,
          showOverflowTooltip: true,
          formatter: (row: any) => errorIssueSummary(row)
        },
        {
          prop: 'status',
          label: t('pages.track.shared.status'),
          width: 100,
          formatter: (row: any) =>
            h(
              ElTag,
              { size: 'small', type: errorIssueStatusTagType(row.status), effect: 'plain' },
              () => statusLabel(row.status)
            )
        },
        {
          prop: 'releaseFlag',
          label: t('pages.track.errorIssue.releaseFlagLabel'),
          width: 100,
          formatter: (row: any) => {
            const key = errorIssueReleaseFlagKey(row.releaseFlag)
            if (!key) return row.regressed ? releaseFlagLabel('REGRESSED') : '-'
            return h(
              ElTag,
              {
                size: 'small',
                type: errorIssueReleaseFlagTagType(row.releaseFlag),
                effect: 'plain'
              },
              () => releaseFlagLabel(row.releaseFlag)
            )
          }
        },
        {
          prop: 'lastRelease',
          label: 'Release',
          width: 120,
          showOverflowTooltip: true,
          formatter: (row: any) => row.lastRelease || row.firstRelease || '-'
        },
        {
          prop: 'assigneeName',
          label: t('pages.track.errorIssue.assignee'),
          width: 120,
          showOverflowTooltip: true,
          formatter: (row: any) => row.assigneeName || row.assigneeId || '-'
        },
        {
          prop: 'lastSeenAt',
          label: t('pages.track.shared.lastSeen'),
          minWidth: 150,
          formatter: (row: any) => fmtTrackTime(row.lastSeenAt)
        },
        {
          prop: 'eventCount',
          label: t('pages.track.shared.count'),
          width: 90,
          align: 'right',
          headerAlign: 'right'
        },
        {
          prop: 'operation',
          label: t('pages.track.shared.operation'),
          width: 80,
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

  const loadPage = async (): Promise<void> => {
    if (!appKey.value) return
    replaceSearchParams({
      appKey: appKey.value,
      release: release.value.trim() || undefined,
      status: statusFilter.value || undefined,
      regressedOnly: regressedOnly.value || undefined,
      pageNum: 1,
      pageSize: 20
    })
    await fetchData()
  }

  watch(appKey, loadPage, { immediate: true })

  // ===== 详情 =====
  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const detailBackendMissing = ref(false)
  const detail = ref<ErrorIssueDetail | null>(null)
  const detailTitle = computed(() =>
    t('pages.track.errorIssue.detailTitle', {
      msg: detail.value ? errorIssueSummary(detail.value) : '-'
    })
  )

  const showDetail = async (row: Record<string, any>): Promise<void> => {
    if (row?.id === undefined || row?.id === null || row?.id === '') {
      ElMessage.warning(t('pages.track.errorIssue.needId'))
      return
    }
    detailVisible.value = true
    detailLoading.value = true
    detailBackendMissing.value = false
    detail.value = null
    try {
      const resp: any = await fetchTrackErrorIssueDetail({ id: row.id })
      detail.value = (resp ?? row) as ErrorIssueDetail
      if (detail.value?.fingerprint) {
        replaceEventsParams({
          appKey: appKey.value,
          fingerprint: detail.value.fingerprint,
          pageNum: 1,
          pageSize: 10
        })
        await fetchEventsData()
      }
    } catch (err) {
      if (isErrorIssueBackendMissing(err) || (isHttpError(err) && err.code === 404)) {
        detailBackendMissing.value = true
        // 列表行兜底展示，写操作仍会 404
        detail.value = row as ErrorIssueDetail
      } else {
        throw err
      }
    } finally {
      detailLoading.value = false
    }
  }

  // 组内事件（现有 errors/detail）
  const {
    columns: eventsColumns,
    data: eventsData,
    loading: eventsLoading,
    pagination: eventsPagination,
    handleSizeChange: handleEventsSizeChange,
    handleCurrentChange: handleEventsCurrentChange,
    fetchData: fetchEventsData,
    replaceSearchParams: replaceEventsParams
  } = useTable({
    core: {
      apiFn: fetchTrackErrorDetail,
      apiParams: { pageNum: 1, pageSize: 10 },
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        {
          prop: 'time',
          label: t('pages.track.shared.time'),
          width: 160,
          formatter: (row: any) => fmtTrackTime(row.time)
        },
        {
          prop: 'message',
          label: t('pages.track.error.message'),
          minWidth: 200,
          showOverflowTooltip: true
        },
        {
          prop: 'urlPath',
          label: t('pages.track.shared.page'),
          minWidth: 140,
          showOverflowTooltip: true
        },
        { prop: 'release', label: 'Release', width: 110, showOverflowTooltip: true }
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

  // ===== 指派 / 解决 / 重开 =====
  const assignVisible = ref(false)
  const assignUserId = ref<number | undefined>(undefined)
  const assignOptions = ref<Array<{ id: number; label: string }>>([])
  const assignSearching = ref(false)
  const assignSaving = ref(false)

  const openAssign = (): void => {
    assignUserId.value =
      detail.value?.assigneeId !== undefined && detail.value?.assigneeId !== null
        ? Number(detail.value.assigneeId)
        : undefined
    if (assignUserId.value && detail.value?.assigneeName) {
      assignOptions.value = [{ id: assignUserId.value, label: String(detail.value.assigneeName) }]
    }
    assignVisible.value = true
  }

  const searchAssignees = async (keyword: string): Promise<void> => {
    assignSearching.value = true
    try {
      const resp: any = await fetchUserPage({
        pageNum: 1,
        pageSize: 20,
        username: keyword || undefined
      })
      assignOptions.value = (resp?.records ?? []).map((u: any) => ({
        id: u.id,
        label: `${u.nickname || u.username} (@${u.username})`
      }))
    } finally {
      assignSearching.value = false
    }
  }

  const reloadDetail = async (): Promise<void> => {
    if (!detail.value?.id) return
    await showDetail({ id: detail.value.id })
    await loadPage()
  }

  const doAssign = async (): Promise<void> => {
    if (!detail.value?.id) return
    assignSaving.value = true
    try {
      await fetchAssignTrackErrorIssue({
        id: detail.value.id,
        assigneeId: assignUserId.value ?? null
      })
      assignVisible.value = false
      await reloadDetail()
    } catch (err) {
      if (isErrorIssueBackendMissing(err) || (isHttpError(err) && err.code === 404)) {
        ElMessage.warning(t('pages.track.errorIssue.backendMissing'))
        return
      }
      throw err
    } finally {
      assignSaving.value = false
    }
  }

  const doResolve = async (): Promise<void> => {
    if (!detail.value?.id) return
    try {
      await ElMessageBox.confirm(
        t('pages.track.errorIssue.resolveConfirm'),
        t('pages.track.errorIssue.resolve'),
        { type: 'warning' }
      )
    } catch {
      return
    }
    try {
      await fetchResolveTrackErrorIssue({ id: detail.value.id })
      await reloadDetail()
    } catch (err) {
      if (isErrorIssueBackendMissing(err) || (isHttpError(err) && err.code === 404)) {
        ElMessage.warning(t('pages.track.errorIssue.backendMissing'))
        return
      }
      throw err
    }
  }

  const doReopen = async (): Promise<void> => {
    if (!detail.value?.id) return
    try {
      await ElMessageBox.confirm(
        t('pages.track.errorIssue.reopenConfirm'),
        t('pages.track.errorIssue.reopen'),
        { type: 'warning' }
      )
    } catch {
      return
    }
    try {
      await fetchReopenTrackErrorIssue({ id: detail.value.id })
      await reloadDetail()
    } catch (err) {
      if (isErrorIssueBackendMissing(err) || (isHttpError(err) && err.code === 404)) {
        ElMessage.warning(t('pages.track.errorIssue.backendMissing'))
        return
      }
      throw err
    }
  }

  // ===== 回放 / 业务用户 =====
  const replayVisible = ref(false)
  const replaySessionId = ref('')

  const openReplay = (sessionId: string): void => {
    replaySessionId.value = sessionId
    replayVisible.value = true
  }

  const goUser = (): void => {
    const d = detail.value
    if (!d) return
    const query: Record<string, string> = {}
    if (d.latestUserId !== undefined && d.latestUserId !== null) {
      query.userId = String(d.latestUserId)
    } else if (d.latestDistinctId) {
      query.distinctId = String(d.latestDistinctId)
    } else {
      ElMessage.info(t('pages.track.errorIssue.noUser'))
      return
    }
    if (appKey.value) query.appKey = appKey.value
    router.push({ path: '/track/user', query })
  }

  const closeOverlays = (): void => {
    detailVisible.value = false
    replayVisible.value = false
    assignVisible.value = false
  }

  onDeactivated(closeOverlays)
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
</script>

<style lang="scss" scoped>
  .track-error-issue-page {
    .track-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;

      .track-app-select {
        width: 220px;
      }

      .track-release-input {
        width: 180px;
      }

      .track-status-select {
        width: 140px;
      }
    }

    .track-backend-missing {
      margin-bottom: 12px;
    }

    .track-detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }

    .track-issue-kv {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 13px;

      .track-issue-k {
        flex-shrink: 0;
        width: 72px;
        color: var(--el-text-color-secondary);
      }
    }

    .track-issue-pre {
      flex: 1;
      max-height: 200px;
      padding: 8px;
      margin: 0;
      overflow: auto;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      white-space: pre-wrap;
      background: var(--el-fill-color-light);
      border-radius: 6px;
    }

    .track-issue-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 16px 0;
    }

    .track-issue-events {
      margin-top: 8px;

      .track-issue-events-title {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 600;
      }
    }

    .track-assign-select {
      width: 100%;
    }

    .track-assign-hint {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
