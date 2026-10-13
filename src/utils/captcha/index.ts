/**
 * 滑块拼图验证码纯函数（轨迹采集 / 坐标缩放 / 错误码分类）
 *
 * 契约 v0.2：answer.x 为拼图块左边缘在显示底图中的 x（显示像素），服务端自行换算原图；
 * 前端不做误差判断。track.x/y 为相对按下点位移，t 为相对 startTime 毫秒。
 *
 * @module utils/captcha
 */
import { HttpError } from '@/utils/http/error'

/** 底图显示宽度下限（服务端拒绝 bgDisplayWidth < 260） */
export const CAPTCHA_MIN_WIDTH = 260
/** 底图显示宽度上限 */
export const CAPTCHA_MAX_WIDTH = 320
/** 轨迹采样间隔（ms） */
export const TRACK_SAMPLE_MS = 16
/** 轨迹点上限（服务端超出 400 拒绝） */
export const TRACK_MAX_POINTS = 400
/** 键盘微调步长 / Shift 大步步长（显示像素） */
export const KEY_STEP = 2
export const KEY_STEP_LARGE = 20

/** 错误码（R.code） */
export const CaptchaCode = {
  EXPIRED: 40010,
  FAILED: 40011,
  RATE_LIMITED: 40012,
  REQUIRED: 40013,
  DISABLED: 40014
} as const

export interface TrackPoint {
  x: number
  y: number
  t: number
}

export type InputMode = 'pointer' | 'keyboard'

/** 容器宽度 → 底图显示宽度，夹在 [260, 320] */
export function clampDisplayWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth)) return CAPTCHA_MAX_WIDTH
  return Math.round(Math.min(CAPTCHA_MAX_WIDTH, Math.max(CAPTCHA_MIN_WIDTH, containerWidth)))
}

/** 原图尺寸 → 显示尺寸 */
export function toDisplay(value: number, bgWidth: number, displayWidth: number): number {
  if (!bgWidth) return value
  return (value * displayWidth) / bgWidth
}

/** 拼图块可移动的最大偏移（显示像素） */
export function maxOffset(bgWidth: number, pieceWidth: number, displayWidth: number): number {
  return Math.max(0, toDisplay(bgWidth - pieceWidth, bgWidth, displayWidth))
}

/** 把偏移夹在 [0, max]，保留一位小数 */
export function clampOffset(value: number, max: number): number {
  return Math.round(Math.min(max, Math.max(0, value)) * 10) / 10
}

/** 键盘步进：←/→ 微调，Shift 大步；非方向键返回 null */
export function keyboardStep(key: string, shift: boolean): number | null {
  const step = shift ? KEY_STEP_LARGE : KEY_STEP
  if (key === 'ArrowLeft' || key === 'Left') return -step
  if (key === 'ArrowRight' || key === 'Right') return step
  return null
}

/**
 * 轨迹记录器：按 ~16ms 节流采样，上限 400 点；末点强制写入（保证末点与 answer.x 一致）。
 */
export class TrackRecorder {
  readonly startTime: number
  private readonly originX: number
  private readonly originY: number
  private readonly points: TrackPoint[] = []
  private lastT = -Infinity

  constructor(startTime: number, originX = 0, originY = 0) {
    this.startTime = startTime
    this.originX = originX
    this.originY = originY
    this.points.push({ x: 0, y: 0, t: 0 })
    this.lastT = 0
  }

  /** 采样一个绝对坐标点；返回是否写入 */
  sample(absX: number, absY: number, now: number, force = false): boolean {
    const t = Math.max(0, Math.round(now - this.startTime))
    if (!force && t - this.lastT < TRACK_SAMPLE_MS) return false
    const point = {
      x: Math.round((absX - this.originX) * 10) / 10,
      y: Math.round((absY - this.originY) * 10) / 10,
      t: Math.max(t, this.lastT)
    }
    if (this.points.length >= TRACK_MAX_POINTS) {
      if (!force) return false
      this.points[this.points.length - 1] = point
    } else {
      this.points.push(point)
    }
    this.lastT = point.t
    return true
  }

