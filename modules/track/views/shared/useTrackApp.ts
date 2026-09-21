import { fetchTrackAppPage } from '@/api/track'

// 模块级单例：5 个看板页共享同一份应用/天数选中态。
// 路由 keepAlive 下页面不重新挂载，per-setup ref 会造成各页选中态脱节；localStorage 仅做跨会话持久化。
const appOptions = ref<Array<{ label: string; value: string }>>([])
const appKey = useLocalStorage('track:appKey', '')
const days = useLocalStorage('track:days', 7)
const appsLoading = ref(false)

/**
 * 埋点看板共用：应用选择器（5 页联动 + localStorage 持久化）+ 统计天数。
 * 应用下拉取 track_app 前 100 条；选中项失效（被删/未选）时回退第一个应用。
 */
export function useTrackApp() {
  const loadApps = async (): Promise<void> => {
    appsLoading.value = true
    try {
      const resp: any = await fetchTrackAppPage({ pageNum: 1, pageSize: 100 })
      const records = resp?.records ?? []
      appOptions.value = records.map((r: any) => ({ label: r.appName, value: r.appKey }))
      if (!appOptions.value.some((o) => o.value === appKey.value)) {
        appKey.value = appOptions.value[0]?.value ?? ''
      }
    } finally {
      appsLoading.value = false
    }
  }

  onMounted(loadApps)

  return { appOptions, appKey, days, appsLoading, loadApps }
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** epoch 毫秒 → MM-DD HH:mm:ss */
export function fmtTrackTime(ts?: number | string): string {
  if (ts === undefined || ts === null || ts === '') return '-'
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** epoch 毫秒 → HH:mm:ss（实时流/日内趋势横轴用） */
export function fmtTrackClock(ts?: number | string): string {
  if (ts === undefined || ts === null || ts === '') return '-'
  const d = new Date(Number(ts))
  if (Number.isNaN(d.getTime())) return '-'
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 毫秒时长 → 紧凑可读（1.2s / 3m05s / —） */
export function fmtTrackDuration(ms?: number | null): string {
  if (ms === undefined || ms === null || Number.isNaN(Number(ms))) return '-'
  const v = Number(ms)
  if (v < 1000) return `${Math.round(v)}ms`
  const s = Math.round(v / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m${pad(s % 60)}s`
}

/** 字节数 → 紧凑可读（512B / 36.4KB / 2.1MB） */
export function fmtTrackSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) return '-'
  const v = Number(bytes)
  if (v < 1024) return `${v}B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)}KB`
  return `${(v / 1024 / 1024).toFixed(2)}MB`
}

/** 兼容 epoch 毫秒与已格式化时间字符串（实体审计列为字符串、分析接口为 epoch） */
export function fmtTrackTimeAuto(v?: number | string): string {
  if (v === undefined || v === null || v === '') return '-'
  if (typeof v === 'number' || /^\d{10,}$/.test(String(v))) return fmtTrackTime(Number(v))
  // ISO 等日期字符串统一格式化为 YYYY-MM-DD HH:mm（原始串带 T 与毫秒，不便阅读）
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
