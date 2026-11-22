import { describe, expect, it } from 'vitest'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'
import {
  PAGE_RANK_HINT_KEY,
  PAGE_RANK_LABEL_KEY,
  PAGE_RANK_TYPES,
  fmtPageRate,
  pageRankParam
} from '@/views/track/shared/pageRank'

const pick = (msgs: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], msgs)

describe('概览页的页面排行', () => {
  it('切换按钮的顺序：访问最多、入口页、退出页', () => {
    expect(PAGE_RANK_TYPES).toEqual(['top', 'entry', 'exit'])
  })

  it('访问最多不带 type，入口页和退出页带', () => {
    expect(pageRankParam('top')).toEqual({})
    expect(pageRankParam('entry')).toEqual({ type: 'entry' })
    expect(pageRankParam('exit')).toEqual({ type: 'exit' })
  })

  it('比率显示成一位小数的百分比', () => {
    expect(fmtPageRate(0.6667)).toBe('66.7%')
    expect(fmtPageRate(0.125)).toBe('12.5%')
    expect(fmtPageRate(1)).toBe('100.0%')
    expect(fmtPageRate('0.25')).toBe('25.0%')
  })

  it('真实的 0 照常显示，不当成没有值', () => {
    expect(fmtPageRate(0)).toBe('0.0%')
  })

  it('没有值或不是数字：显示「-」', () => {
    expect(fmtPageRate(undefined)).toBe('-')
    expect(fmtPageRate(null)).toBe('-')
    expect(fmtPageRate('')).toBe('-')
    expect(fmtPageRate('abc')).toBe('-')
    expect(fmtPageRate(Number.NaN)).toBe('-')
  })

  it('三种排行的按钮文案和说明文案，中英文都配了', () => {
    for (const type of PAGE_RANK_TYPES) {
      for (const key of [PAGE_RANK_LABEL_KEY[type], PAGE_RANK_HINT_KEY[type]]) {
        expect(pick(zh, key), `中文缺 ${key}`).toEqual(expect.any(String))
        expect(pick(en, key), `英文缺 ${key}`).toEqual(expect.any(String))
      }
    }
    expect(pick(zh, PAGE_RANK_LABEL_KEY.entry)).toBe('入口页')
    expect(pick(zh, PAGE_RANK_LABEL_KEY.exit)).toBe('退出页')
    expect(pick(en, PAGE_RANK_LABEL_KEY.entry)).toBe('Entry pages')
    expect(pick(en, PAGE_RANK_LABEL_KEY.exit)).toBe('Exit pages')
  })
})
