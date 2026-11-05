import { describe, expect, it } from 'vitest'
import { buildTrackAskMock } from '../../../modules/track/ask-mock'
import {
  adaptAskChart,
  isAskMetricsType,
  isAskUnsupportedType,
  isTrackAskMockEnabled,
  previewAskRaw
} from '../../../modules/track/ask-shape'

describe('track ask mock shape', () => {
  it('overview 同形且回放 ≤5（boot resultType=metrics）', () => {
    const r = buildTrackAskMock({
      appKey: 'ak_demo',
      question: '近 7 天访问量怎么样',
      days: 7
    })
    expect(r.source).toBe('track-analysis')
    expect(r.intent).toBe('overview')
    expect(r.resultType).toBe('metrics')
    expect(r.question).toContain('访问量')
    expect(r.metrics?.pv).toBeTruthy()
    expect(r.replays.length).toBeGreaterThan(0)
    expect(r.replays.length).toBeLessThanOrEqual(5)
    expect(r.replays[0].appKey).toBe('ak_demo')
    expect(r.replayEmpty).toBe(false)
    expect(r.replayDenied).toBe(false)
  })

  it('trend 产出 boot 形 series 行', () => {
    const r = buildTrackAskMock({ appKey: 'ak', question: '近 7 天访问趋势', days: 7 })
    expect(r.resultType).toBe('series')
    expect(Array.isArray(r.series)).toBe(true)
    expect(r.series!.length).toBeGreaterThan(0)
    const row = r.series![0] as { date?: string; pv?: number }
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(typeof row.pv).toBe('number')
    expect((row as { points?: unknown }).points).toBeUndefined()
  })

  it('unsupported / 无回放 / 无回放权', () => {
    const u = buildTrackAskMock({ appKey: 'ak', question: '帮我写 Excel 配置' })
    expect(u.intent).toBe('unsupported')
    expect(u.resultType).toBe('unsupported')
    expect(u.replays).toEqual([])

    const empty = buildTrackAskMock({ appKey: 'ak', question: '近 7 天 PV 无回放' })
    expect(empty.replayEmpty).toBe(true)
    expect(empty.replays).toEqual([])

    const denied = buildTrackAskMock({ appKey: 'ak', question: '近 7 天 PV 无回放权' })
    expect(denied.replayDenied).toBe(true)
    expect(denied.replayEmpty).toBe(false)
    expect(denied.replays).toEqual([])
  })

  it('days 夹紧到 1..90', () => {
    expect(buildTrackAskMock({ appKey: 'ak', question: '概览', days: 0 }).params.days).toBe(1)
    expect(buildTrackAskMock({ appKey: 'ak', question: '概览', days: 999 }).params.days).toBe(90)
  })
})

describe('isTrackAskMockEnabled', () => {
  it('默认 / 未设 / false：不走 mock（打真 API）', () => {
    expect(isTrackAskMockEnabled({ DEV: true })).toBe(false)
    expect(isTrackAskMockEnabled({ DEV: true, VITE_TRACK_ASK_MOCK: '' })).toBe(false)
    expect(isTrackAskMockEnabled({ DEV: true, VITE_TRACK_ASK_MOCK: 'false' })).toBe(false)
    expect(isTrackAskMockEnabled({ DEV: true, VITE_TRACK_ASK_MOCK: 'FALSE' })).toBe(false)
    expect(isTrackAskMockEnabled({ DEV: false, VITE_TRACK_ASK_MOCK: 'true' })).toBe(false)
  })

  it('仅 DEV + true 启用', () => {
    expect(isTrackAskMockEnabled({ DEV: true, VITE_TRACK_ASK_MOCK: 'true' })).toBe(true)
    expect(isTrackAskMockEnabled({ DEV: true, VITE_TRACK_ASK_MOCK: 'TRUE' })).toBe(true)
    expect(isTrackAskMockEnabled({ DEV: true, VITE_TRACK_ASK_MOCK: ' True ' })).toBe(true)
  })
})

describe('adaptAskChart / resultType helpers', () => {
  it('适配 boot metrics + series 行形态', () => {
    expect(isAskMetricsType('metrics')).toBe(true)
    expect(isAskMetricsType('metric')).toBe(true)
    expect(isAskMetricsType('series')).toBe(false)
    expect(isAskUnsupportedType('unsupported')).toBe(true)
    expect(isAskUnsupportedType('text')).toBe(true)

    const boot = adaptAskChart([
      { date: '2026-11-01', pv: 10, uv: 4, sessionCount: 5, eventCount: 20 },
      { date: '2026-11-02', pv: 12, uv: 5, sessionCount: 6, eventCount: 22 }
    ])
    expect(boot.labels).toEqual(['11-01', '11-02'])
    expect(boot.items.map((s) => s.name)).toEqual(['PV', 'UV', 'sessionCount', 'eventCount'])
    expect(boot.items[0].data).toEqual([10, 12])
    expect(boot.items[1].data).toEqual([4, 5])
  })

  it('兼容旧 {name,points} 形态', () => {
    const legacy = adaptAskChart([
      {
        name: 'PV',
        points: [
          { x: '11-01', y: 10 },
          { x: '11-02', y: 12 }
        ]
      }
    ])
    expect(legacy.labels).toEqual(['11-01', '11-02'])
    expect(legacy.items).toEqual([{ name: 'PV', data: [10, 12] }])
  })

  it('raw regions/steps 成表，其它 JSON', () => {
    const regions = previewAskRaw({
      regions: [{ region: '广东', pv: 1 }],
      geoCount: 1
    })
    expect(regions?.kind).toBe('table')
    if (regions?.kind === 'table') {
      expect(regions.cols).toContain('region')
      expect(regions.rows[0].region).toBe('广东')
    }
    const json = previewAskRaw({ days: 7, rows: [{ cohortDate: '2026-11-01' }] })
    expect(json?.kind).toBe('json')
  })
})
