/**
 * 回放块拼接：SDK 允许 seq 留空洞（收尾块超出卸载期额度被丢、转后台块被同步明文接管等），
 * 服务端按 [0, lastSeq] 列块，缺失块在播放器里跳过。拼接后需要：
 * - 按事件 timestamp 稳定排序（块内有序，但跨块可能乱序：明文接管块沿用原 seq）；
 * - 从第一个全量快照（rrweb FullSnapshot，type 2）开始播放：缺了 seq 0 等前序块时，
 *   快照之前的增量事件找不到 DOM 节点，rrweb 会报错或白屏。保留快照前最近的一个 Meta（type 4，带视口尺寸）。
 *
 * @module views/track/shared/replayEvents
 */

/** rrweb EventType：Meta */
export const RRWEB_META = 4
/** rrweb EventType：FullSnapshot */
export const RRWEB_FULL_SNAPSHOT = 2

export interface ReplayEventLike {
  type?: unknown
  timestamp?: unknown
}

export interface AssembledReplay<T> {
  /** 可直接交给 rrweb-player 的事件 */
  events: T[]
  /** 因缺少前序块被丢弃的事件数（全量快照之前的增量） */
  droppedBeforeSnapshot: number
  /** 没有任何全量快照：无法播放 */
  noSnapshot: boolean
}

const tsOf = (e: ReplayEventLike): number => (typeof e.timestamp === 'number' ? e.timestamp : 0)

export function assembleReplayEvents<T extends ReplayEventLike>(raw: T[]): AssembledReplay<T> {
  const sorted = raw
    .map((e, i) => ({ e, i }))
    .sort((a, b) => tsOf(a.e) - tsOf(b.e) || a.i - b.i)
    .map((x) => x.e)
  const snap = sorted.findIndex((e) => e.type === RRWEB_FULL_SNAPSHOT)
  if (snap < 0) {
    return { events: [], droppedBeforeSnapshot: sorted.length, noSnapshot: true }
  }
  let meta = -1
  for (let i = snap - 1; i >= 0; i--) {
    if (sorted[i].type === RRWEB_META) {
      meta = i
      break
    }
  }
  const head = meta >= 0 ? [sorted[meta]] : []
  return {
    events: [...head, ...sorted.slice(snap)],
    droppedBeforeSnapshot: snap - head.length,
    noSnapshot: false
  }
}
