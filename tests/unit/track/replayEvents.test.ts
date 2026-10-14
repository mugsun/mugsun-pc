import { describe, expect, it } from 'vitest'
import {
  assembleReplayBlocks,
  assembleReplayEvents,
  fillSeqGaps
} from '../../../modules/track/views/shared/replayEvents'

const ev = (type: number, timestamp: number, id = 0) => ({ type, timestamp, data: { id } })

describe('assembleReplayEvents（seq 空洞容错）', () => {
  it('完整会话：Meta + 全量快照开头，原样按时间排序', () => {
    const r = assembleReplayEvents([ev(4, 1), ev(2, 2), ev(3, 3), ev(3, 4)])
    expect(r.noSnapshot).toBe(false)
    expect(r.droppedBeforeSnapshot).toBe(0)
    expect(r.events.map((e) => e.timestamp)).toEqual([1, 2, 3, 4])
  })

  it('跨块乱序（明文接管块沿用原 seq）：按 timestamp 稳定排序', () => {
    const r = assembleReplayEvents([ev(4, 1), ev(2, 2), ev(3, 9, 1), ev(3, 5, 2), ev(3, 5, 3)])
    expect(r.events.map((e) => e.data.id)).toEqual([0, 0, 2, 3, 1])
  })

  it('缺了首块：丢弃全量快照前的增量，保留快照前最近的 Meta', () => {
    // seq 0（Meta + 首个快照）缺失；seq 1 只有增量；seq 2 有一次重新 checkout（Meta + 快照）
    const r = assembleReplayEvents([ev(3, 10), ev(3, 11), ev(4, 12), ev(2, 13), ev(3, 14)])
    expect(r.noSnapshot).toBe(false)
    expect(r.droppedBeforeSnapshot).toBe(2)
    expect(r.events.map((e) => [e.type, e.timestamp])).toEqual([
      [4, 12],
      [2, 13],
      [3, 14]
    ])
  })

  it('没有任何全量快照：不可播放', () => {
    const r = assembleReplayEvents([ev(3, 1), ev(3, 2)])
    expect(r.noSnapshot).toBe(true)
    expect(r.events).toEqual([])
  })

  it('中间块缺失：快照之后的空洞不丢事件（rrweb 跳过找不到的节点）', () => {
    const r = assembleReplayEvents([ev(4, 1), ev(2, 2), ev(3, 3), ev(3, 30)])
    expect(r.events).toHaveLength(4)
  })
})

describe('assembleReplayBlocks（缺块后从下一个全量快照接着播）', () => {
  it('中间块缺失：丢掉缺块后、下一个全量快照前的增量，从 Meta + 快照接着播', () => {
    const r = assembleReplayBlocks([
      [ev(4, 1), ev(2, 2), ev(3, 3)],
      null,
      [ev(3, 20), ev(3, 21)],
      [ev(3, 30), ev(4, 31), ev(2, 32), ev(3, 33)]
    ])
    expect(r.droppedAfterGap).toBe(3)
    expect(r.events.map((e) => e.timestamp)).toEqual([1, 2, 3, 31, 32, 33])
  })

  it('缺块后没有全量快照：只播缺块前的部分', () => {
    const r = assembleReplayBlocks([[ev(4, 1), ev(2, 2), ev(3, 3)], null, [ev(3, 20)]])
    expect(r.events.map((e) => e.timestamp)).toEqual([1, 2, 3])
    expect(r.droppedAfterGap).toBe(1)
  })

  it('首块缺失：从第一个全量快照开始（不计入 droppedAfterGap）', () => {
    const r = assembleReplayBlocks([null, [ev(3, 5), ev(4, 6), ev(2, 7), ev(3, 8)]])
    expect(r.events.map((e) => e.timestamp)).toEqual([6, 7, 8])
    expect(r.droppedAfterGap).toBe(0)
    expect(r.droppedBeforeSnapshot).toBe(1)
  })

  it('没有缺块：原样', () => {
    const r = assembleReplayBlocks([[ev(4, 1), ev(2, 2)], [ev(3, 3)]])
    expect(r.events).toHaveLength(3)
    expect(r.droppedAfterGap).toBe(0)
  })

  it('缺块后有全量快照：incompleteTail 为 false', () => {
    const r = assembleReplayBlocks([[ev(4, 1), ev(2, 2)], null, [ev(4, 30), ev(2, 31)]])
    expect(r.incompleteTail).toBe(false)
  })

  it('缺块后没有全量快照：incompleteTail 为 true', () => {
    expect(assembleReplayBlocks([[ev(4, 1), ev(2, 2)], null, [ev(3, 20)]]).incompleteTail).toBe(
      true
    )
    expect(assembleReplayBlocks([[ev(4, 1), ev(2, 2)], null]).incompleteTail).toBe(true)
  })

  it('没有缺块：incompleteTail 为 false', () => {
    expect(assembleReplayBlocks([[ev(4, 1), ev(2, 2)], [ev(3, 3)]]).incompleteTail).toBe(false)
  })
})

describe('fillSeqGaps', () => {
  it('补齐清单里缺的 seq（含开头）', () => {
    expect(fillSeqGaps([3, 1, 4])).toEqual([null, 1, null, 3, 4])
  })
  it('连续：原样', () => {
    expect(fillSeqGaps([0, 1, 2])).toEqual([0, 1, 2])
  })
  it('空清单', () => {
    expect(fillSeqGaps([])).toEqual([])
  })
})
