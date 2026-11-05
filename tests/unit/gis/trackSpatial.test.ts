import { describe, expect, it } from 'vitest'
import {
  cellWeight,
  filterValidCells,
  filterValidPoints,
  formatBbox,
  maxCellWeight,
  normalizeHeatWeight,
  pointDimmed,
  pointHasReplay,
  pointHasUser
} from '@/gis/trackSpatial'

describe('trackSpatial · cellWeight', () => {
  it('优先 weight，其次 count，缺省 1', () => {
    expect(cellWeight({ weight: 9, count: 2 })).toBe(9)
    expect(cellWeight({ count: 4 })).toBe(4)
    expect(cellWeight({})).toBe(1)
  })

  it('非正数 / NaN / Infinity 回落 1', () => {
    expect(cellWeight({ weight: 0 })).toBe(1)
    expect(cellWeight({ count: -3 })).toBe(1)
    expect(cellWeight({ weight: Number.NaN })).toBe(1)
    expect(cellWeight({ count: Number.POSITIVE_INFINITY })).toBe(1)
  })
})

describe('trackSpatial · normalizeHeatWeight', () => {
  it('按 max 归一化到 (0,1]', () => {
    expect(normalizeHeatWeight(5, 10)).toBe(0.5)
    expect(normalizeHeatWeight(10, 10)).toBe(1)
    expect(normalizeHeatWeight(20, 10)).toBe(1)
  })

  it('maxRaw≤0 或非法 raw 有兜底', () => {
    expect(normalizeHeatWeight(3, 0)).toBe(1)
    expect(normalizeHeatWeight(Number.NaN, 10)).toBe(1)
    expect(normalizeHeatWeight(-1, 10)).toBe(0)
  })
})

describe('trackSpatial · maxCellWeight / 空数据', () => {
  it('空 cells 最大重量为 0，过滤掉非法坐标', () => {
    expect(maxCellWeight([])).toBe(0)
    expect(filterValidCells(undefined)).toEqual([])
    expect(filterValidCells(null)).toEqual([])
    expect(
      filterValidCells([
        { lon: 116, lat: 39, count: 2 },
        { lon: Number.NaN, lat: 39, count: 9 },
        { lon: 117, lat: Number.POSITIVE_INFINITY }
      ])
    ).toEqual([{ lon: 116, lat: 39, count: 2 }])
    expect(filterValidPoints([])).toEqual([])
    expect(filterValidPoints(undefined)).toEqual([])
  })

  it('maxCellWeight 走 weight??count', () => {
    expect(
      maxCellWeight([
        { lon: 1, lat: 1, count: 3 },
        { lon: 2, lat: 2, weight: 8, count: 1 }
      ])
    ).toBe(8)
  })
})

describe('trackSpatial · 回放 / 用户可点', () => {
  it('有 sessionId 可回放', () => {
    expect(pointHasReplay({ sessionId: 's1' })).toBe(true)
    expect(pointHasReplay({ sessionId: '  ' })).toBe(false)
    expect(pointHasReplay({})).toBe(false)
  })

  it('distinctId 或有限 userId 可跳用户', () => {
    expect(pointHasUser({ distinctId: 'd1' })).toBe(true)
    expect(pointHasUser({ userId: 42 })).toBe(true)
    expect(pointHasUser({ userId: 0 })).toBe(true)
    expect(pointHasUser({ userId: null })).toBe(false)
    expect(pointHasUser({ distinctId: '' })).toBe(false)
    expect(pointHasUser({})).toBe(false)
  })

  it('既不能回放也不能跳用户时 dimmed', () => {
    expect(pointDimmed({ lon: 1, lat: 2 })).toBe(true)
    expect(pointDimmed({ lon: 1, lat: 2, sessionId: 's' })).toBe(false)
    expect(pointDimmed({ lon: 1, lat: 2, distinctId: 'd' })).toBe(false)
    expect(pointDimmed({ lon: 1, lat: 2, userId: 1 })).toBe(false)
  })
})

describe('trackSpatial · formatBbox', () => {
  it('拼成 minLon,minLat,maxLon,maxLat', () => {
    expect(formatBbox(116.1, 39.2, 117.3, 40.4)).toBe('116.1,39.2,117.3,40.4')
  })
})
