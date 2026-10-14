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

/**
 * 按块拼接（seq 升序，null = 该块缺失）：缺块之后的增量依赖缺失的 DOM 变更，回放会错位，
 * 所以从缺块后的**下一个全量快照**（连同紧挨在它前面的 Meta）接着播，中间的事件丢弃。
 * SDK 默认每 3 分钟做一次全量快照（rrweb checkoutEveryNms），丢一块最多跳过约 3 分钟。
 */
export function assembleReplayBlocks<T extends ReplayEventLike>(
  blocks: Array<T[] | null>
): AssembledReplay<T> & { droppedAfterGap: number; incompleteTail: boolean } {
  const kept: T[] = []
  let broken = false
  let droppedAfterGap = 0
  for (const block of blocks) {
    if (block === null) {
      // 首块缺失由 assembleReplayEvents 的「从第一个全量快照开始」处理
      if (kept.length > 0) broken = true
      continue
    }
    if (!broken) {
      kept.push(...block)
      continue
    }
    const snap = block.findIndex((e) => e.type === RRWEB_FULL_SNAPSHOT)
    if (snap < 0) {
      droppedAfterGap += block.length
      continue
    }
    const start = snap > 0 && block[snap - 1].type === RRWEB_META ? snap - 1 : snap
    droppedAfterGap += start
    kept.push(...block.slice(start))
    broken = false
  }
  // 最后一次缺块之后再没有全量快照：后续录制无法播放，须明确提示而不是静默提前结束
  return { ...assembleReplayEvents(kept), droppedAfterGap, incompleteTail: broken }
}

/**
 * 服务端块清单按 seq 补齐空洞：返回 [minSeq..maxSeq]（seq 0 起），清单里没有的 seq 为 null。
 * 清单里缺的 seq（从未上传或已清理）也算缺失块，和拉取失败的块一起计数。
 */
export function fillSeqGaps(seqs: number[]): Array<number | null> {
  if (seqs.length === 0) return []
  const have = new Set(seqs)
  const max = Math.max(...seqs)
  const out: Array<number | null> = []
  for (let s = 0; s <= max; s++) out.push(have.has(s) ? s : null)
  return out
}

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
