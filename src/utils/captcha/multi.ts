/**
 * 多类型行为验证码纯函数：题型分发 / 各题型 answer 构造 / 键盘步长。
 *
 * 题型：SLIDER | ROTATE | WORD_CLICK | ICON_CLICK | JIGSAW（契约 v0.6.1 / mugsun-boot#35）。
 * - 题型只看 challenge 响应 type；config.type 为 RANDOM 或具体类型。
 * - keyboard 题服务端只出 SLIDER / ROTATE；点选与拼图不做键盘操作，切到键盘即重新取题。
 *
 * @module utils/captcha/multi
 */
import type { CaptchaAnswer, InputMode, TrackPoint, VerifyPayload } from './index'
import {
  CaptchaCode,
  clampDisplayWidth,
  classifyCaptchaError,
  type CaptchaErrorInfo
} from './index'

export const CAPTCHA_TYPES = ['SLIDER', 'ROTATE', 'WORD_CLICK', 'ICON_CLICK', 'JIGSAW'] as const
export type BehaviorCaptchaType = (typeof CAPTCHA_TYPES)[number]

/** 支持键盘操作的题型 */
export const KEYBOARD_TYPES: readonly BehaviorCaptchaType[] = ['SLIDER', 'ROTATE']

/** 点选需要点击的数量 */
export const CLICK_COUNT = 3
/** 旋转键盘缺省步长（度）；服务端 keyboard 题必返回 keyboardStep（默认 5），此值仅兜底 */
export const DEFAULT_ROTATE_STEP_DEG = 5
/** 点选命中半径下限（原始像素，契约 §3） */
export const CLICK_MIN_RADIUS = 22
/** 点选命中半径系数：max(itemSize × 0.75, 22) */
export const CLICK_RADIUS_RATIO = 0.75

export type CaptchaPanelKind = 'slider' | 'rotate' | 'click' | 'jigsaw'

export function isBehaviorType(type: unknown): type is BehaviorCaptchaType {
  return typeof type === 'string' && (CAPTCHA_TYPES as readonly string[]).includes(type)
}

/** config.type 是否走行为验证码（RANDOM 或已知具体类型）；其他值回退旧数字码 */
export function isBehaviorConfigType(type: unknown): boolean {
  return type === 'RANDOM' || isBehaviorType(type)
}

/** challenge.type → 面板；未知类型返回 null（调用方回退旧数字码） */
export function resolvePanel(type: unknown): CaptchaPanelKind | null {
  switch (type) {
    case 'SLIDER':
      return 'slider'
    case 'ROTATE':
      return 'rotate'
    case 'WORD_CLICK':
    case 'ICON_CLICK':
      return 'click'
    case 'JIGSAW':
      return 'jigsaw'
    default:
      return null
  }
}

export function supportsKeyboard(type: unknown): boolean {
  return isBehaviorType(type) && KEYBOARD_TYPES.includes(type)
}

/** 角度归一到 [0, 360)，保留一位小数 */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  const v = ((deg % 360) + 360) % 360
  const r = Math.round(v * 10) / 10
  return r >= 360 ? 0 : r
}

/** 滑条偏移 → 角度（满行程 = 360°） */
export function offsetToAngle(offset: number, max: number): number {
  if (!max || max <= 0) return 0
  return normalizeAngle((Math.min(max, Math.max(0, offset)) / max) * 360)
}

/**
 * ROTATE pointer（v0.6.1 §3）：按滑块左边缘位移算，最大行程 = bgDisplayWidth，
 * angle = 位移 / bgDisplayWidth × 360（拖到最右 = 360° ≡ 0°）。
 */
export function rotateTravelToAngle(travel: number, displayWidth: number): number {
  return offsetToAngle(travel, displayWidth)
}

/** 角度 → 左边缘位移（显示像素），offsetToAngle 的逆 */
export function rotateAngleToTravel(angle: number, displayWidth: number): number {
  if (!displayWidth || displayWidth <= 0) return 0
  return Math.round((normalizeAngle(angle) / 360) * displayWidth * 10) / 10
}

