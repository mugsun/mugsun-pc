import { describe, expect, it } from 'vitest'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'
import {
  GIS_LIMITS_DOC_EN,
  GIS_LIMITS_DOC_ZH,
  metricsSkippedCount,
  skippedCount,
  skippedDocUrl
} from '@/gis/skippedHint'

describe('跳过要素提示（skipped）', () => {
  it('只认正数，缺失 / 0 / 负数 / 非数字都视为 0', () => {
    expect(skippedCount({ skipped: 3 })).toBe(3)
    expect(skippedCount({ skipped: 2.7 })).toBe(2)
    expect(skippedCount({ skipped: 0 })).toBe(0)
    expect(skippedCount({ skipped: -1 })).toBe(0)
    expect(skippedCount({ skipped: '3' })).toBe(0)
    expect(skippedCount({ skipped: Number.NaN })).toBe(0)
    expect(skippedCount({ count: 5, engine: 'postgis' })).toBe(0)
    expect(skippedCount(null)).toBe(0)
    expect(skippedCount(undefined)).toBe(0)
  })

  it('metricsSkipped 从 metrics 里取，缺失或非正数为 0', () => {
    expect(metricsSkippedCount({ metrics: { metricsSkipped: 2 } })).toBe(2)
    expect(metricsSkippedCount({ metrics: { metricsSkipped: 0 } })).toBe(0)
    expect(metricsSkippedCount({ metrics: {} })).toBe(0)
    expect(metricsSkippedCount({ skipped: 3 })).toBe(0)
    expect(metricsSkippedCount(null)).toBe(0)
  })

  it('文档链接按语言指向限制说明一节', () => {
    expect(skippedDocUrl('zh-CN')).toBe(GIS_LIMITS_DOC_ZH)
    expect(skippedDocUrl('zh')).toBe(GIS_LIMITS_DOC_ZH)
    expect(skippedDocUrl('en')).toBe(GIS_LIMITS_DOC_EN)
    expect(skippedDocUrl(undefined)).toBe(GIS_LIMITS_DOC_EN)
    expect(GIS_LIMITS_DOC_ZH).toMatch(/\/pc\/gis#metric-limits$/)
    expect(GIS_LIMITS_DOC_EN).toMatch(/\/en\/pc\/gis#metric-limits$/)
  })

  it('中英文文案齐全，带数量占位符并说明原因', () => {
    const zhGis = (zh as { pages: { gis: Record<string, string> } }).pages.gis
    const enGis = (en as { pages: { gis: Record<string, string> } }).pages.gis
    expect(zhGis.skippedHint).toBe('已跳过 {n} 个要素（缓冲包住极点或跨 180°）')
    expect(enGis.skippedHint).toContain('{n}')
    expect(enGis.skippedHint).toMatch(/pole/i)
    expect(enGis.skippedHint).not.toMatch(/polar/i)
    expect(zhGis.metricsSkipped).toBe('{n} 个要素未计入面积与长度')
    expect(enGis.metricsSkipped).toContain('{n}')
    expect(enGis.metricsSkipped).toMatch(/area and length/)
    expect(enGis.skippedHint).toContain('180°')
    expect(zhGis.skippedHintDoc).toBeTruthy()
    expect(enGis.skippedHintDoc).toBeTruthy()
  })
})
