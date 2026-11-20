import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  KB_SEGMENT_CONTENT_MAX,
  KB_SEGMENT_LENGTH_MAX,
  KB_SEGMENT_LENGTH_MIN,
  KB_SEGMENT_OVERLAP_MAX,
  checkKbSegmentContent,
  kbOverlapMax,
  kbSegmentContentLimit
} from '../../../modules/ai/views/knowledge/kbSegmentLimits'

describe('知识库分段设置的范围', () => {
  it('数值和后端 AiSegmentOptions 一致', () => {
    expect([
      KB_SEGMENT_LENGTH_MIN,
      KB_SEGMENT_LENGTH_MAX,
      KB_SEGMENT_OVERLAP_MAX,
      KB_SEGMENT_CONTENT_MAX
    ]).toEqual([100, 4000, 500, 4000])
  })

  it('重叠最多是分段长度的一半，封顶 500', () => {
    expect(kbOverlapMax(100)).toBe(50)
    expect(kbOverlapMax(101)).toBe(50)
    expect(kbOverlapMax(500)).toBe(250)
    expect(kbOverlapMax(800)).toBe(400)
    expect(kbOverlapMax(1000)).toBe(500)
    expect(kbOverlapMax(4000)).toBe(500)
  })

  it('长度越界按边界算，还没填好时先不收紧', () => {
    expect(kbOverlapMax(1)).toBe(50)
    expect(kbOverlapMax(99999)).toBe(500)
    expect(kbOverlapMax(undefined)).toBe(500)
    expect(kbOverlapMax(null)).toBe(500)
    expect(kbOverlapMax(Number.NaN)).toBe(500)
  })

  it('页面默认的几组长度和重叠都在范围内', () => {
    expect(80).toBeLessThanOrEqual(kbOverlapMax(800))
    expect(80).toBeLessThanOrEqual(kbOverlapMax(500))
  })
})

describe('编辑分段内容的校验', () => {
  it('空的、只有空白的不能保存', () => {
    expect(checkKbSegmentContent('', '原文')).toBe('empty')
    expect(checkKbSegmentContent('  \n\t ', '原文')).toBe('empty')
    expect(checkKbSegmentContent(null, '原文')).toBe('empty')
  })

  it('最多 4000 字，首尾空白不算', () => {
    expect(checkKbSegmentContent('改过的内容', '原文')).toBe('')
    expect(checkKbSegmentContent('字'.repeat(4000), '原文')).toBe('')
    expect(checkKbSegmentContent(`  ${'字'.repeat(4000)}\n`, '原文')).toBe('')
    expect(checkKbSegmentContent('字'.repeat(4001), '原文')).toBe('tooLong')
  })

  it('原来就超长的分段：不变长可以改，变长不行', () => {
    const legacy = '字'.repeat(6000)
    expect(kbSegmentContentLimit(legacy)).toBe(6000)
    expect(kbSegmentContentLimit('短')).toBe(4000)
    expect(kbSegmentContentLimit(undefined)).toBe(4000)
    expect(checkKbSegmentContent('改'.repeat(6000), legacy)).toBe('')
    expect(checkKbSegmentContent('改'.repeat(6001), legacy)).toBe('tooLong')
  })
})

describe('详情页用上了这些范围', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../modules/ai/views/knowledge/detail.vue'),
    'utf-8'
  )

  it('重叠输入框的上限跟着分段长度走，长度调小时已填的重叠跟着收紧', () => {
    expect(src).toContain(
      'const overlapMax = computed(() => kbOverlapMax(uploadForm.segmentLength))'
    )
    expect(src).toContain(':max="overlapMax"')
    expect(src).toContain('if (uploadForm.segmentOverlap > max) uploadForm.segmentOverlap = max')
    expect(src).toContain(':min="KB_SEGMENT_LENGTH_MIN"')
    expect(src).toContain(':max="KB_SEGMENT_LENGTH_MAX"')
  })

  it('编辑分段的弹框在提交前校验内容', () => {
    expect(src).toContain('inputValidator:')
    expect(src).toContain('checkKbSegmentContent(text, row.content)')
  })

  it('提示文案中英文都有，占位符一致', () => {
    for (const pack of [zh, en]) {
      expect(pack.aiKbDetail.overlapHint).toContain('{max}')
      expect(pack.aiKbDetail.segContentTooLong).toContain('{max}')
      expect(pack.aiKbDetail.segContentTooLong).toContain('{n}')
      expect(pack.aiKbDetail.segContentEmpty.length).toBeGreaterThan(0)
    }
  })
})
