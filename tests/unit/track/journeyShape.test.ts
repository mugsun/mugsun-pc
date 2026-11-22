import { describe, expect, it } from 'vitest'
import {
  JOURNEY_LIMIT_DEFAULT,
  JOURNEY_LIMIT_MAX,
  buildJourneyCrumbs,
  buildJourneyRows,
  encodeJourneySteps,
  formatJourneyShare,
  journeyBase,
  journeyHasMore,
  journeyOverallShare,
  journeyShare,
  normalizeJourneyResult,
  type TrackJourneyColumnData,
  type TrackJourneyResult
} from '../../../modules/track/journey-shape'

/** 和 boot 的 TrackJourneyApiTest 用同一组数：选了 /home 以后，4 次去了 /list、1 次去了 /about、1 次没有下一步 */
const afterHome: TrackJourneyResult = {
  days: 7,
  start: 'any',
  total: 7,
  steps: [{ page: '/home', sessions: 6 }],
  next: [
    { page: '/list', sessions: 4 },
    { page: '/about', sessions: 1 }
  ],
  ended: 1,
  others: 0
}

/** 还没选起点：列出可以当起点的页面 */
const candidates: TrackJourneyResult = {
  days: 7,
  start: 'any',
  total: 7,
  steps: [],
  next: [
    { page: '/home', sessions: 6 },
    { page: '/list', sessions: 5 }
  ],
  ended: 0,
  others: 0
}

describe('normalizeJourneyResult', () => {
  it('接口返回的数据原样保留', () => {
    expect(normalizeJourneyResult({ ...afterHome, unit: 'session' })).toEqual(afterHome)
  })

  it('缺字段、类型不对都当 0 或空列表，不抛错', () => {
    const empty = { days: 0, start: 'any', total: 0, steps: [], next: [], ended: 0, others: 0 }
    expect(normalizeJourneyResult(null)).toEqual(empty)
    expect(normalizeJourneyResult(undefined)).toEqual(empty)
    expect(normalizeJourneyResult('oops')).toEqual(empty)
    expect(
      normalizeJourneyResult({
        days: '7',
        start: 'x',
        total: -3,
        steps: 'no',
        next: {},
        ended: NaN
      })
    ).toEqual({ ...empty, days: 7 })
  })

  it('没有页面地址的项丢掉，会话数不是数字的当 0', () => {
    const r = normalizeJourneyResult({
      start: 'entry',
      next: [{ page: '/a', sessions: '3' }, { page: '', sessions: 9 }, null, { sessions: 2 }],
      steps: [{ page: '/b', sessions: 'abc' }]
    })
    expect(r.start).toBe('entry')
    expect(r.next).toEqual([{ page: '/a', sessions: 3 }])
    expect(r.steps).toEqual([{ page: '/b', sessions: 0 }])
  })
})

describe('encodeJourneySteps', () => {
  it('一步都没选时不带这个参数', () => {
    expect(encodeJourneySteps([])).toBeUndefined()
  })

  it('拼成一个 JSON 数组字符串，地址里的逗号和引号不会把步骤拆错', () => {
    const text = encodeJourneySteps(['/a,b', '/say"hi"'])
    expect(typeof text).toBe('string')
    expect(JSON.parse(text as string)).toEqual(['/a,b', '/say"hi"'])
  })
})

describe('占比', () => {
  it('基数不大于 0 时是 0，不出现 NaN 或无穷大', () => {
    expect(journeyShare(3, 0)).toBe(0)
    expect(journeyShare(0, 0)).toBe(0)
    expect(journeyShare(3, -1)).toBe(0)
  })

  it('正常按百分比算，最多 100', () => {
    expect(journeyShare(1, 4)).toBe(25)
    expect(journeyShare(9, 4)).toBe(100)
  })

  it('显示一位小数；大于 0 但不到 0.1% 的写成 <0.1%', () => {
    expect(formatJourneyShare(66.666)).toBe('66.7%')
    expect(formatJourneyShare(100)).toBe('100.0%')
    expect(formatJourneyShare(0)).toBe('0.0%')
    expect(formatJourneyShare(0.04)).toBe('<0.1%')
  })
})