/** 服务端施加角 rot → 正确纠正量 (360 − rot) mod 360（契约 §3 例子；仅 mock / 测试用） */
export function correctionAngle(applied: number): number {
  return normalizeAngle(360 - applied)
}

/** 点选命中半径（原始像素）：max(itemSize × 0.75, 22)；itemSize 缺省按下限 */
export function clickHitRadius(itemSize?: number): number {
  const s = Number(itemSize)
  return Number.isFinite(s) && s > 0
    ? Math.max(CLICK_MIN_RADIUS, Math.round(s * CLICK_RADIUS_RATIO))
    : CLICK_MIN_RADIUS
}

/** 显示坐标 → 原图坐标（服务端乘 bgWidth / bgDisplayWidth） */
export function toOriginal(v: number, bgWidth: number, displayWidth: number): number {
  return displayWidth > 0 ? (v * bgWidth) / displayWidth : v
}

/**
 * 外壳被 CSS 缩放时（容器 < 260px，v0.6.1 #7），屏幕像素 → 布局像素的比例。
 * rectWidth = getBoundingClientRect().width，layoutWidth = offsetWidth。
 */
export function cssScale(rectWidth: number, layoutWidth: number): number {
  if (!rectWidth || !layoutWidth) return 1
  const r = rectWidth / layoutWidth
  return Number.isFinite(r) && r > 0 ? r : 1
}

/** 外壳宽度：上报宽度 ≥ 260，容器更窄时整体 scale(container/260) */
export function shellLayout(containerWidth: number): { width: number; scale: number } {
  const width = clampDisplayWidth(containerWidth)
  const scale =
    Number.isFinite(containerWidth) && containerWidth > 0 && containerWidth < width
      ? Math.round((containerWidth / width) * 1000) / 1000
      : 1
  return { width, scale }
}

/** 旋转键盘步长（度），缺省 / 非法回退 5° */
export function rotateKeyboardStep(step: number | undefined): number {
  return step && step > 0 && step < 360 ? step : DEFAULT_ROTATE_STEP_DEG
}

/** 旋转键盘：累计步数夹在 [0, floor(359.9/step)] */
export function clampRotateSteps(steps: number, step: number): number {
  const maxSteps = Math.floor((360 - 1e-6) / step)
  return Math.min(maxSteps, Math.max(0, Math.round(steps)))
}

export interface ClickPoint {
  x: number
  y: number
}

/** 点选提示字：prompt 为数组或整词字符串均可，按字拆分（兼容 2–4 字词语 / 成语） */
export function clickPromptChars(c: { prompt?: unknown; promptNames?: unknown }): string[] {
  const p = c.prompt ?? c.promptNames
  if (Array.isArray(p)) return p.map((v) => String(v))
  if (typeof p === 'string') return Array.from(p.trim())
  return []
}

/** 点选需点击数：只认响应 count（v0.6.2 WORD_CLICK 为 3 或 4）；缺失时回退 3，夹在 [1, 8] */
export function clickTargetCount(c: { count?: unknown }): number {
  const n = Number(c.count)
  return Number.isInteger(n) && n > 0 ? Math.min(8, n) : CLICK_COUNT
}

/**
 * ROTATE 低速精调（契约 v0.6.2 §3，手感 v0.6.3 调整）：
 * 指针持续低速（< ROTATE_SLOW_SPEED px/ms）满 ROTATE_FINE_ENTER_MS 才进入 0.5 倍，
 * 一旦超过阈值立即退出。前端不知道目标位置，用「持续慢」近似「接近目标在对准」，
 * 避免普通拖动末尾自然减速被折半而「拖不到位」。
 */
export const ROTATE_SLOW_SPEED = 0.08
export const ROTATE_SLOW_GAIN = 0.5
export const ROTATE_FINE_ENTER_MS = 150

export class RotateFineTuner {
  private slowSince: number | null = null

  /** 是否处于精调 */
  fine = false

