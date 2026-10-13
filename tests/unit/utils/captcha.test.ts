import { describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))

const { HttpError } = await import('@/utils/http/error')
const {
  TrackRecorder,
  TRACK_MAX_POINTS,
  buildVerifyPayload,
  clampDisplayWidth,
  clampOffset,
  classifyCaptchaError,
  isCaptchaRequired,
  keyboardStep,
  maxOffset,
  toDisplay
} = await import('@/utils/captcha')

describe('坐标缩放', () => {
  it('显示宽度夹在 260–320', () => {
    expect(clampDisplayWidth(200)).toBe(260)
    expect(clampDisplayWidth(290.4)).toBe(290)
    expect(clampDisplayWidth(800)).toBe(320)
    expect(clampDisplayWidth(Number.NaN)).toBe(320)
  })
  it('原图 → 显示按比例换算', () => {
    expect(toDisplay(60, 320, 260)).toBeCloseTo(48.75)
    expect(maxOffset(320, 60, 320)).toBe(260)
    expect(maxOffset(320, 60, 260)).toBeCloseTo(211.25)
  })
  it('偏移夹在 [0, max]', () => {
    expect(clampOffset(-5, 100)).toBe(0)
    expect(clampOffset(150, 100)).toBe(100)
    expect(clampOffset(33.333, 100)).toBe(33.3)
  })
  it('键盘步长', () => {
    expect(keyboardStep('ArrowLeft', false)).toBe(-2)
    expect(keyboardStep('ArrowRight', true)).toBe(20)
    expect(keyboardStep('a', false)).toBeNull()
  })
})

describe('TrackRecorder', () => {
  it('首点为原点，x/y 相对按下点，t 相对 startTime', () => {
    const r = new TrackRecorder(1000, 50, 80)
    r.sample(60, 81, 1020)
    expect(r.toJSON()).toEqual([
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 1, t: 20 }
    ])
  })
  it('按 16ms 节流，force 不节流', () => {
    const r = new TrackRecorder(0)
    expect(r.sample(1, 0, 5)).toBe(false)
    expect(r.sample(2, 0, 16)).toBe(true)
    expect(r.sample(3, 0, 20, true)).toBe(true)
    expect(r.length).toBe(3)
  })
  it('上限 400 点，末点强制覆盖', () => {
    const r = new TrackRecorder(0)
    for (let i = 1; i < 1000; i++) r.sample(i, 0, i * 16)
    expect(r.length).toBe(TRACK_MAX_POINTS)
    r.sample(999, 3, 20000, true)
    expect(r.length).toBe(TRACK_MAX_POINTS)
    expect(r.toJSON().at(-1)).toEqual({ x: 999, y: 3, t: 20000 })
  })
  it('键盘模式每次按键记一点', () => {
    const r = new TrackRecorder(0)
    r.key(2, 1)
    r.key(4, 2)
    expect(r.toJSON().map((p) => p.x)).toEqual([0, 2, 4])
  })
  it('时间单调不减', () => {
    const r = new TrackRecorder(100)
    r.sample(1, 0, 200, true)
    r.sample(2, 0, 150, true)
    const ts = r.toJSON().map((p) => p.t)
    expect([...ts].sort((a, b) => a - b)).toEqual(ts)
  })
})

describe('buildVerifyPayload', () => {
  it('组装契约字段，bgDisplayWidth 不低于 260', () => {
    const recorder = new TrackRecorder(1000)
    const p = buildVerifyPayload({
      captchaId: 'id',
      displayWidth: 240,
      offset: 123.456,
      inputMode: 'keyboard',
      recorder,
      endTime: 2000
    })
    expect(p).toMatchObject({
      captchaId: 'id',
      bgDisplayWidth: 260,
      startTime: 1000,
      endTime: 2000,
      inputMode: 'keyboard',
      answer: { x: 123.5 }
    })
    expect(p.track[0]).toEqual({ x: 0, y: 0, t: 0 })
  })
})

describe('classifyCaptchaError', () => {
  it('主路径：HTTP 200 + R.code', () => {
    expect(classifyCaptchaError(new HttpError('x', 40010)).kind).toBe('expired')
    expect(classifyCaptchaError(new HttpError('x', 40011)).kind).toBe('failed')
    expect(classifyCaptchaError(new HttpError('x', 40013)).kind).toBe('required')
    expect(classifyCaptchaError(new HttpError('x', 40014)).kind).toBe('disabled')
    const rl = classifyCaptchaError(new HttpError('慢点', 40012, { data: { retryAfter: 30 } }))
    expect(rl).toMatchObject({ kind: 'rateLimited', retryAfter: 30, msg: '慢点' })
  })
  it('兜底：HTTP 非 2xx，R 信封在 data 内', () => {
    const e = new HttpError('x', 429, { data: { code: 40012, msg: 'x', data: { retryAfter: 9 } } })
    expect(classifyCaptchaError(e)).toMatchObject({ kind: 'rateLimited', retryAfter: 9 })
    expect(isCaptchaRequired(new HttpError('x', 400, { data: { code: 40013 } }))).toBe(true)
  })
  it('限流缺 retryAfter 时默认 60', () => {
    expect(classifyCaptchaError(new HttpError('x', 40012)).retryAfter).toBe(60)
  })
  it('网络错误与其他', () => {
    expect(classifyCaptchaError(new HttpError('net', 400)).kind).toBe('network')
    expect(classifyCaptchaError(new HttpError('biz', 1001, { data: null })).kind).toBe('other')
    expect(classifyCaptchaError(new Error('boom')).kind).toBe('other')
  })
})
