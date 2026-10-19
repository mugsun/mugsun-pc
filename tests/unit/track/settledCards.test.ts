import { describe, expect, it } from 'vitest'
import {
  UNSETTLED_PLACEHOLDER,
  fmtAvgSessionDuration,
  fmtBounceRate,
  hasSettledSessions
} from '../../../modules/track/views/shared/settledCards'

const fmt = (ms: number) => `${ms}ms`

describe('概览已结算会话指标卡', () => {
  it('后端给了 settledSessionCount=0：两项显示占位符', () => {
    const c = { sessionCount: 110, settledSessionCount: 0, avgSessionDurationMs: 0, bounceRate: 0 }
    expect(hasSettledSessions(c)).toBe(false)
    expect(fmtBounceRate(c)).toBe(UNSETTLED_PLACEHOLDER)
    expect(fmtAvgSessionDuration(c, fmt)).toBe(UNSETTLED_PLACEHOLDER)
  })

  it('settledSessionCount>0 时真实的 0% 跳出率照常显示', () => {
    const c = {
      sessionCount: 10,
      settledSessionCount: 10,
      avgSessionDurationMs: 11000,
      bounceRate: 0
    }
    expect(fmtBounceRate(c)).toBe('0.0%')
    expect(fmtAvgSessionDuration(c, fmt)).toBe('11000ms')
  })

  it('没有会话：占位符', () => {
    const c = { sessionCount: 0, avgSessionDurationMs: 0, bounceRate: 0 }
    expect(fmtBounceRate(c)).toBe(UNSETTLED_PLACEHOLDER)
    expect(fmtAvgSessionDuration(c, fmt)).toBe(UNSETTLED_PLACEHOLDER)
  })

  it('老后端无 settledSessionCount：时长与跳出同为 0 视为未结算', () => {
    const c = { sessionCount: 110, avgSessionDurationMs: 0, bounceRate: 0 }
    expect(hasSettledSessions(c)).toBe(false)
    expect(fmtBounceRate(c)).toBe(UNSETTLED_PLACEHOLDER)
  })

  it('老后端有真实值：正常格式化', () => {
    const c = { sessionCount: 111, avgSessionDurationMs: 11000, bounceRate: 0.027 }
    expect(hasSettledSessions(c)).toBe(true)
    expect(fmtBounceRate(c)).toBe('2.7%')
    expect(fmtAvgSessionDuration(c, fmt)).toBe('11000ms')
  })
})
