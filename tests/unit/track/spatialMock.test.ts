import { describe, expect, it } from 'vitest'
import { buildTrackSpatialMock } from '../../../modules/track/spatial-mock'
import {
  clampSpatialDays,
  isSpatialEmpty,
  isTrackSpatialMockEnabled,
  normalizeSpatialMode,
  resolveSpatialPointJump,
  zoomToGridPrecision
} from '../../../modules/track/spatial-shape'

describe('isTrackSpatialMockEnabled', () => {
  it('默认 / 未设 / false：不走 mock（打真 API）', () => {
    expect(isTrackSpatialMockEnabled({ DEV: true })).toBe(false)
    expect(isTrackSpatialMockEnabled({ DEV: true, VITE_TRACK_SPATIAL_MOCK: '' })).toBe(false)
    expect(isTrackSpatialMockEnabled({ DEV: true, VITE_TRACK_SPATIAL_MOCK: 'false' })).toBe(false)
    expect(isTrackSpatialMockEnabled({ DEV: false, VITE_TRACK_SPATIAL_MOCK: 'true' })).toBe(false)
  })

  it('仅 DEV + true 启用', () => {
    expect(isTrackSpatialMockEnabled({ DEV: true, VITE_TRACK_SPATIAL_MOCK: 'true' })).toBe(true)
    expect(isTrackSpatialMockEnabled({ DEV: true, VITE_TRACK_SPATIAL_MOCK: 'TRUE' })).toBe(true)
    expect(isTrackSpatialMockEnabled({ DEV: true, VITE_TRACK_SPATIAL_MOCK: ' True ' })).toBe(true)
  })
})

describe('clamp / mode / empty', () => {
  it('days 夹紧 1..30，缺省 7', () => {
    expect(clampSpatialDays(undefined)).toBe(7)
    expect(clampSpatialDays(0)).toBe(1)
    expect(clampSpatialDays(999)).toBe(30)
    expect(clampSpatialDays(7)).toBe(7)
  })

  it('mode 归一化', () => {
    expect(normalizeSpatialMode('points')).toBe('points')
    expect(normalizeSpatialMode('agg')).toBe('agg')
    expect(normalizeSpatialMode('x')).toBe('agg')
  })

  it('空态按 mode', () => {
    expect(isSpatialEmpty(null)).toBe(true)
    expect(
      isSpatialEmpty({ mode: 'agg', cells: [], points: [], geoCount: 0, truncated: false })
    ).toBe(true)
    expect(
      isSpatialEmpty({
        mode: 'points',
        cells: [{ lon: 1, lat: 2, count: 1, weight: 1 }],
        points: [],
        geoCount: 1,
        truncated: false
      })
    ).toBe(true)
    expect(
      isSpatialEmpty({
        mode: 'agg',
        cells: [{ lon: 1, lat: 2, count: 1, weight: 0.5 }],
        points: [],
        geoCount: 1,
        truncated: false
      })
    ).toBe(false)
  })
})

describe('buildTrackSpatialMock', () => {
  it('agg 产出 cells+weight，points 空', () => {
    const r = buildTrackSpatialMock({ appKey: 'ak', days: 7, mode: 'agg' })
    expect(r.mode).toBe('agg')
    expect(r.cells.length).toBeGreaterThan(0)
    expect(r.points).toEqual([])
    expect(r.cells[0].weight).toBeGreaterThan(0)
    expect(r.geoCount).toBeGreaterThan(0)
  })

  it('points 产出可跳转字段；__empty__ 空数组', () => {
    const r = buildTrackSpatialMock({ appKey: 'ak', mode: 'points' })
    expect(r.mode).toBe('points')
    expect(r.points.length).toBeGreaterThan(0)
    expect(r.cells).toEqual([])
    expect(r.points.some((p) => p.sessionId)).toBe(true)

    const empty = buildTrackSpatialMock({
      appKey: 'ak',
      mode: 'points',
      eventNames: ['__empty__']
    })
    expect(empty.points).toEqual([])
    expect(empty.geoCount).toBe(0)
  })

  it('days 夹紧', () => {
    expect(buildTrackSpatialMock({ appKey: 'ak', days: 0 }).cells.length).toBeGreaterThan(0)
    const big = buildTrackSpatialMock({ appKey: 'ak', days: 99, mode: 'agg' })
    expect(big.geoCount).toBeGreaterThan(0)
  })
})

describe('resolveSpatialPointJump', () => {
  it('有 sessionId：需回放权', () => {
    expect(resolveSpatialPointJump({ lon: 1, lat: 2, sessionId: 's1' }, true)).toEqual({
      kind: 'replay',
      sessionId: 's1'
    })
    expect(resolveSpatialPointJump({ lon: 1, lat: 2, sessionId: 's1' }, false)).toEqual({
      kind: 'none',
      reason: 'no-replay-perm'
    })
  })

  it('无 session 时走 userId / distinctId', () => {
    expect(resolveSpatialPointJump({ lon: 1, lat: 2, userId: 9 }, true)).toEqual({
      kind: 'user',
      userId: '9',
      distinctId: undefined
    })
    expect(resolveSpatialPointJump({ lon: 1, lat: 2, distinctId: 'g1' }, true)).toEqual({
      kind: 'user',
      userId: undefined,
      distinctId: 'g1'
    })
  })

  it('无 id 不跳', () => {
    expect(resolveSpatialPointJump({ lon: 1, lat: 2 }, true)).toEqual({
      kind: 'none',
      reason: 'no-id'
    })
    expect(resolveSpatialPointJump(null, true)).toEqual({ kind: 'none', reason: 'no-id' })
  })
})

describe('zoomToGridPrecision', () => {
  it('按后端档位映射', () => {
    expect(zoomToGridPrecision(undefined)).toBe(1)
    expect(zoomToGridPrecision(5)).toBe(1)
    expect(zoomToGridPrecision(6)).toBe(2)
    expect(zoomToGridPrecision(8)).toBe(2)
    expect(zoomToGridPrecision(9)).toBe(3)
    expect(zoomToGridPrecision(11)).toBe(3)
    expect(zoomToGridPrecision(12)).toBe(4)
    expect(zoomToGridPrecision(18)).toBe(4)
  })
})
