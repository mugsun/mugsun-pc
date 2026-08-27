<!-- 埋点应用：应用 CRUD（appKey 复制 + 新增成功展示接入片段）+ 事件定义/符号表/圈选规则（G104）管理 tab -->
<template>
  <div class="track-app-page art-full-height">
    <ElCard class="art-table-card">
      <ElTabs v-model="tab">
        <!-- ===== 应用管理 ===== -->
        <ElTabPane :label="$t('pages.track.app.tabApp')" name="app">
          <div class="track-app-toolbar">
            <ElButton v-perm="'sys:track-app:add'" @click="showDialog('add')" v-ripple>
              {{ $t('pages.track.app.addApp') }}
            </ElButton>
          </div>

          <ArtTable
            :loading="loading"
            :data="data as any[]"
            :columns="columns"
            :pagination="pagination"
            @pagination:size-change="handleSizeChange"
            @pagination:current-change="handleCurrentChange"
          >
          </ArtTable>
        </ElTabPane>

        <!-- ===== 事件定义 ===== -->
        <ElTabPane :label="$t('pages.track.app.tabEventDef')" name="eventDef" lazy>
          <div class="track-app-toolbar">
            <ElSelect
              v-model="appKey"
              :loading="appsLoading"
              :placeholder="$t('pages.track.shared.appPlaceholder')"
              class="track-app-select"
            >
              <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
            </ElSelect>
            <ElInput
              v-model="defEventName"
              :placeholder="$t('pages.track.shared.eventFilterPlaceholder')"
              clearable
              class="track-def-input"
              @keyup.enter="loadDefs"
              @clear="loadDefs"
            />
            <ElSelect
              v-model="defStatus"
              :placeholder="$t('pages.track.shared.status')"
              clearable
              class="track-def-status"
            >
              <ElOption :label="$t('pages.track.shared.enabled')" :value="1" />
              <ElOption :label="$t('pages.track.shared.disabled')" :value="0" />
            </ElSelect>
            <ElButton @click="loadDefs" v-ripple>{{ $t('pages.track.shared.search') }}</ElButton>
          </div>

          <ArtTable
            :loading="defLoading"
            :data="defData as any[]"
            :columns="defColumns"
            :pagination="defPagination"
            @pagination:size-change="handleDefSizeChange"
            @pagination:current-change="handleDefCurrentChange"
          >
          </ArtTable>
        </ElTabPane>
        <!-- ===== 符号表（sourcemap） ===== -->
        <ElTabPane :label="$t('pages.track.app.tabSourcemap')" name="sourcemap" lazy>
          <div class="track-app-toolbar">
            <ElSelect
              v-model="appKey"
              :loading="appsLoading"
              :placeholder="$t('pages.track.shared.appPlaceholder')"
              class="track-app-select"
            >
              <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
            </ElSelect>
            <ElInput
              v-model="smRelease"
              :placeholder="$t('pages.track.app.releaseFilterPlaceholder')"
              clearable
              class="track-sm-release"
              @keyup.enter="loadSourcemaps"
              @clear="loadSourcemaps"
            />
            <ElButton @click="loadSourcemaps" v-ripple>{{
              $t('pages.track.shared.search')
            }}</ElButton>
            <ElButton
              v-perm="'sys:track-app:edit'"
              type="primary"
              @click="smUploadVisible = true"
              v-ripple
            >
              {{ $t('pages.track.app.uploadSourcemap') }}
            </ElButton>
          </div>

          <ArtTable
            :loading="smLoading"
            :data="smData as any[]"
            :columns="smColumns"
            :pagination="smPagination"
            @pagination:size-change="handleSmSizeChange"
            @pagination:current-change="handleSmCurrentChange"
          >
          </ArtTable>
        </ElTabPane>

        <!-- ===== 圈选规则（G104 可视化埋点） ===== -->
        <ElTabPane :label="$t('pages.track.app.tabVisual')" name="visual" lazy>
          <div class="track-app-toolbar">
            <ElSelect
              v-model="appKey"
              :loading="appsLoading"
              :placeholder="$t('pages.track.shared.appPlaceholder')"
              class="track-app-select"
            >
              <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
            </ElSelect>
            <ElButton v-perm="'sys:track-visual:edit'" type="primary" @click="enterVisual" v-ripple>
              <ArtSvgIcon icon="ri:crosshair-2-line" class="track-visual-enter-icon" />{{
                $t('pages.track.app.enterVisual')
              }}
            </ElButton>
            <ElSelect
              v-model="vrStatus"
              :placeholder="$t('pages.track.shared.status')"
              class="track-def-status"
            >
              <ElOption :label="$t('pages.track.shared.all')" value="" />
              <ElOption :label="$t('pages.track.shared.enabled')" :value="1" />
              <ElOption :label="$t('pages.track.shared.disabled')" :value="0" />
            </ElSelect>
            <ElButton @click="loadVisualRules" v-ripple>{{
              $t('pages.track.shared.search')
            }}</ElButton>
            <span class="track-visual-hint">{{ $t('pages.track.app.visualHint') }}</span>
          </div>

          <!-- 圈选草稿条：令牌有效期内常驻，3s 轮询草稿；令牌仅存内存，刷新即失效 -->
          <ElAlert
            v-if="visualToken"
            type="info"
            show-icon
            :closable="false"
            class="track-visual-bar"
          >
            <template #title>
              <span class="track-visual-bar-text">
                {{ $t('pages.track.app.visualBarText', { min: visualRemainMin }) }}
              </span>
              <ElButton size="small" class="track-visual-bar-end" @click="endVisual">
                {{ $t('pages.track.app.endVisual') }}
              </ElButton>
            </template>
          </ElAlert>

          <!-- 草稿列表：有草稿才显示 -->
          <div v-if="visualDrafts.length" class="track-visual-drafts">
            <div v-for="d in visualDrafts" :key="d.draftId" class="track-visual-draft">
              <ElTag size="small" effect="plain" class="track-visual-draft-name">
                {{ d.eventName || $t('pages.track.app.unnamed') }}
              </ElTag>
              <ElTooltip :content="d.selector" placement="top">
                <span class="track-visual-draft-selector">{{ d.selector }}</span>
              </ElTooltip>
              <span class="track-visual-draft-text">{{ d.matchText || '-' }}</span>
              <span class="track-visual-draft-route">{{ d.routePath || d.urlPath || '-' }}</span>
              <span class="track-visual-draft-time">
                {{ fmtTrackTimeAuto(d.ts ?? d.createTime) }}
              </span>
              <span class="track-visual-draft-ops">
                <ElButton
                  v-perm="'sys:track-visual:edit'"
                  link
                  type="primary"
                  size="small"
                  @click="confirmDraft(d)"
                >
                  {{ $t('pages.track.app.confirmDraft') }}
                </ElButton>
                <ElButton
                  v-perm="'sys:track-visual:edit'"
                  link
                  type="danger"
                  size="small"
                  @click="discardDraft(d)"
                >
                  {{ $t('pages.track.app.discardDraft') }}
                </ElButton>
              </span>
            </div>
          </div>

          <ArtTable
            :loading="vrLoading"
            :data="vrData as any[]"
            :columns="vrColumns"
            :pagination="vrPagination"
            @pagination:size-change="handleVrSizeChange"
            @pagination:current-change="handleVrCurrentChange"
          >
          </ArtTable>
        </ElTabPane>
      </ElTabs>

      <AppDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :app-data="currentRow"
        @submit="onSubmitApp"
      />

      <EventDefDialog
        v-model:visible="defDialogVisible"
        :def-data="currentDef"
        @submit="onSubmitDef"
      />

      <SourcemapUploadDialog
        v-model:visible="smUploadVisible"
        :app-key="appKey"
        @submit="onSubmitSourcemap"
      />

      <VisualRuleDialog
        v-model:visible="vrDialogVisible"
        :rule-data="currentRule"
        @submit="onSubmitRule"
      />

      <!-- 新增成功：展示 appKey + 接入代码片段 -->
      <ElDialog
        v-model="createdVisible"
        :title="$t('pages.track.app.createdTitle')"
        width="560px"
        align-center
        destroy-on-close
      >
        <ElAlert
          type="success"
          :closable="false"
          show-icon
          :title="$t('pages.track.app.createdTip')"
        />
        <div class="track-created-appkey">
          <span class="track-created-value">{{ createdApp.appKey }}</span>
          <ElButton size="small" @click="copyAppKey(createdApp.appKey)">{{
            $t('pages.track.shared.copy')
          }}</ElButton>
        </div>
        <p class="track-created-tip">{{ $t('pages.track.app.snippetLabel') }}</p>
        <pre class="track-created-snippet">{{ createdSnippet }}</pre>
        <template #footer>
          <ElButton type="primary" @click="createdVisible = false">{{
            $t('pages.track.app.gotIt')
          }}</ElButton>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, onActivated, onDeactivated, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useCrud } from '@/hooks/core/useCrud'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchRemoveTrackApp,
    fetchRemoveTrackSourcemap,
    fetchRemoveTrackVisualRule,
    fetchSaveTrackApp,
    fetchSaveTrackEventDef,
    fetchSaveTrackVisualRule,
    fetchTrackAppPage,
    fetchTrackEventDefPage,
    fetchTrackSourcemapPage,
    fetchTrackVisualConfirm,
    fetchTrackVisualDiscard,
    fetchTrackVisualDrafts,
    fetchTrackVisualRulePage,
    fetchTrackVisualToken,
    fetchUploadTrackSourcemap
  } from '@/api/track'
  import { fmtTrackSize, fmtTrackTimeAuto, useTrackApp } from '@/views/track/shared/useTrackApp'
  import { hasPerm } from '@/utils/permission'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import AppDialog from './modules/app-dialog.vue'
  import EventDefDialog from './modules/event-def-dialog.vue'
  import SourcemapUploadDialog from './modules/sourcemap-upload-dialog.vue'
  import VisualRuleDialog from './modules/visual-rule-dialog.vue'
  import {
    ElAlert,
    ElButton,
    ElInput,
    ElMessage,
    ElMessageBox,
    ElOption,
    ElSelect,
    ElSwitch,
    ElTag,
    ElTooltip
  } from 'element-plus'

  defineOptions({ name: 'TrackApp' })

  const { t } = useI18n()

  const tab = ref('app')
  // legacy: true 兜底非安全上下文（http 内网）下 navigator.clipboard 不可用
  const { copy } = useClipboard({ legacy: true })

  const copyAppKey = async (appKey: string): Promise<void> => {
    if (!appKey) return
    try {
      await copy(appKey)
      ElMessage.success(t('pages.track.app.copySuccess'))
    } catch {
      ElMessage.error(t('pages.track.app.copyFailed'))
    }
  }

  // ===== 应用 CRUD（列表/弹窗/删除由 useCrud 收敛；提交自处理以拿到新增返回的完整实体） =====
  const enabledTag = (v: any) =>
    v === 1 || v === true
      ? h(ElTag, { type: 'success' }, () => t('pages.track.shared.enabled'))
      : h(ElTag, { type: 'info' }, () => t('pages.track.shared.disabled'))

  const {
    columns,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    dialogVisible,
    dialogType,
    currentRow,
    showDialog,
    handleDelete,
    refreshCreate,
    refreshUpdate
  } = useCrud({
    listApi: fetchTrackAppPage,
    removeApi: fetchRemoveTrackApp,
    label: t('pages.track.app.entity'),
    rowName: (row) => row.appName,
    columnsFactory: () => [
      { type: 'index', width: 60, label: t('pages.track.shared.index') },
      {
        prop: 'appName',
        label: t('pages.track.app.appName'),
        minWidth: 120,
        showOverflowTooltip: true
      },
      {
        prop: 'appKey',
        label: 'AppKey',
        minWidth: 230,
        formatter: (row: any) =>
          h('div', { class: 'track-appkey-cell' }, [
            h(
              ElTooltip,
              { content: row.appKey, placement: 'top' },
              { default: () => h('span', { class: 'track-appkey-value' }, row.appKey) }
            ),
            h(
              ElButton,
              { link: true, type: 'primary', size: 'small', onClick: () => copyAppKey(row.appKey) },
              () => t('pages.track.shared.copy')
            )
          ])
      },
      { prop: 'platform', label: t('pages.track.app.platform'), width: 80 },
      {
        prop: 'sampleRate',
        label: t('pages.track.app.sampleRate'),
        width: 90,
        // 后端 sample_rate 为百分比整数（1..100，100=全量）
        formatter: (row: any) => `${row.sampleRate ?? 100}%`
      },
      {
        prop: 'enabled',
        label: t('pages.track.shared.status'),
        width: 90,
        formatter: (row: any) => enabledTag(row.enabled)
      },
      {
        prop: 'retentionDays',
        label: t('pages.track.app.retentionDays'),
        width: 90,
        formatter: (row: any) =>
          t('pages.track.app.retentionDaysValue', { days: row.retentionDays ?? '-' })
      },
      {
        prop: 'replayEnabled',
        label: t('pages.track.shared.replay'),
        width: 90,
        formatter: (row: any) => enabledTag(row.replayEnabled)
      },
      {
        prop: 'createTime',
        label: t('pages.track.shared.createTime'),
        minWidth: 170,
        formatter: (row: any) => fmtTrackTimeAuto(row.createTime)
      },
      {
        prop: 'operation',
        label: t('pages.track.shared.operation'),
        width: 130,
        fixed: 'right',
        // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
        formatter: (row: any) =>
          h('div', [
            hasPerm('sys:track-app:edit')
              ? h(ArtButtonTable, { type: 'edit', onClick: () => showDialog('edit', row) })
              : null,
            hasPerm('sys:track-app:edit')
              ? h(ArtButtonTable, {
                  type: 'delete',
                  onClick: () => {
                    Promise.resolve(handleDelete(row)).catch(() => {
                      /* cancel */
                    })
                  }
                })
              : null
          ])
      }
    ]
  })

  // ===== 新增成功展示 appKey + 接入片段 =====
  const createdVisible = ref(false)
  const createdApp = ref<Record<string, any>>({})
  const createdSnippet = computed(
    () => `import { createTracker } from '@mugsun/track-web'

const track = createTracker({
  endpoint: 'https://your-server.com', // collect = {endpoint}/track/collect
  appKey: '${createdApp.value.appKey}',
  release: '1.0.0'
})`
  )

  // ===== 事件定义 tab（共享应用选择器，模块级单例） =====
  const { appOptions, appKey, appsLoading, loadApps } = useTrackApp()

  const onSubmitApp = async (form: Record<string, any>): Promise<void> => {
    const saved = await fetchSaveTrackApp(form)
    dialogVisible.value = false
    ElMessage.success(t('pages.track.shared.saveSuccess'))
    if (dialogType.value === 'add') {
      await refreshCreate()
      // 同步共享应用下拉，事件定义 tab 立即可选新应用
      loadApps()
      if (saved?.appKey) {
        createdApp.value = saved
        createdVisible.value = true
      }
    } else {
      await refreshUpdate()
    }
  }

  const defEventName = ref('')
  const defStatus = ref<number | undefined>(undefined)
  const defDialogVisible = ref(false)
  const currentDef = ref<Record<string, any>>({})

  const {
    columns: defColumns,
    data: defData,
    loading: defLoading,
    pagination: defPagination,
    handleSizeChange: handleDefSizeChange,
    handleCurrentChange: handleDefCurrentChange,
    fetchData: fetchDefs,
    replaceSearchParams: replaceDefParams
  } = useTable({
    core: {
      apiFn: fetchTrackEventDefPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 首载等切到该 tab 且 appKey 就绪后手动触发
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.track.shared.index') },
        {
          prop: 'eventName',
          label: t('pages.track.shared.eventName'),
          minWidth: 160,
          showOverflowTooltip: true
        },
        {
          prop: 'displayName',
          label: t('pages.track.app.displayName'),
          minWidth: 140,
          showOverflowTooltip: true
        },
        {
          prop: 'description',
          label: t('pages.track.app.description'),
          minWidth: 180,
          showOverflowTooltip: true
        },
        {
          prop: 'owner',
          label: t('pages.track.app.owner'),
          width: 110,
          formatter: (row: any) => row.owner || '-'
        },
        {
          prop: 'status',
          label: t('pages.track.shared.status'),
          width: 90,
          formatter: (row: any) => enabledTag(row.status)
        },
        {
          prop: 'firstSeenTime',
          label: t('pages.track.app.firstReport'),
          minWidth: 150,
          formatter: (row: any) => fmtTrackTimeAuto(row.firstSeenTime)
        },
        {
          prop: 'lastSeenTime',
          label: t('pages.track.app.lastReport'),
          minWidth: 150,
          formatter: (row: any) => fmtTrackTimeAuto(row.lastSeenTime)
        },
        {
          prop: 'operation',
          label: t('pages.track.shared.operation'),
          width: 80,
          fixed: 'right',
          formatter: (row: any) =>
            hasPerm('sys:track-app:edit')
              ? h(ArtButtonTable, { type: 'edit', onClick: () => showDefDialog(row) })
              : null
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

  const loadDefs = async (): Promise<void> => {
    if (tab.value !== 'eventDef' || !appKey.value) return
    const params: Record<string, any> = {
      appKey: appKey.value,
      pageNum: 1,
      pageSize: 20
    }
    if (defEventName.value) params.eventName = defEventName.value
    if (defStatus.value !== undefined) params.status = defStatus.value
    replaceDefParams(params)
    await fetchDefs()
  }

  // 切到事件定义 tab / 应用变化时加载（首载在 appKey 就绪后触发）
  watch([tab, appKey], loadDefs, { immediate: true })

  const showDefDialog = (row: Record<string, any>): void => {
    currentDef.value = { ...row }
    defDialogVisible.value = true
  }

  const onSubmitDef = async (form: Record<string, any>): Promise<void> => {
    // 仅 displayName/description/owner/status 可改（后端契约）
    await fetchSaveTrackEventDef({
      id: form.id,
      displayName: form.displayName,
      description: form.description,
      owner: form.owner,
      status: form.status
    })
    defDialogVisible.value = false
    ElMessage.success(t('pages.track.shared.saveSuccess'))
    await fetchDefs()
  }

  // ===== 符号表 tab（G101）：按共享选中应用过滤 + release 精确筛；上传/删除走应用编辑权限码 =====
  const smRelease = ref('')
  const smUploadVisible = ref(false)

  const {
    columns: smColumns,
    data: smData,
    loading: smLoading,
    pagination: smPagination,
    handleSizeChange: handleSmSizeChange,
    handleCurrentChange: handleSmCurrentChange,
    fetchData: fetchSourcemaps,
    replaceSearchParams: replaceSmParams
  } = useTable({
    core: {
      apiFn: fetchTrackSourcemapPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 首载等切到该 tab 且 appKey 就绪后手动触发
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.track.shared.index') },
        { prop: 'release', label: 'Release', minWidth: 130, showOverflowTooltip: true },
        {
          prop: 'filename',
          label: t('pages.track.app.filename'),
          minWidth: 220,
          showOverflowTooltip: true
        },
        {
          prop: 'sizeBytes',
          label: t('pages.track.shared.size'),
          width: 100,
          align: 'right',
          headerAlign: 'right',
          formatter: (row: any) => fmtTrackSize(row.sizeBytes)
        },
        {
          prop: 'createTime',
          label: t('pages.track.app.uploadTime'),
          minWidth: 150,
          formatter: (row: any) => fmtTrackTimeAuto(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.track.shared.operation'),
          width: 80,
          fixed: 'right',
          formatter: (row: any) =>
            hasPerm('sys:track-app:edit')
              ? h(ArtButtonTable, { type: 'delete', onClick: () => handleSmDelete(row) })
              : null
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

  const loadSourcemaps = async (): Promise<void> => {
    if (tab.value !== 'sourcemap' || !appKey.value) return
    const params: Record<string, any> = { appKey: appKey.value, pageNum: 1, pageSize: 20 }
    if (smRelease.value) params.release = smRelease.value
    replaceSmParams(params)
    await fetchSourcemaps()
  }

  // 切到符号表 tab / 应用变化时加载（首载在 appKey 就绪后触发）
  watch([tab, appKey], loadSourcemaps, { immediate: true })

  const onSubmitSourcemap = async (payload: { release: string; file: File }): Promise<void> => {
    const form = new FormData()
    form.append('file', payload.file)
    form.append('appKey', appKey.value)
    form.append('release', payload.release)
    await fetchUploadTrackSourcemap(form)
    smUploadVisible.value = false
    ElMessage.success(t('pages.track.app.uploadSuccess'))
    await fetchSourcemaps()
  }

  const handleSmDelete = async (row: Record<string, any>): Promise<void> => {
    try {
      await ElMessageBox.confirm(
        t('pages.track.app.deleteSourcemapConfirm', {
          filename: row.filename,
          release: row.release
        }),
        t('pages.track.shared.deleteConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('pages.track.shared.del'),
          cancelButtonText: t('common.cancel')
        }
      )
    } catch {
      return
    }
    await fetchRemoveTrackSourcemap(row.id)
    ElMessage.success(t('pages.track.shared.deletedSuccess'))
    await fetchSourcemaps()
  }

  // ===== 圈选规则 tab（G104）：进入圈选 → 令牌内 3s 轮询草稿 → 确认/丢弃；规则表 CRUD =====
  // 与后端 CUSTOM_EVENT_NAME 同正则（$ 前缀必拒，最长 64 位）
  const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
  const vrStatus = ref<number | ''>('')
  const vrDialogVisible = ref(false)
  const currentRule = ref<Record<string, any>>({})

  /** 圈选令牌（仅组件内存：刷新即失效，与 Redis 短时令牌语义一致，草稿条文案已注明） */
  const visualToken = ref('')
  /** 令牌到期时刻（epoch ms）：到期/手动结束即停轮询并清草稿条 */
  const visualExpireAt = ref(0)
  const visualRemainMin = ref(0)
  const visualDrafts = ref<Array<Record<string, any>>>([])

  const syncRemainMin = (): void => {
    visualRemainMin.value = Math.max(0, Math.ceil((visualExpireAt.value - Date.now()) / 60000))
  }

  const pollDrafts = async (): Promise<void> => {
    if (!visualToken.value) return
    if (Date.now() >= visualExpireAt.value) {
      endVisual()
      ElMessage.info(t('pages.track.app.tokenExpired'))
      return
    }
    syncRemainMin()
    try {
      visualDrafts.value = (await fetchTrackVisualDrafts({ token: visualToken.value })) ?? []
    } catch {
      /* 轮询失败静默（showErrorMessage 已关），下一周期重试 */
    }
  }

  const { pause: pauseDraftPoll, resume: resumeDraftPoll } = useIntervalFn(pollDrafts, 3000, {
    immediate: false
  })

  const enterVisual = async (): Promise<void> => {
    if (!appKey.value) {
      ElMessage.warning(t('pages.track.app.selectAppFirst'))
      return
    }
    let targetUrl: string
    try {
      const { value } = await ElMessageBox.prompt(
        t('pages.track.app.visualPromptMsg'),
        t('pages.track.app.enterVisual'),
        {
          confirmButtonText: t('pages.track.app.enter'),
          cancelButtonText: t('common.cancel'),
          inputValue: window.location.origin,
          inputPattern: /^https?:\/\/.+/,
          inputErrorMessage: t('pages.track.app.invalidUrl')
        }
      )
      targetUrl = value
    } catch {
      return // 用户取消
    }
    const resp: any = await fetchTrackVisualToken({ appKey: appKey.value, targetUrl })
    if (!resp?.token) return
    window.open(resp.url, '_blank')
    visualToken.value = resp.token
    visualExpireAt.value = Date.now() + (resp.expireSeconds ?? 1800) * 1000
    visualDrafts.value = []
    syncRemainMin()
    pollDrafts()
    resumeDraftPoll()
  }

  /** 结束圈选（手动按钮或到期）：停轮询 + 清草稿条 */
  const endVisual = (): void => {
    pauseDraftPoll()
    visualToken.value = ''
    visualExpireAt.value = 0
    visualDrafts.value = []
  }

  const confirmDraft = async (draft: Record<string, any>): Promise<void> => {
    let eventName: string
    try {
      const { value } = await ElMessageBox.prompt(
        t('pages.track.app.confirmDraftMsg'),
        t('pages.track.app.confirmDraftTitle'),
        {
          confirmButtonText: t('pages.track.app.confirmDraft'),
          cancelButtonText: t('common.cancel'),
          inputValue: draft.eventName,
          inputValidator: (v: string) => {
            if (!EVENT_NAME_PATTERN.test(v ?? '')) {
              ElMessage.error(t('pages.track.app.eventNameInvalid'))
              return false
            }
            return true
          }
        }
      )
      eventName = value
    } catch {
      return // 用户取消
    }
    await fetchTrackVisualConfirm({ token: visualToken.value, draftId: draft.draftId, eventName })
    visualDrafts.value = visualDrafts.value.filter((d) => d.draftId !== draft.draftId)
    ElMessage.success(t('pages.track.app.draftConfirmed'))
    await refreshVisualRules()
  }

  const discardDraft = async (draft: Record<string, any>): Promise<void> => {
    try {
      await ElMessageBox.confirm(
        t('pages.track.app.discardConfirm', {
          name: draft.eventName || t('pages.track.app.unnamed')
        }),
        t('pages.track.app.discardConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('pages.track.app.discardDraft'),
          cancelButtonText: t('common.cancel')
        }
      )
    } catch {
      return
    }
    await fetchTrackVisualDiscard({ token: visualToken.value, draftId: draft.draftId })
    visualDrafts.value = visualDrafts.value.filter((d) => d.draftId !== draft.draftId)
    ElMessage.success(t('pages.track.app.discarded'))
  }

  const {
    columns: vrColumns,
    data: vrData,
    loading: vrLoading,
    pagination: vrPagination,
    handleSizeChange: handleVrSizeChange,
    handleCurrentChange: handleVrCurrentChange,
    fetchData: fetchVisualRules,
    refreshData: refreshVisualRules,
    replaceSearchParams: replaceVrParams
  } = useTable({
    core: {
      apiFn: fetchTrackVisualRulePage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 首载等切到该 tab 且 appKey 就绪后手动触发
      immediate: false,
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.track.shared.index') },
        {
          prop: 'eventName',
          label: t('pages.track.shared.eventName'),
          minWidth: 140,
          showOverflowTooltip: true
        },
        {
          prop: 'selector',
          label: t('pages.track.app.selector'),
          minWidth: 220,
          // 代码体 + 省略 + 悬浮全量；样式走 :deep()（formatter 产物不带本页 scopeId）
          formatter: (row: any) =>
            h(
              ElTooltip,
              { content: row.selector, placement: 'top' },
              { default: () => h('span', { class: 'track-visual-selector-cell' }, row.selector) }
            )
        },
        {
          prop: 'routePath',
          label: t('pages.track.app.route'),
          minWidth: 130,
          showOverflowTooltip: true,
          formatter: (row: any) => row.routePath || t('pages.track.app.allSite')
        },
        {
          prop: 'matchText',
          label: t('pages.track.app.matchText'),
          minWidth: 120,
          showOverflowTooltip: true,
          formatter: (row: any) => row.matchText || t('pages.track.app.noLimit')
        },
        {
          prop: 'status',
          label: t('pages.track.shared.status'),
          width: 90,
          formatter: (row: any) =>
            hasPerm('sys:track-visual:edit')
              ? h(ElSwitch, {
                  modelValue: row.status,
                  activeValue: 1,
                  inactiveValue: 0,
                  onChange: (v: string | number | boolean) => toggleRuleStatus(row, Number(v))
                })
              : enabledTag(row.status)
        },
        {
          prop: 'createTime',
          label: t('pages.track.shared.createTime'),
          minWidth: 150,
          formatter: (row: any) => fmtTrackTimeAuto(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.track.shared.operation'),
          width: 130,
          fixed: 'right',
          // 操作列由 h() 渲染（指令够不到），用 hasPerm() 函数按真实权限码门控
          formatter: (row: any) =>
            h('div', [
              hasPerm('sys:track-visual:edit')
                ? h(ArtButtonTable, { type: 'edit', onClick: () => showRuleDialog(row) })
                : null,
              hasPerm('sys:track-visual:edit')
                ? h(ArtButtonTable, { type: 'delete', onClick: () => handleRuleDelete(row) })
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

  const loadVisualRules = async (): Promise<void> => {
    if (tab.value !== 'visual' || !appKey.value) return
    const params: Record<string, any> = { appKey: appKey.value, pageNum: 1, pageSize: 20 }
    if (vrStatus.value !== '') params.status = vrStatus.value
    replaceVrParams(params)
    await fetchVisualRules()
  }

  // 切到圈选规则 tab / 应用变化时加载（首载在 appKey 就绪后触发）
  watch([tab, appKey], loadVisualRules, { immediate: true })

  /** 状态开关：整行提交（后端契约 eventName/routePath/matchText/status 可改，selector 只读） */
  const toggleRuleStatus = async (row: Record<string, any>, status: number): Promise<void> => {
    try {
      await fetchSaveTrackVisualRule({
        id: row.id,
        eventName: row.eventName,
        routePath: row.routePath,
        matchText: row.matchText,
        status
      })
      row.status = status
      ElMessage.success(
        status === 1 ? t('pages.track.app.enabledMsg') : t('pages.track.app.disabledMsg')
      )
    } catch {
      // 开关为受控渲染（不绑 update:modelValue），失败刷新整表对齐服务端
      await refreshVisualRules()
    }
  }

  const showRuleDialog = (row: Record<string, any>): void => {
    currentRule.value = { ...row }
    vrDialogVisible.value = true
  }

  const onSubmitRule = async (form: Record<string, any>): Promise<void> => {
    await fetchSaveTrackVisualRule({
      id: form.id,
      eventName: form.eventName,
      routePath: form.routePath,
      matchText: form.matchText,
      status: form.status
    })
    vrDialogVisible.value = false
    ElMessage.success(t('pages.track.shared.saveSuccess'))
    await refreshVisualRules()
  }

  const handleRuleDelete = async (row: Record<string, any>): Promise<void> => {
    try {
      await ElMessageBox.confirm(
        t('pages.track.app.deleteRuleConfirm', { name: row.eventName }),
        t('pages.track.shared.deleteConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('pages.track.shared.del'),
          cancelButtonText: t('common.cancel')
        }
      )
    } catch {
      return
    }
    await fetchRemoveTrackVisualRule(row.id)
    ElMessage.success(t('pages.track.shared.deletedSuccess'))
    await refreshVisualRules()
  }

  const closeOverlays = (): void => {
    dialogVisible.value = false
    defDialogVisible.value = false
    smUploadVisible.value = false
    vrDialogVisible.value = false
    createdVisible.value = false
    ElMessageBox.close()
  }

  onDeactivated(() => {
    pauseDraftPoll()
    closeOverlays()
  })
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
  onActivated(() => {
    if (visualToken.value) resumeDraftPoll()
  })
</script>

<style lang="scss" scoped>
  .track-app-page {
    // 视口偏矮时事件定义等 tab 的表格+分页超出卡片分得高度，被全局
    // .art-table-card .el-card__body 的 overflow:hidden 横切：卡片改自然高度 + 页面级纵向滚动
    overflow-y: auto;

    > .art-table-card {
      flex: none;
    }

    .track-app-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;

      .track-app-select {
        width: 220px;
      }

      .track-def-input {
        width: 240px;
      }

      .track-def-status {
        width: 120px;
      }

      .track-sm-release {
        width: 200px;
      }
    }

    // 表格单元格由 ArtTable 渲染（h() 产物不带本页 scopeId），formatter 定制样式须走 :deep()
    :deep(.track-appkey-cell) {
      display: flex;
      gap: 8px;
      align-items: center;

      .track-appkey-value {
        // min-width:0 让 flex 子元素可收缩，省略号才生效
        min-width: 0;
        overflow: hidden;
        font-family: monospace;
        font-size: 13px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .track-visual-enter-icon {
      margin-right: 4px;
    }

    .track-visual-hint {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .track-visual-bar {
      margin-bottom: 12px;

      .track-visual-bar-end {
        margin-left: 12px;
      }
    }

    .track-visual-drafts {
      padding: 4px 12px;
      margin-bottom: 12px;
      background: var(--el-fill-color-lighter);
      border-radius: 6px;

      .track-visual-draft {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        font-size: 13px;

        & + .track-visual-draft {
          border-top: 1px dashed var(--el-border-color-lighter);
        }

        .track-visual-draft-name {
          flex-shrink: 0;
        }

        .track-visual-draft-selector {
          max-width: 260px;
          overflow: hidden;
          font-family: monospace;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .track-visual-draft-text,
        .track-visual-draft-route {
          max-width: 160px;
          overflow: hidden;
          color: var(--el-text-color-secondary);
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .track-visual-draft-time {
          color: var(--el-text-color-placeholder);
        }

        .track-visual-draft-ops {
          flex-shrink: 0;
          margin-left: auto;
        }
      }
    }

    // 规则表选择器列：formatter 产物不带本页 scopeId，须走 :deep()
    :deep(.track-visual-selector-cell) {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      font-family: monospace;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
    }

    .track-created-appkey {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 16px;

      .track-created-value {
        font-family: monospace;
        font-size: 15px;
        font-weight: 600;
      }
    }

    .track-created-tip {
      margin-top: 16px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .track-created-snippet {
      padding: 12px;
      margin-top: 8px;
      overflow: auto;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.6;
      white-space: pre;
      background: var(--el-fill-color-light);
      border-radius: 6px;
    }
  }
</style>
