import { describe, expect, it } from 'vitest'
import { assembleReplayEvents } from '../../../modules/track/views/shared/replayEvents'

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
