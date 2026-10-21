import { describe, expect, it, vi } from 'vitest'

// $t 走 vue-i18n 实例，单测不启动 i18n：按 key + 参数回显，便于断言分支而非文案
vi.mock('@/locales', () => ({
  $t: (key: string, named?: Record<string, unknown>) => `${key}:${named?.value ?? ''}`
}))

const { formatTableTime, formatTableDate, formatSecondsDuration } = await import('@/utils/date')

describe('formatTableTime', () => {
  it('空值与非法输入统一返回 -', () => {
    expect(formatTableTime(undefined)).toBe('-')
    expect(formatTableTime(null)).toBe('-')
    expect(formatTableTime('')).toBe('-')
    expect(formatTableTime('not-a-date')).toBe('-')
  })

  it('截掉微秒段后解析 LocalDateTime ISO 串', () => {
    // 后端 LocalDateTime 序列化带 6 位微秒，部分浏览器解析不稳
    expect(formatTableTime('2026-08-28T09:07:05.123456')).toBe('2026-08-28 09:07:05')
    expect(formatTableTime('2026-08-28T09:07:05')).toBe('2026-08-28 09:07:05')
  })

  it('空格分隔的 YYYY-MM-DD HH:mm:ss 先换成 T 再解析（旧版 Safari），结果不变', () => {
    expect(formatTableTime('2026-08-28 09:07:05')).toBe('2026-08-28 09:07:05')
    expect(formatTableTime('2026-08-28 09:07:05.123456')).toBe('2026-08-28 09:07:05')
    // 模拟旧版 Safari：空格分隔的日期时间串解析成 Invalid Date
    const RealDate = Date
    class OldSafariDate extends RealDate {
      constructor(...args: any[]) {
        const [v] = args
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d/.test(v)) super(NaN)
        else super(...(args as []))
      }
    }
    vi.stubGlobal('Date', OldSafariDate)
    try {
      expect(formatTableTime('2026-08-28 09:07:05')).toBe('2026-08-28 09:07:05')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('月日时分秒补零到两位', () => {
    expect(formatTableTime('2026-01-02T03:04:05')).toBe('2026-01-02 03:04:05')
  })

  it('epoch 毫秒同时接受 number 与纯数字串', () => {
    const ms = new Date(2026, 7, 28, 9, 7, 5).getTime()
    expect(formatTableTime(ms)).toBe('2026-08-28 09:07:05')
    expect(formatTableTime(String(ms))).toBe('2026-08-28 09:07:05')
  })

  it('10 位以下数字串不按 epoch 处理', () => {
    // '2026' 若误判为 epoch 毫秒会落到 1970 年；此处走 Date 串解析（按 UTC 解析后以本地时区显示）
    expect(formatTableTime('2026')).toBe('2026-01-01 08:00:00')
    expect(formatTableTime('2026')).not.toContain('1970')
  })
})

describe('formatSecondsDuration', () => {
  it('空值、非法与非正数返回 -', () => {
    expect(formatSecondsDuration(undefined)).toBe('-')
    expect(formatSecondsDuration(null)).toBe('-')
    expect(formatSecondsDuration(0)).toBe('-')
    expect(formatSecondsDuration(-1)).toBe('-')
    expect(formatSecondsDuration(Number.NaN)).toBe('-')
  })

  it('≥1 天走天档，整数不带小数', () => {
    expect(formatSecondsDuration(2592000)).toBe('utils.date.day:30')
    expect(formatSecondsDuration(86400)).toBe('utils.date.day:1')
  })

  it('非整数天保留一位小数', () => {
    expect(formatSecondsDuration(86400 * 1.5)).toBe('utils.date.day:1.5')
  })

  it('不足 1 天走小时档', () => {
    expect(formatSecondsDuration(3600)).toBe('utils.date.hour:1')
    expect(formatSecondsDuration(3600 * 2.5)).toBe('utils.date.hour:2.5')
  })

  it('不足 1 小时走分钟档，且至少显示 1 分钟', () => {
    expect(formatSecondsDuration(600)).toBe('utils.date.minute:10')
    expect(formatSecondsDuration(1)).toBe('utils.date.minute:1')
  })
})

describe('formatTableDate', () => {
  it('只取日期 YYYY-MM-DD，解析口径同 formatTableTime（微秒 ISO / epoch 毫秒）', () => {
    expect(formatTableDate('2027-01-01T00:00:00.123456')).toBe('2027-01-01')
    expect(formatTableDate('2027-01-01 23:59:59')).toBe('2027-01-01')
    const ms = new Date(2026, 1, 3, 4, 5, 6).getTime()
    expect(formatTableDate(ms)).toBe('2026-02-03')
    expect(formatTableDate(String(ms))).toBe('2026-02-03')
  })

  it('空值与非法输入返回 -', () => {
    expect(formatTableDate(undefined)).toBe('-')
    expect(formatTableDate(null)).toBe('-')
    expect(formatTableDate('')).toBe('-')
    expect(formatTableDate('not-a-date')).toBe('-')
  })
})
