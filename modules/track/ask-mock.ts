/**
 * 埋点「问数据」本地 mock（与 boot POST /api/system/track/ask 出参同形）。
 * 仅 DEV 且显式 VITE_TRACK_ASK_MOCK=true 时由页面走此数据；默认打真 API。
 */

/** DEV + 显式 true 才启用本地假数据（默认关，走 POST /api/system/track/ask） */
export function isTrackAskMockEnabled(
  env: { DEV?: boolean; VITE_TRACK_ASK_MOCK?: string } = import.meta.env as {
    DEV?: boolean
    VITE_TRACK_ASK_MOCK?: string
  }
): boolean {
  return (
    Boolean(env.DEV) &&
    String(env.VITE_TRACK_ASK_MOCK ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}

export type TrackAskIntent =
  | 'overview'
  | 'trend'
  | 'pages'
  | 'events'
  | 'errors'
  | 'online'
  | 'vitals'
  | 'funnel'
  | 'retention'
  | 'geo'
  | 'unsupported'

export type TrackAskResultType = 'metric' | 'series' | 'table' | 'text'

export interface TrackAskReplayItem {
  sessionId: string
  appKey: string
  startTime?: number
  entryPath?: string
  hasError?: number
  durationMs?: number
}

export interface TrackAskResult {
  question: string
  intent: TrackAskIntent
  params: {
    days?: number
    eventName?: string
    dimType?: string
    dimKey?: string
    steps?: string[]
    windowHours?: number
    fingerprint?: string
    routePath?: string
    limit?: number
  }
  source: 'track-analysis'
  resultType: TrackAskResultType
  summary: string
  metrics: Record<string, number | string>
  series: Array<{ name: string; points: Array<{ x: string | number; y: number }> }>
  table: Array<Record<string, string | number | null>>
  raw: Record<string, unknown>
  replays: TrackAskReplayItem[]
  replayEmpty: boolean
  replayDenied: boolean
  warnings: string[]
}

function inferIntent(q: string): TrackAskIntent {
  const s = q.toLowerCase()
  if (/不支持|随便聊聊|写配置|excel/.test(s)) return 'unsupported'
  if (/在线|online/.test(s)) return 'online'
  if (/漏斗|转化/.test(s)) return 'funnel'
  if (/留存|retention/.test(s)) return 'retention'
  if (/地域|省份|城市|geo|热力/.test(s)) return 'geo'
  if (/vitals|cls|lcp|inp|性能分位/.test(s)) return 'vitals'
  if (/错误|报错|error|崩溃/.test(s)) return 'errors'
  if (/事件|点击|event/.test(s)) return 'events'
  if (/页面|path|pv|uv|top/.test(s)) return 'pages'
  if (/趋势|走势|按天|按小时|trend/.test(s)) return 'trend'
  if (/概览|总览|多少人|访问量|overview/.test(s)) return 'overview'
  return 'overview'
}

/** 按提问关键词拼一份契约同形假数据（最多 5 条回放） */
export function buildTrackAskMock(input: {
  appKey: string
  question: string
  days?: number
}): TrackAskResult {
  const question = String(input.question || '').trim()
  const appKey = String(input.appKey || '')
  const rawDays = input.days == null ? 7 : Number(input.days)
  const days = Math.min(90, Math.max(1, Number.isFinite(rawDays) ? rawDays : 7))
  const intent = inferIntent(question)
  const now = Date.now()

  const baseReplays: TrackAskReplayItem[] = [
    {
      sessionId: 'sess_mock_ask_001',
      appKey,
      startTime: now - 36e5,
      entryPath: '/track/overview',
      hasError: 0,
      durationMs: 125000
    },
    {
      sessionId: 'sess_mock_ask_002',
      appKey,
      startTime: now - 72e5,
      entryPath: '/login',
      hasError: 1,
      durationMs: 48000
    },
    {
      sessionId: 'sess_mock_ask_003',
      appKey,
      startTime: now - 864e5,
      entryPath: '/dashboard',
      hasError: 0,
      durationMs: 210000
    }
  ]

  if (intent === 'unsupported') {
    return {
      question,
      intent,
      params: { days },
      source: 'track-analysis',
      resultType: 'text',
      summary: '这个问题还不在埋点问数范围。可以试试问访问量、趋势、Top 页面、错误或在线人数。',
      metrics: {},
      series: [],
      table: [],
      raw: {},
      replays: [],
      replayEmpty: true,
      replayDenied: false,
      warnings: []
    }
  }

  // 提问里带「无回放」→ 空态；带「无回放权」→ 权限不足（与没数据区分）
  const replayDenied = /无回放权|replay.?denied/i.test(question)
  const replayEmpty = replayDenied ? false : /无回放|replay.?empty/i.test(question)
  const replays = replayDenied || replayEmpty ? [] : baseReplays.slice(0, 5)

  const seriesDays = Array.from({ length: Math.min(days, 7) }, (_, i) => {
    const d = new Date(now - (Math.min(days, 7) - 1 - i) * 864e5)
    const label = `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`
    return { x: label, y: 80 + i * 17 + (intent === 'errors' ? i * 3 : 0) }
  })

  if (intent === 'trend' || intent === 'overview') {
    return {
      question,
      intent,
      params: { days, dimType: 'overview' },
      source: 'track-analysis',
      resultType: intent === 'trend' ? 'series' : 'metric',
      summary:
        intent === 'trend'
          ? `近 ${days} 天访问趋势（mock）`
          : `近 ${days} 天概览：PV 约 1.2 万，UV 约 3.4 千（mock）`,
      metrics:
        intent === 'overview'
          ? { pv: 12480, uv: 3420, sessions: 5102, avgDurationMs: 186000, bounceRate: 0.37 }
          : {},
      series: [{ name: 'PV', points: seriesDays }],
      table: [],
      raw: {},
      replays,
      replayEmpty,
      replayDenied,
      warnings: []
    }
  }

  if (intent === 'pages' || intent === 'events' || intent === 'errors' || intent === 'vitals') {
    const table =
      intent === 'pages'
        ? [
            { pagePath: '/track/overview', pv: 3200, uv: 980 },
            { pagePath: '/track/replay', pv: 860, uv: 410 },
            { pagePath: '/login', pv: 2100, uv: 1500 }
          ]
        : intent === 'events'
          ? [
              { eventName: 'page_view', count: 12480 },
              { eventName: 'click', count: 5600 },
              { eventName: 'api_error', count: 42 }
            ]
          : intent === 'errors'
            ? [
                { fingerprint: 'fp_mock_1', title: 'TypeError: x is null', count: 18 },
                { fingerprint: 'fp_mock_2', title: 'ChunkLoadError', count: 7 }
              ]
            : [
                { name: 'LCP', p75: 2100, unit: 'ms' },
                { name: 'INP', p75: 120, unit: 'ms' },
                { name: 'CLS', p75: 80, unit: '‰' }
              ]
    return {
      question,
      intent,
      params: {
        days,
        limit: 10,
        ...(intent === 'events' ? { eventName: 'click' } : {}),
        ...(intent === 'errors' ? { fingerprint: 'fp_mock_1' } : {})
      },
      source: 'track-analysis',
      resultType: 'table',
      summary: `近 ${days} 天 ${intent} 结果（mock）`,
      metrics: {},
      series: [],
      table,
      raw: {},
      replays,
      replayEmpty,
      replayDenied,
      warnings: []
    }
  }

  if (intent === 'online') {
    return {
      question,
      intent,
      params: { days, windowHours: 0.083 },
      source: 'track-analysis',
      resultType: 'metric',
      summary: '当前约有 12 人在线（近 5 分钟，mock）',
      metrics: { online: 12, windowSeconds: 300 },
      series: [],
      table: [],
      raw: {},
      replays,
      replayEmpty,
      replayDenied,
      warnings: []
    }
  }

  if (intent === 'funnel' || intent === 'retention' || intent === 'geo') {
    return {
      question,
      intent,
      params: {
        days,
        ...(intent === 'funnel' ? { steps: ['page_view', 'click', 'submit'], windowHours: 24 } : {})
      },
      source: 'track-analysis',
      resultType: intent === 'geo' ? 'table' : 'series',
      summary: `近 ${days} 天 ${intent}（mock）`,
      metrics:
        intent === 'funnel'
          ? { conversionRate: 0.18 }
          : intent === 'retention'
            ? { d1: 0.42, d7: 0.21 }
            : {},
      series:
        intent === 'geo'
          ? []
          : [{ name: intent === 'funnel' ? 'stepUsers' : 'retained', points: seriesDays }],
      table:
        intent === 'geo'
          ? [
              { region: '广东', pv: 4200, uv: 1100 },
              { region: '浙江', pv: 3100, uv: 900 }
            ]
          : [],
      raw: {},
      replays,
      replayEmpty,
      replayDenied,
      warnings: []
    }
  }

  return {
    question,
    intent: 'unsupported',
    params: { days },
    source: 'track-analysis',
    resultType: 'text',
    summary: '暂时无法理解这个问题。请换一种问法，例如「近 7 天访问量」。',
    metrics: {},
    series: [],
    table: [],
    raw: {},
    replays: [],
    replayEmpty: true,
    replayDenied: false,
    warnings: []
  }
}