  /**
   * @param dx 本次指针位移（布局像素）
   * @param dt 距上次事件毫秒数
   * @param now 当前时间（ms，单调）
   * @returns 计入逻辑行程的位移
   */
  delta(dx: number, dt: number, now: number): number {
    if (!Number.isFinite(dx)) return 0
    const speed = dt > 0 ? Math.abs(dx) / dt : Math.abs(dx) > 0 ? Infinity : 0
    if (speed < ROTATE_SLOW_SPEED) {
      if (this.slowSince === null) this.slowSince = now
      this.fine = now - this.slowSince >= ROTATE_FINE_ENTER_MS
    } else {
      this.slowSince = null
      this.fine = false
    }
    return this.fine ? dx * ROTATE_SLOW_GAIN : dx
  }

  reset(): void {
    this.slowSince = null
    this.fine = false
  }
}

/** 读屏用提示：WORD_CLICK 拼成整词（「一帆风顺」），ICON_CLICK 用空格分隔名称 */
export function clickPromptLabel(c: { type?: string; prompt?: unknown; promptNames?: unknown }) {
  const chars = clickPromptChars(c)
  return c.type === 'WORD_CLICK' ? chars.join('') : chars.join(' ')
}

/** 点选：追加一个点（已满不追加），返回新数组 */
export function addClickPoint(
  points: ClickPoint[],
  p: ClickPoint,
  limit = CLICK_COUNT
): ClickPoint[] {
  if (points.length >= limit) return points
  return [...points, { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }]
}

/** 点选撤销：移除序号 index（0 起）及其之后的点；缺省撤销最后一个 */
export function undoClickPoint(points: ClickPoint[], index = points.length - 1): ClickPoint[] {
  if (index < 0) return points
  return points.slice(0, index)
}

/** 拼图：交换两个位置，返回新数组 */
export function swapTiles(order: number[], a: number, b: number): number[] {
  if (a === b || a < 0 || b < 0 || a >= order.length || b >= order.length) return order
  const next = order.slice()
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/** 拼图初始排列：每个位置放自己序号的打乱格 */
export function initialOrder(grid: number, cols = grid): number[] {
  return Array.from({ length: grid * cols }, (_, i) => i)
}

/** 拼图格在打乱图中的背景偏移（百分比） */
export function tileBackgroundPosition(index: number, grid: number): string {
  const col = index % grid
  const row = Math.floor(index / grid)
  const step = grid > 1 ? 100 / (grid - 1) : 0
  return `${col * step}% ${row * step}%`
}

export function buildRotateAnswer(angle: number): CaptchaAnswer {
  return { angle: normalizeAngle(angle) }
}

export function buildClickAnswer(points: ClickPoint[]): CaptchaAnswer {
  return {
    points: points.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }))
  }
}

export function buildJigsawAnswer(order: number[]): CaptchaAnswer {
  return { order: order.slice() }
}

/** 面板提交的部分（壳组件补 captchaId / bgDisplayWidth / inputMode） */
export interface PanelSubmit {
  answer: CaptchaAnswer
  track: TrackPoint[]
  startTime: number
  endTime: number
  keyPresses: number | null
}

export function buildPayload(input: {
  captchaId: string
  displayWidth: number
  inputMode: InputMode
  part: PanelSubmit
}): VerifyPayload {
  const { part } = input
  return {
    captchaId: input.captchaId,
    bgDisplayWidth: clampDisplayWidth(input.displayWidth),
    startTime: part.startTime,
    endTime: part.endTime,
    inputMode: input.inputMode,
    track: part.track,
    answer: part.answer,
    keyPresses: input.inputMode === 'keyboard' ? (part.keyPresses ?? 0) : null
  }
}

/**
 * verify 阶段错误分类（v0.4）：
 * - 40012（触发锁定的那次失败）→ rateLimited，带 retryAfter，壳组件立即倒计时；
 * - 连接错误 / 被截断 → 按 40011 处理（failed，换图重试）。
 */
export function classifyVerifyError(err: unknown): CaptchaErrorInfo {
  const info = classifyCaptchaError(err)
  if (info.kind === 'network') return { ...info, kind: 'failed', code: CaptchaCode.FAILED }
  return info
}
