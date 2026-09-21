<!-- 会话回放播放器抽屉（G100，回放列表页/错误详情共用）：
     按 detail 块清单逐 seq 拉取块内容（R 信封外裸 JSON，skipEnvelope），按 seq 排序拼接后
     rrweb-player 渲染（时间轴/倍速/暂停内建）；个别缺失/过期块容错跳过。
     G105c：播放器下方加会话事件打点条（事件流按 ts 定位圆点，点击 goto seek）。
     rrweb-player 动态导入独立 chunk，不进入页面首包。 -->
<template>
  <ElDrawer
    v-model="drawerVisible"
    size="960px"
    :title="$t('pages.track.shared.drawerTitle', { id: sessionId })"
    destroy-on-close
    @opened="onOpened"
    @closed="onClosed"
  >
    <div v-loading="loading" class="replay-player-wrap">
      <!-- 会话元数据头 -->
      <div v-if="meta" class="replay-meta">
        <ElTag v-if="meta.hasError === 1" size="small" type="danger" effect="plain">{{
          $t('pages.track.shared.hasError')
        }}</ElTag>
        <span>{{ $t('pages.track.shared.visitor') }} {{ meta.distinctId || '-' }}</span>
        <span>{{ $t('pages.track.shared.entry') }} {{ meta.entryPath || '-' }}</span>
        <span>{{ $t('pages.track.shared.start') }} {{ fmtTrackTime(meta.startTime) }}</span>
        <span>{{ $t('pages.track.shared.duration') }} {{ fmtTrackDuration(meta.durationMs) }}</span>
        <span>{{ $t('pages.track.shared.eventsCount', { count: loadedEvents }) }}</span>
        <span>{{ fmtTrackSize(meta.sizeBytes) }}</span>
      </div>
      <ElAlert
        v-if="skippedBlocks > 0"
        type="warning"
        :closable="false"
        show-icon
        class="replay-skip-tip"
        :title="$t('pages.track.shared.skippedBlocksTip', { count: skippedBlocks })"
      />

      <!-- 播放器挂载点（rrweb-player 自建 DOM，禁 v-html） -->
      <div v-show="playerReady" ref="playerRef" class="replay-player"></div>

      <!-- 会话事件打点条（G105c）：按事件 ts 在会话墙钟区间定位，hover 摘要，点击 seek -->
      <div v-if="eventDots.length" class="track-replay-event-track">
        <ElTooltip
          v-for="(dot, i) in eventDots"
          :key="`${dot.ts}-${i}`"
          placement="top"
          :content="`${dot.eventName} · ${fmtTrackClock(dot.ts)}${dot.urlPath ? ' · ' + dot.urlPath : ''}`"
        >
          <button
            type="button"
            class="track-replay-event-dot"
            :class="`track-replay-event-dot--${dot.cls}`"
            :style="{ left: `${dot.left}%` }"
            @click="gotoEvent(dot)"
          ></button>
        </ElTooltip>
      </div>

      <ElEmpty
        v-if="!loading && !playerReady && !errorMsg"
        :description="$t('pages.track.shared.emptyReplay')"
      />
      <ElResult v-if="errorMsg" icon="error" :title="errorMsg" />
    </div>
  </ElDrawer>
</template>

