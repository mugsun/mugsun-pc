<!-- 堆栈还原（G101）：按 appKey+release 查符号表 → 逐个拉 .map 原文 → source-map-js 懒加载逐帧映射原始位置。
     纯文本/span 渲染（禁 v-html）；还原命中的原始路径+行列高亮。 -->
<template>
  <div class="track-stack-restore">
    <ElButton v-if="state === 'idle'" size="small" @click="restore">{{
      $t('pages.track.error.restoreStack')
    }}</ElButton>
    <span v-else-if="state === 'loading'" class="track-restore-tip">{{
      $t('pages.track.error.restoring')
    }}</span>
    <span v-else-if="state === 'none'" class="track-restore-tip">{{ hint }}</span>
    <pre v-else class="track-error-pre track-restore-pre"><div
      v-for="(l, i) in lines"
      :key="i"
    >{{ l.pre }}<span v-if="l.mapped" class="track-restore-hl">{{ l.loc }}</span><template v-else>{{ l.loc }}</template>{{ l.post }}</div></pre>
  </div>
</template>

<script setup lang="ts">
  import { fetchTrackSourcemapPage, fetchTrackSourcemapRaw } from '@/api/track'
  import { useI18n } from 'vue-i18n'

  interface Props {
    appKey: string
    release: string
    stack: string
  }

  const props = defineProps<Props>()

  const { t } = useI18n()

  type RestoreState = 'idle' | 'loading' | 'done' | 'none'

  interface RestoreLine {
    /** 帧前缀（at fn ( / fn@ 等原样保留）；非帧行整行放 pre */
    pre: string
    /** 位置段（压缩 url:line:col 或还原后 source:line:col） */
    loc: string
    /** 帧后缀（右括号等） */
    post: string
    /** 是否还原命中（命中高亮 loc） */
    mapped: boolean
  }

  const state = ref<RestoreState>('idle')
  const hint = ref('')
  const lines = ref<RestoreLine[]>([])

  /** 堆栈帧行：at fn (url:line:col) / at url:line:col / fn@url:line:col（Chrome/Firefox 风格） */
  const FRAME_RE = /^(.*?)(https?:\/\/\S+?|file:\/\/\S+?|webpack:\/\/\S+?):(\d+):(\d+)(\)?\s*)$/

  const basenameOf = (url: string): string => url.split(/[?#]/)[0].split('/').pop() ?? ''

  const restore = async (): Promise<void> => {
    if (state.value === 'loading') return
    state.value = 'loading'
    try {
      const resp: any = await fetchTrackSourcemapPage({
        appKey: props.appKey,
        release: props.release,
        pageNum: 1,
        pageSize: 100
      })
      const records: any[] = resp?.records ?? []
      if (records.length === 0) {
        hint.value = t('pages.track.error.noSourcemap')
        state.value = 'none'
        return
      }
      // source-map-js 懒加载：独立 chunk，不进首包
      const { SourceMapConsumer } = await import('source-map-js')
      const consumers = new Map<number, InstanceType<typeof SourceMapConsumer>>()
      try {
        const getConsumer = async (row: any) => {
          let c = consumers.get(row.id)
          if (!c) {
            // raw 为裸 JSON 直发（skipEnvelope），axios 已解析为对象，可直接构造 consumer
            const raw = await fetchTrackSourcemapRaw({ id: row.id })
            c = new SourceMapConsumer(raw)
            consumers.set(row.id, c)
          }
          return c
        }
        const out: RestoreLine[] = []
        let matched = 0
        for (const rawLine of props.stack.split('\n')) {
          const m = rawLine.match(FRAME_RE)
          if (!m) {
            out.push({ pre: rawLine, loc: '', post: '', mapped: false })
            continue
          }
          const [, pre, url, line, column, post] = m
          const base = basenameOf(url)
          // 符号表文件名惯例 foo.js.map（亦兼容直接以压缩文件名命名）
          const row = records.find((r) => r.filename === `${base}.map` || r.filename === base)
          const original = { pre, loc: `${url}:${line}:${column}`, post, mapped: false }
          if (row) {
            const pos = (await getConsumer(row)).originalPositionFor({
              line: Number(line),
              column: Number(column)
            })
            if (pos && pos.source != null && pos.line != null) {
              matched++
              original.loc = `${pos.source}:${pos.line}:${pos.column ?? 0}`
              original.mapped = true
            }
          }
          out.push(original)
        }
        if (matched === 0) {
          hint.value = t('pages.track.error.noFrameMatch')
          state.value = 'none'
          return
        }
        lines.value = out
        state.value = 'done'
      } finally {
        // destroy 释放 wasm 映射内存（运行时有此方法，类型定义未声明）
        consumers.forEach((c) => (c as any).destroy?.())
      }
    } catch {
      // 失败提示已由 http 层弹出；回到待还原态可重试
      state.value = 'idle'
    }
  }
</script>

<style lang="scss" scoped>
  .track-stack-restore {
    flex: 1;
    min-width: 0;

    .track-restore-tip {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .track-restore-pre {
      margin-top: 4px;

      .track-restore-hl {
        font-weight: 600;
        color: var(--el-color-primary);
      }
    }
  }
</style>
