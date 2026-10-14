<!-- 接入健康：每个应用最近收到事件（相对时间 + 超时告警）+ 近 7 天拒绝原因与修复建议（GET /system/track/app/health[/summary]） -->
<template>
  <div class="track-health" data-testid="track-health">
    <div class="track-app-toolbar">
      <ElButton :loading="loading" @click="load" data-testid="track-health-refresh">
        {{ $t('pages.track.app.healthRefresh') }}
      </ElButton>
    </div>
    <p class="track-health-note" data-testid="track-health-note">
      {{ $t('pages.track.app.healthNote') }}
    </p>

    <div
      v-if="loading && !loaded"
      v-loading="true"
      class="track-health-loading"
      data-testid="track-health-loading"
    />
    <ElResult
      v-else-if="error"
      icon="error"
      :title="$t('pages.track.app.healthLoadFailed')"
      data-testid="track-health-error"
    >
      <template #extra>
        <ElButton type="primary" @click="load">{{ $t('pages.track.app.healthRetry') }}</ElButton>
      </template>
    </ElResult>
    <ElEmpty
      v-else-if="apps.length === 0"
      :description="$t('pages.track.app.healthEmpty')"
      data-testid="track-health-empty"
    />
    <div v-else v-loading="loading" class="track-health-list">
      <ElCard
        v-for="a in apps"
        :key="a.appKey"
        shadow="never"
        class="track-health-card"
        data-testid="track-health-card"
        :data-app-key="a.appKey"
      >
        <div class="track-health-head">
          <span class="track-health-name">{{ a.appName }}</span>
          <ElTag v-if="!a.enabled" type="info" size="small">{{
            $t('pages.track.app.healthDisabled')
          }}</ElTag>
          <code class="track-health-key">{{ a.appKey }}</code>
          <span class="track-health-counts">
            <ElTag :type="a.fail7d > 0 ? 'danger' : 'info'" size="small" effect="plain">
              {{ $t('pages.track.app.healthFail7d') }} {{ a.fail7d }}
            </ElTag>
            <ElTag :type="a.warn7d > 0 ? 'warning' : 'info'" size="small" effect="plain">
              {{ $t('pages.track.app.healthWarn7d') }} {{ a.warn7d }}
            </ElTag>
            <ElButton
              link
              type="primary"
              size="small"
              @click="openDetail(a)"
              data-testid="track-health-detail"
            >
              {{ $t('pages.track.app.healthDetail') }}
            </ElButton>
          </span>
        </div>
        <div class="track-health-received">
          {{ $t('pages.track.app.healthLastReceived') }}：
          <ElTooltip
            v-if="a.lastReceivedAt"
            :content="fmtTrackTimeAuto(a.lastReceivedAt)"
            placement="top"
          >
            <span data-testid="track-health-last">{{ relative(a.lastReceivedAt) }}</span>
          </ElTooltip>
          <span v-else data-testid="track-health-last">{{
            $t('pages.track.app.healthNever')
          }}</span>
          <span v-if="a.lastReceivedSource === 'event_def'" class="track-health-muted">
            {{ $t('pages.track.app.healthSourceEventDef') }}
          </span>
        </div>
        <ElAlert
          v-if="!a.lastReceivedAt && a.enabled"
          type="info"
          :closable="false"
          show-icon
          :title="$t('pages.track.app.healthNeverHint')"
          data-testid="track-health-never"
        />
        <ElAlert
          v-else-if="isStale(a)"
          type="warning"
          :closable="false"
          show-icon
          :title="
            $t('pages.track.app.healthStale', { hours: Math.round(a.staleAfterMs / 3600000) })
          "
          data-testid="track-health-stale"
        />
      </ElCard>
    </div>

    <ElDrawer
      v-model="detailVisible"
      :title="detailTitle"
      size="60%"
      data-testid="track-health-drawer"
    >
      <div v-loading="detailLoading">
        <ElResult v-if="detailError" icon="error" :title="$t('pages.track.app.healthLoadFailed')">
          <template #extra>
            <ElButton type="primary" @click="loadDetail">{{
              $t('pages.track.app.healthRetry')
            }}</ElButton>
          </template>
        </ElResult>
        <ElEmpty
          v-else-if="!detailLoading && reasons.length === 0"
          :description="$t('pages.track.app.healthNoReasons')"
          data-testid="track-health-no-reasons"
        />
        <div v-else class="track-health-reasons">
          <div
            v-for="r in reasons"
            :key="r.code"
            class="track-health-reason"
            data-testid="track-health-reason"
          >
            <div class="track-health-reason-head">
              <ElTag :type="r.severity === 'fail' ? 'danger' : 'warning'" size="small">{{
                r.severity
              }}</ElTag>
              <code>{{ r.code }}</code>
              <span>{{ r.description }}</span>
              <span class="track-health-reason-count">
                {{ $t('pages.track.app.healthToday') }} {{ r.today }} ·
                {{ $t('pages.track.app.health7d') }} {{ r.last7d }}
              </span>
            </div>
            <div v-if="r.lastAt" class="track-health-muted">
              {{ $t('pages.track.app.healthLastAt') }}：{{ fmtTrackTimeAuto(r.lastAt) }}
              <template v-if="r.lastMessage">
                · {{ $t('pages.track.app.healthSample') }}：{{ r.lastMessage }}
              </template>
            </div>
            <div class="track-health-fix">
              <b>{{ $t('pages.track.app.healthFix') }}：</b>{{ r.suggestion }}
            </div>
          </div>
        </div>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    ElAlert,
    ElButton,
    ElCard,
    ElDrawer,
    ElEmpty,
    ElResult,
    ElTag,
    ElTooltip
  } from 'element-plus'
  import { fetchTrackAppHealth, fetchTrackAppHealthSummary } from '@/api/track'
  import { fmtTrackTimeAuto } from '@/views/track/shared/useTrackApp'

  defineOptions({ name: 'TrackAppHealth' })

  const { t, locale } = useI18n()

  const apps = ref<any[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref(false)
  const now = ref(Date.now())

  const load = async (): Promise<void> => {
    loading.value = true
    error.value = false
    try {
      apps.value = ((await fetchTrackAppHealthSummary()) as any[]) ?? []
      now.value = Date.now()
      loaded.value = true
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }
  onMounted(load)

  const isStale = (a: any): boolean =>
    !!a.lastReceivedAt && now.value - Number(a.lastReceivedAt) > Number(a.staleAfterMs ?? 86400000)

  const relative = (ts: number): string => {
    const diff = Math.round((Number(ts) - now.value) / 1000)
    const rtf = new Intl.RelativeTimeFormat(
      String(locale.value).startsWith('zh') ? 'zh-CN' : 'en',
      {
        numeric: 'auto'
      }
    )
    const abs = Math.abs(diff)
    if (abs < 60) return rtf.format(diff, 'second')
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
    return rtf.format(Math.round(diff / 86400), 'day')
  }

  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const detailError = ref(false)
  const detailApp = ref<any>(null)
  const reasons = ref<any[]>([])
  const detailTitle = computed(() =>
    t('pages.track.app.healthReasonsTitle', { app: detailApp.value?.appName ?? '' })
  )

  const loadDetail = async (): Promise<void> => {
    if (!detailApp.value) return
    detailLoading.value = true
    detailError.value = false
    try {
      const resp: any = await fetchTrackAppHealth({ appKey: detailApp.value.appKey })
      reasons.value = resp?.reasons ?? []
    } catch {
      detailError.value = true
      reasons.value = []
    } finally {
      detailLoading.value = false
    }
  }

  const openDetail = (a: any): void => {
    detailApp.value = a
    reasons.value = []
    detailVisible.value = true
    void loadDetail()
  }
</script>

<style scoped lang="scss">
  .track-health-note {
    margin: 0 0 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .track-health-loading {
    min-height: 160px;
  }

  .track-health-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .track-health-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }

  .track-health-name {
    font-weight: 600;
  }

  .track-health-key,
  .track-health-muted {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .track-health-counts {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-left: auto;
  }

  .track-health-received {
    margin-bottom: 8px;
  }

  .track-health-reason {
    padding: 12px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .track-health-reason-head {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .track-health-reason-count {
    margin-left: auto;
    font-size: 12px;
  }

  .track-health-fix {
    margin-top: 6px;
  }
</style>
