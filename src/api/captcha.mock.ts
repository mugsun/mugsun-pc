/**
 * 滑块验证码开发期 mock（仅 DEV + VITE_CAPTCHA_MOCK=true 时由 api/captcha.ts 动态加载）
 * canvas 生成纯色底图 + 缺口，输出 data URL；校验规则模拟服务端：一次一机会、±5px（原图）、
 * 时长 / 点数下限（容差 ±6px 原图，与 v0.2 一致）、连续失败 5 次限流 10 秒。
 */
import { HttpError } from '@/utils/http/error'
import { CaptchaCode, CAPTCHA_MIN_WIDTH, type VerifyPayload } from '@/utils/captcha'
import type { CaptchaChallenge, CaptchaConfig, CaptchaVerifyResult } from './captcha'

const BG_W = 320
const BG_H = 180
const PIECE = 46
const PIECE_W = 68
const EXPIRE = 120
const TOLERANCE = 6

const store = new Map<string, { x: number; expireAt: number }>()
let fails = 0
let lockedUntil = 0

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const rid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')

function fail(code: number, msg: string, data?: unknown): never {
  throw new HttpError(msg, code, { data })
}

function pieceShape(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const r = 8
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + PIECE / 2 - r, y)
  ctx.arc(x + PIECE / 2, y, r, Math.PI, 0)
  ctx.lineTo(x + PIECE, y)
  ctx.lineTo(x + PIECE, y + PIECE)
  ctx.lineTo(x, y + PIECE)
  ctx.closePath()
}

export async function mockConfig(scene: string): Promise<CaptchaConfig> {
  await delay(60)
  return { enabled: true, type: 'SLIDER', scene }
}

export async function mockChallenge(): Promise<CaptchaChallenge> {
  await delay()
  if (Date.now() < lockedUntil) {
    fail(CaptchaCode.RATE_LIMITED, '操作过于频繁，请稍后再试', {
      retryAfter: Math.ceil((lockedUntil - Date.now()) / 1000)
    })
  }
  const x = 90 + Math.floor(Math.random() * (BG_W - PIECE_W - 100))
  const y = 30 + Math.floor(Math.random() * (BG_H - PIECE - 50))
  const bg = document.createElement('canvas')
  bg.width = BG_W
  bg.height = BG_H
  const b = bg.getContext('2d')!
  b.fillStyle = '#E6F4FF'
  b.fillRect(0, 0, BG_W, BG_H)
  b.fillStyle = '#cfe6fb'
  for (let i = 0; i < 6; i++) b.fillRect(i * 60 + 10, ((i * 37) % 120) + 10, 30, 30)
  pieceShape(b, x, y)
  b.fillStyle = 'rgba(0,0,0,0.35)'
  b.fill()
  b.strokeStyle = 'rgba(255,255,255,0.8)'
  b.stroke()

  const pc = document.createElement('canvas')
  pc.width = PIECE_W
  pc.height = BG_H
  const p = pc.getContext('2d')!
  pieceShape(p, (PIECE_W - PIECE) / 2, y)
  p.fillStyle = '#7fb8ee'
  p.fill()
  p.strokeStyle = '#ffffff'
  p.lineWidth = 2
  p.stroke()

  const captchaId = rid()
  // 块左边缘 = 缺口 x - 透明边距
  store.set(captchaId, { x: x - (PIECE_W - PIECE) / 2, expireAt: Date.now() + EXPIRE * 1000 })
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__captchaMockAnswer = x - (PIECE_W - PIECE) / 2
  }
  return {
    captchaId,
    type: 'SLIDER',
    background: bg.toDataURL('image/jpeg', 0.9),
    piece: pc.toDataURL('image/png'),
    bgWidth: BG_W,
    bgHeight: BG_H,
    pieceWidth: PIECE_W,
    pieceHeight: BG_H,
    expireSeconds: EXPIRE
  }
}

export async function mockVerify(data: VerifyPayload): Promise<CaptchaVerifyResult> {
  await delay(350)
  if (Date.now() < lockedUntil) {
    fail(CaptchaCode.RATE_LIMITED, '操作过于频繁，请稍后再试', {
      retryAfter: Math.ceil((lockedUntil - Date.now()) / 1000)
    })
  }
  const entry = store.get(data.captchaId)
  store.delete(data.captchaId)
  if (!entry || entry.expireAt < Date.now()) fail(CaptchaCode.EXPIRED, '验证码已过期')
  const real = (data.answer.x * BG_W) / data.bgDisplayWidth
  const dur = data.endTime - data.startTime
  const ok =
    data.bgDisplayWidth >= CAPTCHA_MIN_WIDTH &&
    Math.abs(real - entry!.x) <= TOLERANCE &&
    dur >= 300 &&
    dur <= 15000 &&
    (data.inputMode === 'keyboard'
      ? (data.keyPresses ?? 0) >= 3 && dur >= 600
      : data.track.length >= 8) &&
    data.track.length <= 400
  if (!ok) {
    fails++
    if (fails >= 5) {
      fails = 0
      lockedUntil = Date.now() + 10_000
      fail(CaptchaCode.RATE_LIMITED, '失败次数过多，请稍后再试', { retryAfter: 10 })
    }
    fail(CaptchaCode.FAILED, '验证失败，请再试一次')
  }
  fails = 0
  return { captchaToken: `mock-${rid()}`, expireSeconds: 120 }
}
