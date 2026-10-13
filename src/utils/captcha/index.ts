/**
 * 滑块拼图验证码纯函数（轨迹采集 / 坐标缩放 / 错误码分类）
 *
 * 契约 v0.3：answer.x 为拼图块左边缘在显示底图中的 x（显示像素），服务端自行换算原图；
 * challenge 时声明 inputMode；keyboardStep 为原图像素；keyPresses 须与落点按步长一致（±1）。
 * track.x/y 为相对按下点位移，t 为相对 startTime 毫秒。
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
/** 缺省键盘原图步长（challenge 未返回 keyboardStep 时回退） */
export const DEFAULT_KEYBOARD_STEP_PX = 4
/** Shift 大步倍率（相对 keyboardStep） */
export const KEY_SHIFT_MULTIPLIER = 10

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

/**
 * 将服务端 keyboardStep（原图像素）换算为显示像素步长。
 * 缺省 / 非法时回退 DEFAULT_KEYBOARD_STEP_PX。
 */
export function displayKeyboardStep(
  keyboardStepPx: number | undefined,
  bgWidth: number,
  displayWidth: number
): number {
  const raw = keyboardStepPx && keyboardStepPx > 0 ? keyboardStepPx : DEFAULT_KEYBOARD_STEP_PX
  return toDisplay(raw, bgWidth || 320, displayWidth)
}

/**
 * 键盘方向键 → 步数（+正向 / −反向；Shift 为大步倍率）。
 * 非方向键返回 null。显示位移 = count × displayKeyboardStep(...)。
 */
export function keyboardPressCount(key: string, shift: boolean): number | null {
  const n = shift ? KEY_SHIFT_MULTIPLIER : 1
  if (key === 'ArrowLeft' || key === 'Left') return -n
  if (key === 'ArrowRight' || key === 'Right') return n
  return null
}

/** @deprecated 用 keyboardPressCount + displayKeyboardStep；保留给旧测试过渡 */
export function keyboardStep(key: string, shift: boolean, baseStep?: number): number | null {
  const count = keyboardPressCount(key, shift)
  if (count === null) return null
  const base = baseStep && baseStep > 0 ? baseStep : DEFAULT_KEYBOARD_STEP_PX
  return count * base
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
  private keys = 0

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

  /**
   * 键盘模式：记一个点（x 为当前偏移），并累计按键次数。
   * @param presses 本次按键计入的次数（Shift 大步传 10）
   */
  key(offset: number, now: number, presses = 1): void {
    this.keys += Math.max(1, Math.abs(Math.round(presses)))
    this.sample(this.originX + offset, this.originY, now, true)
  }

  /** 键盘模式累计按键次数（与落点步数对齐，可 setKeyPresses 覆盖） */
  get keyPresses(): number {
    return this.keys
  }

  /** 将按键次数设为与最终落点一致的步数（允许用户左右修正后仍通过校验） */
  setKeyPresses(n: number): void {
    this.keys = Math.max(0, Math.round(n))
  }

  get length(): number {
    return this.points.length
  }

  toJSON(): TrackPoint[] {
    return this.points.map((p) => ({ ...p }))
  }
}

/** 各题型答案（多类型为假设字段，待契约 v0.5） */
export type CaptchaAnswer =
  | { x: number }
  | { angle: number }
  | { points: { x: number; y: number }[] }
  | { order: number[] }

export interface VerifyPayload {
  captchaId: string
  bgDisplayWidth: number
  startTime: number
  endTime: number
  inputMode: InputMode
  track: TrackPoint[]
  answer: CaptchaAnswer
  /** keyboard 模式必填：按键次数；pointer 模式为 null */
  keyPresses: number | null
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
    answer: { x: Math.round(input.offset * 10) / 10 },
    keyPresses: input.inputMode === 'keyboard' ? input.recorder.keyPresses : null
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

export * from './multi'
