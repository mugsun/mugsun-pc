/**
 * 多类型行为验证码纯函数：题型分发 / 各题型 answer 构造 / 键盘步长。
 *
 * 题型：SLIDER | ROTATE | WORD_CLICK | ICON_CLICK | JIGSAW（假设字段，待契约 v0.5 定稿）。
 * - 题型只看 challenge 响应 type；config.type 为 RANDOM 或具体类型。
 * - keyboard 题服务端只出 SLIDER / ROTATE；点选与拼图不做键盘操作，切到键盘即重新取题。
 *
 * @module utils/captcha/multi
 */
import type { CaptchaAnswer, InputMode, TrackPoint, VerifyPayload } from './index'
import { clampDisplayWidth } from './index'

export const CAPTCHA_TYPES = ['SLIDER', 'ROTATE', 'WORD_CLICK', 'ICON_CLICK', 'JIGSAW'] as const
export type BehaviorCaptchaType = (typeof CAPTCHA_TYPES)[number]

/** 支持键盘操作的题型 */
export const KEYBOARD_TYPES: readonly BehaviorCaptchaType[] = ['SLIDER', 'ROTATE']

/** 点选需要点击的数量 */
export const CLICK_COUNT = 3
/** 旋转键盘缺省步长（度） */
export const DEFAULT_ROTATE_STEP_DEG = 5

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
export function initialOrder(grid: number): number[] {
  return Array.from({ length: grid * grid }, (_, i) => i)
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