<script setup lang="ts">
  import { fetchTrackReplayData, fetchTrackReplayDetail, fetchTrackReplayEvents } from '@/api/track'
  import {
    fmtTrackClock,
    fmtTrackDuration,
    fmtTrackSize,
    fmtTrackTime
  } from '@/views/track/shared/useTrackApp'
  import { ElAlert, ElDrawer, ElEmpty, ElResult, ElTag, ElTooltip } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import 'rrweb-player/dist/style.css'

  interface Props {
    visible: boolean
    sessionId: string
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const drawerVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const loading = ref(false)
  const playerReady = ref(false)
  const errorMsg = ref('')
  const meta = ref<Record<string, any> | null>(null)
  const skippedBlocks = ref(0)
  const loadedEvents = ref(0)
  const playerRef = ref<HTMLElement>()
  /** rrweb-player 实例（Svelte 组件，$destroy 卸载；goto 为实例方法，见 dist/rrweb-player.d.ts） */
  let player: {
    $destroy?: () => void
    pause?: () => void
    goto?: (timeOffset: number, play?: boolean) => void
  } | null = null
  /** 加载代际：抽屉快速开合/切换会话时丢弃过期异步结果 */
  let loadGen = 0

  // ===== 会话事件打点（G105c）：事件流按 ts 在墙钟区间定位圆点，点击 goto seek =====
  /** 打点事件流（[{eventName, ts(epochMs), urlPath}] 升序；失败静默降级为空数组不渲染） */
  const replayEvents = ref<Array<{ eventName: string; ts: number; urlPath?: string }>>([])
  /** detail 投影的会话首/末事件时间（epoch ms，可能为 null → 兜底回放起止） */
  const firstEventTs = ref<number | null>(null)
  const lastEventTs = ref<number | null>(null)

  /** 打点区间锚点：后端投影缺省时退回回放 startTime 与 startTime+durationMs */
  const trackFirstTs = computed<number | null>(
    () => firstEventTs.value ?? meta.value?.startTime ?? null
  )
  const trackLastTs = computed<number | null>(() => {
    if (lastEventTs.value != null) return lastEventTs.value
    const start = meta.value?.startTime
    const duration = meta.value?.durationMs
    return start != null && duration != null ? start + duration : null
  })

  interface EventDot {
    eventName: string
    ts: number
    urlPath?: string
    /** 定位百分比（0..100；可视区间外事件已过滤不打点，钳制仅防御） */
    left: number
    cls: string
  }

  /** 事件名 → 圆点着色类（与细查时间线同色系 el-color 族） */
  const dotClass = (name?: string): string => {
    switch (name) {
      case '$pageview':
        return 'pv'
      case '$click':
        return 'click'
      case '$error':
        return 'error'
      case 'api_request':
        return 'api'
      default:
        return 'other'
    }
  }

  /** 打点圆点集：lastTs<=firstTs 或无事件时为空（打点条不渲染） */
  const eventDots = computed<EventDot[]>(() => {
    const first = trackFirstTs.value
    const last = trackLastTs.value
    if (first == null || last == null || last <= first || replayEvents.value.length === 0) return []
    const span = last - first
    return (
      replayEvents.value
        // 窗内事件才打点：回放可视区间外（SDK 初始化早于 rrweb 开录等）的事件无法 seek 到可见时刻，
        // 钳到两端会堆出一排重叠点（浏览器审查实证：53 事件仅 10 在窗内时 42 点堆 0% 形同损坏），宁可不显示
        .filter((e) => typeof e?.ts === 'number' && e.ts >= first && e.ts <= last)
        .map((e) => ({
          ...e,
          left: Math.min(100, Math.max(0, ((e.ts - first) / span) * 100)),
          cls: dotClass(e.eventName)
        }))
    )
  })

  /** 点击圆点：rrweb 偏移锚 = 区间首事件时间戳，clamp [0, durationMs]，跳转后继续播放 */
  const gotoEvent = (dot: EventDot): void => {
    const first = trackFirstTs.value
    if (!player?.goto || first == null) return
    const durationMs = meta.value?.durationMs ?? (trackLastTs.value ?? first) - first
    const offsetMs = Math.min(Math.max(dot.ts - first, 0), Math.max(durationMs, 0))
    player.goto(offsetMs, true)
  }

  /** 打开：拉 detail 块清单 → 逐 seq 拉块（缺失跳过）→ 拼接挂载播放器 */
  const onOpened = async (): Promise<void> => {
    const gen = ++loadGen
    const sessionId = props.sessionId
    if (!sessionId) return
    loading.value = true
    errorMsg.value = ''
    try {
      const detail: any = await fetchTrackReplayDetail({ sessionId })
      if (gen !== loadGen) return
      meta.value = detail?.replay ?? null
      firstEventTs.value = detail?.replay?.firstEventTs ?? null
      lastEventTs.value = detail?.replay?.lastEventTs ?? null
      // 打点事件流与块加载并行发起（showErrorMessage 已关，失败静默降级空数组不显示打点条）；
      // appKey 为后端必填参数（@RequestParam），取自 detail 投影
      const eventsPromise: Promise<any[]> = fetchTrackReplayEvents({
        appKey: detail?.replay?.appKey,
        sessionId
      }).catch(() => [])
      const blocks: Array<{ seq: number }> = [...(detail?.blocks ?? [])].sort(
        (a, b) => a.seq - b.seq
      )
      if (blocks.length === 0) {
        errorMsg.value = t('pages.track.shared.noBlocks')
        return
      }

      // 逐块拉取（服务端已解压明文数组；缺失/过期块跳过不阻断整体播放）
      const events: unknown[] = []
      let skipped = 0
      for (const block of blocks) {
        try {
          const chunk: any = await fetchTrackReplayData({ sessionId, seq: block.seq })
          // skipEnvelope 下后端错误信封（块不存在等）也会原样返回，须按数组形态甄别
          if (Array.isArray(chunk)) events.push(...chunk)
          else skipped++
        } catch {
          skipped++
        }
        if (gen !== loadGen) return
      }
      skippedBlocks.value = skipped
      if (events.length === 0) {
        errorMsg.value = t('pages.track.shared.allBlocksMissing')
        return
      }
      loadedEvents.value = events.length

      const { default: Player } = await import('rrweb-player')
      if (gen !== loadGen || !playerRef.value) return
      // 播放器尺寸随抽屉内容宽自适应（纵向按 16:10 收口，超高会话滚动播放区由播放器内部处理）
      const width = playerRef.value.clientWidth || 880
      player = new Player({
        target: playerRef.value,
        props: {
          events: events as any[],
          width,
          height: Math.round(width * 0.62),
          autoPlay: true,
          skipInactive: true,
          speedOption: [1, 2, 4, 8]
        }
      })
      playerReady.value = true
      // 汇合打点事件流（与块加载并行发起；过期代际结果丢弃）
      const sessionEvents = await eventsPromise
      if (gen !== loadGen) return
      replayEvents.value = Array.isArray(sessionEvents) ? sessionEvents : []
    } catch (e: any) {
      if (gen !== loadGen) return
      errorMsg.value = e?.message || t('pages.track.shared.loadFailed')
    } finally {
      if (gen === loadGen) loading.value = false
    }
  }

  /** 关闭：销毁播放器（iframe/计时器释放）+ 复位状态，下次打开重新拉取 */
  const onClosed = (): void => {
    loadGen++
    try {
      player?.pause?.()
      player?.$destroy?.()
    } catch {
      /* 播放器卸除失败无妨 */
    }
    player = null
    playerReady.value = false
    loading.value = false
    errorMsg.value = ''
    meta.value = null
    skippedBlocks.value = 0
    loadedEvents.value = 0
    replayEvents.value = []
    firstEventTs.value = null
    lastEventTs.value = null
  }
</script>

<style lang="scss" scoped>
  .replay-player-wrap {
    .replay-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .replay-skip-tip {
      margin-bottom: 12px;
    }

    .replay-player {
      width: 100%;
      overflow: hidden;
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 8px;

      // rrweb-player 自带深色控制条，此处仅约束整体不溢出抽屉
      :deep(.rr-player) {
        width: 100% !important;
      }
    }

    // 会话事件打点条（G105c）：28px 横向 track，圆点按事件类型着色（el-color 族，明暗双兼容）
    .track-replay-event-track {
      position: relative;
      height: 28px;
      margin-top: 8px;
      background: var(--el-fill-color-light);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 6px;

      .track-replay-event-dot {
        position: absolute;
        top: 50%;
        width: 8px;
        height: 8px;
        padding: 0;
        cursor: pointer;
        background: var(--el-color-info);
        border: none;
        border-radius: 50%;
        transition: transform 0.15s;
        transform: translate(-50%, -50%);

        &:hover {
          transform: translate(-50%, -50%) scale(1.6);
        }

        &--pv {
          background: var(--el-color-primary);
        }

        &--click {
          background: var(--el-color-success);
        }

        &--error {
          background: var(--el-color-danger);
        }

        &--api {
          background: var(--el-color-warning);
        }

        &--other {
          background: var(--el-color-info);
        }
      }
    }
  }
</style>