describe('buildJourneyRows', () => {
  it('选了步骤：基数是最后一步的会话数，各行的会话数加起来等于基数', () => {
    expect(journeyBase(afterHome)).toBe(6)
    const rows = buildJourneyRows(afterHome)
    expect(rows.map((r) => `${r.kind}:${r.page}:${r.sessions}`)).toEqual([
      'page:/list:4',
      'page:/about:1',
      'ended::1'
    ])
    expect(rows.reduce((sum, r) => sum + r.sessions, 0)).toBe(6)
    expect(rows[0].pct).toBeCloseTo(66.667, 2)
  })

  it('「其他页面」排在「没有下一步」前面，为 0 的合计不显示', () => {
    const rows = buildJourneyRows({ ...afterHome, next: [afterHome.next[0]], others: 1 })
    expect(rows.map((r) => r.kind)).toEqual(['page', 'others', 'ended'])
    expect(buildJourneyRows({ ...afterHome, ended: 0 }).map((r) => r.kind)).toEqual([
      'page',
      'page'
    ])
  })

  it('还没选起点：基数是有页面浏览的会话总数', () => {
    expect(journeyBase(candidates)).toBe(7)
    expect(buildJourneyRows(candidates)[0].pct).toBeCloseTo(85.714, 2)
  })

  it('没有会话走过这条路径时一行都没有', () => {
    const none: TrackJourneyResult = {
      ...afterHome,
      steps: [
        { page: '/home', sessions: 6 },
        { page: '/detail', sessions: 0 }
      ],
      next: [],
      ended: 0
    }
    expect(buildJourneyRows(none)).toEqual([])
  })
})

describe('journeyHasMore', () => {
  it('有排不进列表的会话就还有', () => {
    expect(journeyHasMore({ ...afterHome, others: 2 }, JOURNEY_LIMIT_DEFAULT)).toBe(true)
    expect(journeyHasMore(afterHome, JOURNEY_LIMIT_DEFAULT)).toBe(false)
  })

  it('任意位置选起点时后端不算 others，列满了就当作可能还有', () => {
    expect(journeyHasMore(candidates, 2)).toBe(true)
    expect(journeyHasMore(candidates, 3)).toBe(false)
    expect(journeyHasMore({ ...candidates, start: 'entry' }, 2)).toBe(false)
  })

  it('已经到上限就不再提示', () => {
    expect(journeyHasMore({ ...afterHome, others: 2 }, JOURNEY_LIMIT_MAX)).toBe(false)
  })
})

describe('buildJourneyCrumbs', () => {
  const afterHomeList: TrackJourneyResult = {
    ...afterHome,
    steps: [
      { page: '/home', sessions: 6 },
      { page: '/list', sessions: 4 }
    ],
    next: [
      { page: '/detail', sessions: 3 },
      { page: '/home', sessions: 1 }
    ],
    ended: 0
  }

  it('一步都没选时是空的', () => {
    expect(buildJourneyCrumbs([])).toEqual([])
    expect(buildJourneyCrumbs([{ prefix: [], result: candidates }])).toEqual([])
  })

  it('每一步的会话数和占上一步的多少', () => {
    const columns: TrackJourneyColumnData[] = [
      { prefix: [], result: candidates },
      { prefix: ['/home'], result: afterHome },
      { prefix: ['/home', '/list'], result: afterHomeList }
    ]
    const crumbs = buildJourneyCrumbs(columns)
    expect(crumbs.map((c) => `${c.page}=${c.sessions}`)).toEqual(['/home=6', '/list=4'])
    expect(crumbs[0].pctOfPrev).toBeNull()
    expect(crumbs[1].pctOfPrev).toBeCloseTo(66.667, 2)
    expect(journeyOverallShare(crumbs)).toBeCloseTo(66.667, 2)
  })

  it('新的一列还没查回来：用刚才点的那一行的数', () => {
    const columns: TrackJourneyColumnData[] = [
      { prefix: [], result: candidates },
      { prefix: ['/home'], result: afterHome },
      { prefix: ['/home', '/list'], result: null }
    ]
    expect(buildJourneyCrumbs(columns).map((c) => c.sessions)).toEqual([6, 4])
  })

  it('哪里都查不到这一步的数时是 null，占比也不算', () => {
    const columns: TrackJourneyColumnData[] = [
      { prefix: [], result: null },
      { prefix: ['/home'], result: null },
      { prefix: ['/home', '/gone'], result: null }
    ]
    const crumbs = buildJourneyCrumbs(columns)
    expect(crumbs.map((c) => c.sessions)).toEqual([null, null])
    expect(crumbs[1].pctOfPrev).toBeNull()
    expect(journeyOverallShare(crumbs)).toBeNull()
  })

  it('只选了一步时没有「从第一步到最后一步」的占比', () => {
    const crumbs = buildJourneyCrumbs([
      { prefix: [], result: candidates },
      { prefix: ['/home'], result: afterHome }
    ])
    expect(crumbs).toEqual([{ page: '/home', sessions: 6, pctOfPrev: null }])
    expect(journeyOverallShare(crumbs)).toBeNull()
  })
})
