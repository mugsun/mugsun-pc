import { describe, expect, it } from 'vitest'
import { buildTrackAskMock } from '../../../modules/track/ask-mock'

describe('track ask mock shape', () => {
  it('overview 同形且回放 ≤5', () => {
    const r = buildTrackAskMock({
      appKey: 'ak_demo',
      question: '近 7 天访问量怎么样',
      days: 7
    })
    expect(r.source).toBe('track-analysis')
    expect(r.intent).toBe('overview')
    expect(r.resultType).toBe('metric')
    expect(r.question).toContain('访问量')
    expect(r.metrics.pv).toBeTruthy()
    expect(r.replays.length).toBeGreaterThan(0)
    expect(r.replays.length).toBeLessThanOrEqual(5)
    expect(r.replays[0].appKey).toBe('ak_demo')
    expect(r.replayEmpty).toBe(false)
    expect(r.replayDenied).toBe(false)
  })

  it('unsupported / 无回放 / 无回放权', () => {
    const u = buildTrackAskMock({ appKey: 'ak', question: '帮我写 Excel 配置' })
    expect(u.intent).toBe('unsupported')
    expect(u.resultType).toBe('text')
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
