/**
 * 知识库分段设置和分段内容的范围。数值和后端 AiSegmentOptions 一致，
 * 页面上先拦一道是为了少走一次请求，最终以后端的判断为准。
 */
export const KB_SEGMENT_LENGTH_MIN = 100
export const KB_SEGMENT_LENGTH_MAX = 4000
export const KB_SEGMENT_OVERLAP_MAX = 500
/** 一个分段最多多少字 */
export const KB_SEGMENT_CONTENT_MAX = 4000

/**
 * 重叠最多是分段长度的一半：再大，相邻两段大部分内容相同，段数会成倍涨。
 * 长度还没填好（输入框清空时）先不收紧。
 */
export function kbOverlapMax(segmentLength: unknown): number {
  if (typeof segmentLength !== 'number' || !Number.isFinite(segmentLength)) {
    return KB_SEGMENT_OVERLAP_MAX
  }
  const length = Math.min(
    KB_SEGMENT_LENGTH_MAX,
    Math.max(KB_SEGMENT_LENGTH_MIN, Math.trunc(segmentLength))
  )
  return Math.min(KB_SEGMENT_OVERLAP_MAX, Math.floor(length / 2))
}

/** 编辑分段时内容最多多少字：原来就超长的分段，不变长可以改 */
export function kbSegmentContentLimit(original: unknown): number {
  const length = typeof original === 'string' ? original.length : 0
  return Math.max(KB_SEGMENT_CONTENT_MAX, length)
}

export type KbSegmentContentProblem = '' | 'empty' | 'tooLong'

/** 分段内容能不能保存：去掉首尾空白后不能为空，也不能超过上限 */
export function checkKbSegmentContent(value: unknown, original: unknown): KbSegmentContentProblem {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return 'empty'
  return text.length > kbSegmentContentLimit(original) ? 'tooLong' : ''
}
