<!-- 用户细查（G102）：用户/访客 + 时间范围（≤7 天）→ 会话分组行为时间线
     （页面/点击/错误/接口混排流式列表，非表格）→ api_request 展开请求详情与响应体
     （JSON 美化，纯文本渲染禁 v-html；读取留痕由后端审计）→ 会话跳回放 -->
<template>
  <div class="track-user-page art-full-height">
    <!-- 工具栏：应用选择（看板共享选中态）+ 用户/访客切换 + 时间范围 + 查询 -->
    <div class="track-toolbar">
      <ElSelect
        v-model="appKey"
        :loading="appsLoading"
        :placeholder="$t('pages.track.shared.appPlaceholder')"
        class="track-app-select"
      >
        <ElOption v-for="o in appOptions" :key="o.value" :label="o.label" :value="o.value" />
      </ElSelect>
      <ElRadioGroup v-model="idMode">
        <ElRadioButton value="user">{{ $t('pages.track.user.modeUser') }}</ElRadioButton>
        <ElRadioButton value="guest">{{ $t('pages.track.user.modeGuest') }}</ElRadioButton>
      </ElRadioGroup>
      <ElSelect
        v-if="idMode === 'user'"
        v-model="userId"
        filterable
        remote
        clearable
        :remote-method="searchUsers"
        :loading="userSearching"
        :placeholder="$t('pages.track.user.userSearchPlaceholder')"
        class="track-user-select"
      >
        <ElOption v-for="u in userOptions" :key="u.id" :label="u.label" :value="u.id" />
      </ElSelect>
      <ElInput
        v-else
        v-model="distinctId"
        clearable
        :placeholder="$t('pages.track.user.guestPlaceholder')"
        class="track-user-select"
      />
      <ElDatePicker
        v-model="timeRange"
        type="datetimerange"
        :range-separator="$t('pages.track.user.rangeSeparator')"
        :start-placeholder="$t('pages.track.user.startPlaceholder')"
        :end-placeholder="$t('pages.track.user.endPlaceholder')"
        class="track-time-range"
      />
      <ElButton type="primary" :loading="loading" @click="search">{{
        $t('pages.track.shared.search')
      }}</ElButton>
    </div>

    <ElCard class="art-table-card">
      <div v-loading="loading && records.length === 0" class="track-timeline">
        <ElEmpty v-if="!searched" :description="$t('pages.track.user.emptyPrompt')" />
        <ElEmpty
          v-else-if="records.length === 0 && !loading"
          :description="$t('pages.track.user.emptyNoData')"
        />
        <template v-else>
          <!-- 会话分组卡片：头（开始时间/持续/页面数/回放入口）+ 组内事件按时间倒序 -->
          <div v-for="group in sessionGroups" :key="group.key" class="track-session">
            <div class="track-session-head">
              <span class="track-session-start">{{ fmtTrackTime(group.startTs) }}</span>
              <span>{{
                $t('pages.track.user.durationValue', {
                  duration: fmtTrackDuration(group.endTs - group.startTs)
                })
              }}</span>
              <span>{{ $t('pages.track.shared.page') }} {{ group.pageCount }}</span>
              <span class="track-session-id">{{
                $t('pages.track.user.sessionLine', { id: group.sessionId })
              }}</span>
              <ElButton
                v-if="group.hasReplay"
                link
                type="primary"
                size="small"
                class="track-session-replay"
                @click="openReplay(group.sessionId)"
              >
                {{ $t('pages.track.shared.replay') }}
              </ElButton>
            </div>
            <div class="track-event-list">
              <div
                v-for="e in group.events"
                :key="e.eventId"
                class="track-event"
                :class="[`track-event-${meta(e).cls}`, { 'track-event-expandable': isApi(e) }]"
                @click="isApi(e) && toggleExpand(e)"
              >
                <ArtSvgIcon :icon="meta(e).icon" class="track-event-icon" />
                <span class="track-event-time">{{ fmtTrackTime(e.ts) }}</span>
                <span class="track-event-title">{{ meta(e).title }}</span>
                <span class="track-event-summary">{{ meta(e).summary }}</span>
                <span v-if="isApi(e)" class="track-event-api-meta">
                  <ElTag :type="statusTagType(propsOf(e).status)" size="small" effect="plain">
                    {{
                      propsOf(e).status === 0 ? $t('pages.track.user.failed') : propsOf(e).status
                    }}
                  </ElTag>
                  <span>{{ fmtTrackDuration(propsOf(e).duration_ms) }}</span>
                  <span>{{ fmtTrackSize(propsOf(e).response_size) }}</span>
                </span>
                <span v-else-if="e.durationMs" class="track-event-duration">
                  {{ fmtTrackDuration(e.durationMs) }}
                </span>
                <span class="track-event-page">{{ e.routePath || e.urlPath || '-' }}</span>

                <!-- api_request 展开详情：请求方法/完整 URL/状态/耗时/响应大小 + 响应体查看 -->
                <div
                  v-if="isApi(e) && expandedId === e.eventId"
                  class="track-api-detail"
                  @click.stop
                >
                  <div class="track-api-grid">
                    <span>{{
                      $t('pages.track.user.methodLine', { value: propsOf(e).method || '-' })
                    }}</span>
                    <span>
                      {{ $t('pages.track.shared.status') }}
                      <ElTag :type="statusTagType(propsOf(e).status)" size="small" effect="plain">
                        {{
                          propsOf(e).status === 0
                            ? $t('pages.track.user.networkFailed')
                            : propsOf(e).status
                        }}
                      </ElTag>
                    </span>
                    <span>{{
                      $t('pages.track.user.elapsedLine', {
                        value: fmtTrackDuration(propsOf(e).duration_ms)
                      })
                    }}</span>
                    <span>{{
                      $t('pages.track.user.responseSizeLine', {
                        value: fmtTrackSize(propsOf(e).response_size)
                      })
                    }}</span>
                  </div>
                  <div class="track-api-url">{{ propsOf(e).url || '-' }}</div>
                  <div v-if="propsOf(e).error_message" class="track-api-error">
                    {{ $t('pages.track.user.networkError', { msg: propsOf(e).error_message }) }}
                  </div>
                  <div class="track-api-body-bar">
                    <ElButton
                      v-if="e.hasApiBody"
                      v-perm="'sys:track-user:view-body'"
                      size="small"
                      class="track-api-body-btn"
                      @click="loadBody(e)"
                    >
                      {{ $t('pages.track.user.viewBody') }}
                    </ElButton>
                    <span v-else class="track-body-hint">
                      {{
                        $t('pages.track.user.bodyNotCollected', {
                          hint: bodySkippedHint(propsOf(e).body_skipped)
                        })
                      }}
                    </span>
                  </div>
                  <div v-if="bodyStates[e.eventId]" class="track-api-body-view">
                    <div v-if="bodyStates[e.eventId].loading" class="track-body-hint">
                      {{ $t('pages.track.user.bodyLoading') }}
                    </div>
                    <div v-else-if="bodyStates[e.eventId].failed" class="track-body-hint">
                      {{ $t('pages.track.user.bodyGone') }}
                    </div>
                    <pre v-else class="track-api-body-pre">{{ bodyStates[e.eventId].text }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="nextCursor" class="track-load-more">
            <ElButton :loading="loadingMore" class="track-load-more-btn" @click="loadMore">
              {{ $t('pages.track.user.loadMore') }}
            </ElButton>
          </div>
        </template>
      </div>
    </ElCard>

    <!-- 播放器抽屉（与回放列表页/错误详情共用组件） -->
    <ReplayPlayerDrawer v-model:visible="replayVisible" :session-id="replaySessionId" />
  </div>
</template>

<script setup lang="ts">
  import { fetchTrackUserApiBody, fetchTrackUserTimeline } from '@/api/track'
  import { useI18n } from 'vue-i18n'
  import { fetchUserPage } from '@/api/user'
  import {
    fmtTrackDuration,
    fmtTrackSize,
    fmtTrackTime,
    useTrackApp
  } from '@/views/track/shared/useTrackApp'
  import ReplayPlayerDrawer from '@/views/track/shared/ReplayPlayerDrawer.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    ElButton,
    ElDatePicker,
    ElEmpty,
    ElInput,
    ElMessage,
    ElOption,
    ElRadioButton,
    ElRadioGroup,
    ElSelect,
    ElTag
  } from 'element-plus'

  defineOptions({ name: 'TrackUser' })

  const { t } = useI18n()

  /** 时间线查询范围硬限（与后端一致：7 天） */
  const RANGE_MAX_MS = 7 * 24 * 3600 * 1000
  /** 单页事件数（游标分页） */
  const PAGE_SIZE = 50

  const { appOptions, appKey, appsLoading } = useTrackApp()

  // ===== 查询条件 =====
  /** 身份口径：user=系统用户（userId，身份归并）；guest=访客 distinctId 直查 */
  const idMode = ref<'user' | 'guest'>('user')
  const userId = ref<number | undefined>(undefined)
  const userOptions = ref<Array<{ id: number; label: string }>>([])
  const userSearching = ref(false)
  const distinctId = ref('')
  /** 时间范围（默认近 1 天；查询时硬校验 ≤7 天） */
  const timeRange = ref<[Date, Date]>([new Date(Date.now() - 24 * 3600 * 1000), new Date()])

  /** 用户选择器远程搜索：既有 /system/user/page?username=（records 含 id/username/nickname） */
  const searchUsers = async (keyword: string): Promise<void> => {
    userSearching.value = true
    try {
      const resp: any = await fetchUserPage({
        pageNum: 1,
        pageSize: 20,
        username: keyword || undefined
      })
      userOptions.value = (resp?.records ?? []).map((u: any) => ({
        id: u.id,
        label: t('pages.track.user.userOptionLabel', {
          name: u.nickname || u.username,
          account: `@${u.username}`
        })
      }))
    } finally {
      userSearching.value = false
    }
  }

  // ===== 时间线数据（游标分页） =====
  const records = ref<any[]>([])
  const nextCursor = ref<string | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  /** 是否已发起过查询（区分「未选用户」与「无数据」空态） */
  const searched = ref(false)

  /** props 为 JSON 原文字符串（后端投影），解析结果按事件对象缓存 */
  const propsCache = new WeakMap<object, Record<string, any>>()
  function propsOf(e: any): Record<string, any> {
    const hit = propsCache.get(e)
    if (hit) return hit
    let p: Record<string, any> = {}
    try {
      p = e.props ? JSON.parse(e.props) : {}
    } catch {
      p = {}
    }
    propsCache.set(e, p)
    return p
  }

  const isApi = (e: any): boolean => e.eventName === 'api_request'

  /** 事件 → 图标/分类/摘要（$pageview 页面 / $click 点击 / $error 错误 / api_request 接口 / 其余自定义） */
  function meta(e: any): { icon: string; cls: string; title: string; summary: string } {
    const p = propsOf(e)
    switch (e.eventName) {
      case '$pageview':
        return {
          icon: 'ri:window-line',
          cls: 'pv',
          title: t('pages.track.user.eventPageview'),
          summary: p.page_title || e.routePath || e.urlPath || ''
        }
      case '$pageleave':
        return {
          icon: 'ri:door-open-line',
          cls: 'pv',
          title: t('pages.track.user.eventPageleave'),
          summary: fmtTrackDuration(p.duration_ms)
        }
      case '$click':
        return {
          icon: 'ri:cursor-line',
          cls: 'click',
          title: t('pages.track.user.eventClick'),
          summary: p.element_text || p.element_id || p.href || ''
        }
      case '$error':
        return {
          icon: 'ri:bug-line',
          cls: 'error',
          title: t('pages.track.user.eventError'),
          summary: p.message || ''
        }
      case 'api_request':
        return {
          icon: 'ri:exchange-line',
          cls: 'api',
          title: t('pages.track.user.eventApi'),
          summary: `${p.method ?? ''} ${shortUrl(p.url)}`
        }
      case '$identify':
        return {
          icon: 'ri:user-line',
          cls: 'custom',
          title: t('pages.track.user.eventIdentify'),
          summary: ''
        }
      default:
        return { icon: 'ri:flashlight-line', cls: 'custom', title: e.eventName, summary: '' }
    }
  }

  /** 完整 URL → 去 origin 的短路径（含查询串），行内摘要用 */
  function shortUrl(url?: string): string {
    if (!url) return '-'
    try {
      const u = new URL(url)
      return u.pathname + u.search
    } catch {
      return url
    }
  }

  function statusTagType(status?: number): 'success' | 'warning' | 'danger' | 'info' {
    const s = Number(status)
    if (!s) return 'info'
    if (s >= 500) return 'danger'
    if (s >= 400) return 'warning'
    return 'success'
  }

  function bodySkippedHint(skipped?: string): string {
    if (skipped === 'size') return t('pages.track.user.bodySkippedSize')
    if (skipped === 'credential') return t('pages.track.user.bodySkippedCredential')
    return ''
  }

  // ===== 会话分组（记录按时间倒序，同会话连续归并；跨页追加自然续组） =====
  interface SessionGroup {
    key: string
    sessionId: string
    events: any[]
    startTs: number
    endTs: number
    pageCount: number
    hasReplay: boolean
  }

  const sessionGroups = computed<SessionGroup[]>(() => {
    const groups: SessionGroup[] = []
    for (const e of records.value) {
      const ts = Number(e.ts) || 0
      const last = groups[groups.length - 1]
      if (last && last.sessionId === (e.sessionId || '-')) {
        last.events.push(e)
        last.startTs = Math.min(last.startTs, ts)
        last.endTs = Math.max(last.endTs, ts)
        if (e.eventName === '$pageview') last.pageCount++
        if (e.hasReplay === 1) last.hasReplay = true
      } else {
        groups.push({
          key: `${e.sessionId}-${e.eventId}`,
          sessionId: e.sessionId || '-',
          events: [e],
          startTs: ts,
          endTs: ts,
          pageCount: e.eventName === '$pageview' ? 1 : 0,
          hasReplay: e.hasReplay === 1
        })
      }
    }
    return groups
  })

  /** 查询（重置）：条件校验（用户/访客二选一 + 范围 ≤7 天）→ 首页时间线 */
  const search = async (): Promise<void> => {
    const target = idMode.value === 'user' ? userId.value : distinctId.value.trim()
    if (!appKey.value) return
    if (!target) {
      ElMessage.warning(
        idMode.value === 'user'
          ? t('pages.track.user.selectUserWarn')
          : t('pages.track.user.inputGuestWarn')
      )
      return
    }
    const [start, end] = timeRange.value ?? []
    if (!start || !end) {
      ElMessage.warning(t('pages.track.user.selectRangeWarn'))
      return
    }
    if (end.getTime() - start.getTime() > RANGE_MAX_MS) {
      ElMessage.warning(t('pages.track.user.rangeTooLongWarn'))
      return
    }
    records.value = []
    nextCursor.value = null
    expandedId.value = ''
    searched.value = true
    loading.value = true
    try {
      await fetchTimeline()
    } finally {
      loading.value = false
    }
  }

  const loadMore = async (): Promise<void> => {
    if (!nextCursor.value) return
    loadingMore.value = true
    try {
      await fetchTimeline(nextCursor.value)
    } finally {
      loadingMore.value = false
    }
  }

  async function fetchTimeline(cursor?: string): Promise<void> {
    const params: Record<string, any> = {
      appKey: appKey.value,
      startTs: timeRange.value[0].getTime(),
      endTs: timeRange.value[1].getTime(),
      pageSize: PAGE_SIZE
    }
    if (idMode.value === 'user') params.userId = userId.value
    else params.distinctId = distinctId.value.trim()
    if (cursor) params.cursor = cursor
    const resp: any = await fetchTrackUserTimeline(params)
    records.value = [...records.value, ...(resp?.records ?? [])]
    nextCursor.value = resp?.nextCursor ?? null
  }

  // 应用切换：旧应用的时间线结果作废，回到待查询空态
  watch(appKey, () => {
    records.value = []
    nextCursor.value = null
    searched.value = false
    expandedId.value = ''
  })

  // ===== api_request 展开 + 响应体查看 =====
  const expandedId = ref('')
  /** 响应体查看状态（eventId → 加载中/美化文本/未采集占位），纯文本插值渲染（禁 v-html） */
  const bodyStates = ref<Record<string, { loading?: boolean; text?: string; failed?: boolean }>>({})

  const toggleExpand = (e: any): void => {
    expandedId.value = expandedId.value === e.eventId ? '' : e.eventId
  }

  const loadBody = async (e: any): Promise<void> => {
    const id = e.eventId
    if (bodyStates.value[id]?.loading) return
    bodyStates.value[id] = { loading: true }
    try {
      const data = await fetchTrackUserApiBody({ eventId: id })
      bodyStates.value[id] = {
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    } catch {
      bodyStates.value[id] = { failed: true }
    }
  }

  // ===== 回放抽屉 =====
  const replayVisible = ref(false)
  const replaySessionId = ref('')
  const openReplay = (sessionId: string): void => {
    replaySessionId.value = sessionId
    replayVisible.value = true
  }

  const closeOverlays = (): void => {
    replayVisible.value = false
  }

  onDeactivated(closeOverlays)
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
</script>

<style lang="scss" scoped>
  .track-user-page {
    overflow-y: auto;

    .track-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;

      .track-app-select {
        width: 220px;
      }

      .track-user-select {
        width: 240px;
      }

      .track-time-range {
        width: 360px;
      }
    }

    .track-timeline {
      // 时间线为自由增长内容，须自备滚动：全局 .art-table-card .el-card__body 是
      // height:100% + overflow:hidden 裁剪，内部不提供滚动则长列表整体够不到
      height: 100%;
      min-height: 240px;
      overflow-y: auto;

      .track-session {
        margin-bottom: 16px;
        overflow: hidden;
        border: 1px solid var(--el-border-color-lighter);
        border-radius: 8px;

        .track-session-head {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 16px;
          align-items: center;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--el-text-color-secondary);
          background: var(--el-fill-color-light);

          .track-session-start {
            font-weight: 600;
            color: var(--el-text-color-primary);
          }

          .track-session-id {
            font-size: 12px;
          }
        }

        .track-event-list {
          .track-event {
            position: relative;
            display: flex;
            flex-wrap: wrap;
            gap: 4px 12px;
            align-items: center;
            padding: 8px 14px;
            font-size: 13px;
            border-top: 1px solid var(--el-border-color-extra-light);

            .track-event-icon {
              width: 18px;
              font-size: 15px;
              color: var(--el-text-color-secondary);
            }

            .track-event-time {
              width: 130px;
              font-family: monospace;
              color: var(--el-text-color-secondary);
            }

            .track-event-title {
              width: 64px;
              font-weight: 600;
            }

            .track-event-summary {
              flex: 1;
              min-width: 160px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .track-event-api-meta {
              display: inline-flex;
              gap: 8px;
              align-items: center;
              color: var(--el-text-color-secondary);
            }

            .track-event-duration {
              color: var(--el-text-color-secondary);
            }

            .track-event-page {
              max-width: 220px;
              overflow: hidden;
              font-size: 12px;
              color: var(--el-text-color-placeholder);
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            &.track-event-error .track-event-title,
            &.track-event-error .track-event-icon {
              color: var(--el-color-danger);
            }

            &.track-event-api .track-event-icon {
              color: var(--el-color-primary);
            }

            &.track-event-expandable {
              cursor: pointer;

              &:hover {
                background: var(--el-fill-color-light);
              }
            }

            .track-api-detail {
              flex-basis: 100%;
              padding: 10px 12px;
              margin-top: 4px;
              cursor: default;
              background: var(--el-fill-color-lighter);
              border-radius: 6px;

              .track-api-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 6px 20px;
                align-items: center;
                color: var(--el-text-color-regular);
              }

              .track-api-url {
                margin-top: 6px;
                font-family: monospace;
                font-size: 12px;
                color: var(--el-text-color-secondary);
                word-break: break-all;
              }

              .track-api-error {
                margin-top: 6px;
                color: var(--el-color-danger);
              }

              .track-api-body-bar {
                margin-top: 8px;
              }

              .track-body-hint {
                font-size: 12px;
                color: var(--el-text-color-placeholder);
              }

              .track-api-body-view {
                margin-top: 8px;

                .track-api-body-pre {
                  max-height: 320px;
                  padding: 10px;
                  margin: 0;
                  overflow: auto;
                  font-family: monospace;
                  font-size: 12px;
                  word-break: break-all;
                  white-space: pre-wrap;
                  background: var(--el-fill-color);
                  border-radius: 4px;
                }
              }
            }
          }
        }
      }

      .track-load-more {
        padding: 8px 0 4px;
        text-align: center;
      }
    }
  }
</style>