  /** 键盘模式：每次按键记一个点（x 为当前偏移），不节流 */
  key(offset: number, now: number): void {
    this.sample(this.originX + offset, this.originY, now, true)
  }

  get length(): number {
    return this.points.length
  }

  toJSON(): TrackPoint[] {
    return this.points.map((p) => ({ ...p }))
  }
}

export interface VerifyPayload {
  captchaId: string
  bgDisplayWidth: number
  startTime: number
  endTime: number
  inputMode: InputMode
  track: TrackPoint[]
  answer: { x: number }
}

/** 组装 verify 请求体 */
export function buildVerifyPayload(input: {
  captchaId: string
  displayWidth: number
  offset: number
  inputMode: InputMode
  recorder: TrackRecorder
  endTime: number
}): VerifyPayload {
  return {
    captchaId: input.captchaId,
    bgDisplayWidth: clampDisplayWidth(input.displayWidth),
    startTime: input.recorder.startTime,
    endTime: input.endTime,
    inputMode: input.inputMode,
    track: input.recorder.toJSON(),
    answer: { x: Math.round(input.offset * 10) / 10 }
  }
}

export type CaptchaErrorKind =
  | 'expired'
  | 'failed'
  | 'rateLimited'
  | 'required'
  | 'disabled'
  | 'network'
  | 'other'

export interface CaptchaErrorInfo {
  kind: CaptchaErrorKind
  code?: number
  msg: string
  retryAfter?: number
}

function pickData(err: unknown): Record<string, unknown> | undefined {
  if (!err || typeof err !== 'object') return undefined
  const data = (err as { data?: unknown }).data
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined
}

/**
 * 错误分类。主路径：HTTP 200 + R.code（HttpError.code 即 R.code，HttpError.data 为 R.data）。
 * 兜底：HTTP 非 2xx 时 HttpError.code 为 HTTP 状态，R 信封在 HttpError.data 内。
 */
export function classifyCaptchaError(err: unknown): CaptchaErrorInfo {
  const msg = err instanceof Error ? err.message : ''
  let code: number | undefined
  let payload = pickData(err)
  if (err instanceof HttpError || (err && typeof err === 'object' && 'code' in err)) {
    const c = Number((err as { code?: unknown }).code)
    if (Number.isFinite(c)) code = c
  }
  // 非 2xx 兜底：data 是完整 R 信封
  if (
    payload &&
    typeof payload.code === 'number' &&
    payload.code >= 40010 &&
    payload.code <= 40014
  ) {
    code = payload.code
    payload = (payload.data && typeof payload.data === 'object' ? payload.data : undefined) as
      | Record<string, unknown>
      | undefined
  }
  const base = { code, msg }
  switch (code) {
    case CaptchaCode.EXPIRED:
      return { ...base, kind: 'expired' }
    case CaptchaCode.FAILED:
      return { ...base, kind: 'failed' }
    case CaptchaCode.RATE_LIMITED: {
      const ra = Number(payload?.retryAfter)
      return { ...base, kind: 'rateLimited', retryAfter: Number.isFinite(ra) && ra > 0 ? ra : 60 }
    }
    case CaptchaCode.REQUIRED:
      return { ...base, kind: 'required' }
    case CaptchaCode.DISABLED:
      return { ...base, kind: 'disabled' }
  }
  const isNetwork =
    (err instanceof HttpError &&
      !err.data &&
      (code === undefined || code === 400 || (code >= 500 && code < 600))) ||
    (err instanceof TypeError && /fetch|network/i.test(err.message))
  return { ...base, kind: isNetwork ? 'network' : 'other' }
}

/** 业务接口是否返回 CAPTCHA_REQUIRED */
export function isCaptchaRequired(err: unknown): boolean {
  return classifyCaptchaError(err).kind === 'required'
}
