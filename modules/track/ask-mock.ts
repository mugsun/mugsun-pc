/**
 * 埋点「问数据」本地 mock（与 boot POST /api/system/track/ask 出参同形）。
 * 仅由页面在 DEV && VITE_TRACK_ASK_MOCK=true 时动态 import；生产产物不含。
 */
import type { TrackAskIntent, TrackAskReplayItem, TrackAskResult } from './ask-shape'

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

/** boot 形趋势行：[{date, pv, uv, sessionCount, eventCount}] */
function buildBootSeriesRows(days: number, now: number, bump = 0) {
  const n = Math.min(days, 7)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now - (n - 1 - i) * 864e5)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return {
      date: `${y}-${m}-${day}`,
      pv: 80 + i * 17 + bump,
      uv: 40 + i * 9,
      sessionCount: 50 + i * 11,
      eventCount: 120 + i * 23
    }
  })
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
      resultType: 'unsupported',
      summary: '这个问题还不在埋点问数范围。可以试试问访问量、趋势、Top 页面、错误或在线人数。',
      metrics: null,
      series: null,
      table: null,
      raw: null,
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
  const seriesRows = buildBootSeriesRows(days, now, intent === 'errors' ? 9 : 0)

  if (intent === 'trend' || intent === 'overview') {
    return {
      question,
      intent,
      params: { days, dimType: 'overview' },
      source: 'track-analysis',
      resultType: intent === 'trend' ? 'series' : 'metrics',
      summary:
        intent === 'trend'
          ? `近 ${days} 天访问趋势（mock）`
          : `近 ${days} 天概览：PV 约 1.2 万，UV 约 3.4 千（mock）`,
      metrics:
        intent === 'overview'
          ? { pv: 12480, uv: 3420, sessions: 5102, avgDurationMs: 186000, bounceRate: 0.37 }
          : null,
      series: intent === 'trend' ? seriesRows : null,
      table: null,
      raw: intent === 'overview' ? { cards: { pv: 12480, uv: 3420 } } : null,
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
      metrics: null,
      series: null,
      table,
      raw: null,
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
      resultType: 'metrics',
      summary: '当前约有 12 人在线（近 5 分钟，mock）',
      metrics: { online: 12, windowSeconds: 300 },
      series: null,
      table: null,
      raw: null,
      replays,
      replayEmpty,
      replayDenied,
      warnings: []
    }
  }

  if (intent === 'funnel' || intent === 'retention' || intent === 'geo') {
    if (intent === 'geo') {
      return {
        question,
        intent,
        params: { days },
        source: 'track-analysis',
        resultType: 'raw',
        summary: `近 ${days} 天地域桶 2 个，带坐标事件 42（mock）`,
        metrics: null,
        series: null,
        table: null,
        raw: {
          regions: [
            { region: '广东', pv: 4200, uv: 1100, eventCount: 8800 },
            { region: '浙江', pv: 3100, uv: 900, eventCount: 6400 }
          ],
          points: [],
          geoCount: 42
        },
        replays,
        replayEmpty,
        replayDenied,
        warnings: []
      }
    }
    if (intent === 'funnel') {
      return {
        question,
        intent,
        params: { days, steps: ['page_view', 'click', 'submit'], windowHours: 24 },
        source: 'track-analysis',
        resultType: 'raw',
        summary: `漏斗 3 步（窗口 24 小时）（mock）`,
        metrics: null,
        series: null,
        table: null,
        raw: {
          steps: [
            { eventName: 'page_view', count: 1000 },
            { eventName: 'click', count: 420 },
            { eventName: 'submit', count: 180 }
          ],
          days,
          windowHours: 24
        },
        replays,
        replayEmpty,
        replayDenied,
        warnings: []
      }
    }
    return {
      question,
      intent,
      params: { days },
      source: 'track-analysis',
      resultType: 'raw',
      summary: `留存 cohort 3 天（近 ${days} 天窗）（mock）`,
      metrics: null,
      series: null,
      table: null,
      raw: {
        days,
        rows: [
          { cohortDate: '2026-11-01', cohortSize: 100, retained: { '1': 42, '7': 21 } },
          { cohortDate: '2026-11-02', cohortSize: 110, retained: { '1': 48, '7': 24 } }
        ]
      },
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
    resultType: 'unsupported',
    summary: '暂时无法理解这个问题。请换一种问法，例如「近 7 天访问量」。',
    metrics: null,
    series: null,
    table: null,
    raw: null,
    replays: [],
    replayEmpty: true,
    replayDenied: false,
    warnings: []
  }
}
