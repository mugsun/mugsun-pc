/**
 * 行为验证码开发期 mock（仅 DEV + VITE_CAPTCHA_MOCK=true 时由 api/captcha.ts 动态加载，生产产物不含）。
 * 五种题型：SLIDER / ROTATE / WORD_CLICK / ICON_CLICK / JIGSAW，canvas 生成占位图。
 *
 * 指定题型（仅 mock）：URL `?captchaType=ROTATE` 或 sessionStorage `captchaMockType`；缺省随机。
 * keyboard 题只出 SLIDER / ROTATE（与后端约定一致）。
 * 规则模拟服务端：一次一机会、过期 120s、连续失败 5 次限流 10 秒；容差放宽（难度低）。
 */
import { HttpError } from '@/utils/http/error'
import {
  CaptchaCode,
  CAPTCHA_MIN_WIDTH,
  CAPTCHA_TYPES,
  CLICK_COUNT,
  DEFAULT_KEYBOARD_STEP_PX,
  DEFAULT_ROTATE_STEP_DEG,
  KEYBOARD_TYPES,
  isBehaviorType,
  type BehaviorCaptchaType,
  type InputMode,
  type VerifyPayload
} from '@/utils/captcha'
import type { CaptchaChallenge, CaptchaConfig, CaptchaVerifyResult } from './captcha'

const BG_W = 320
const BG_H = 180
const PIECE = 46
const PIECE_W = 68
const ROT_SIZE = 200
const EXPIRE = 120
const TOLERANCE = 6
const ROT_TOLERANCE = 12
const CLICK_RADIUS = 24

type Answer =
  | { type: 'SLIDER'; x: number }
  | { type: 'ROTATE'; angle: number }
  | { type: 'CLICK'; points: { x: number; y: number }[] }
  | { type: 'JIGSAW'; order: number[] }

const store = new Map<string, { answer: Answer; expireAt: number; inputMode: InputMode }>()
let fails = 0
let lockedUntil = 0

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const rid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')

function fail(code: number, msg: string, data?: unknown): never {
  throw new HttpError(msg, code, { data })
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** 浅蓝占位底图：渐变 + 山形 + 太阳，带方向感（旋转题需能看出“正”） */
function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#BFD3FF')
  g.addColorStop(1, '#ECF2FF')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#FFD66B'
  ctx.beginPath()
  ctx.arc(w * 0.78, h * 0.25, h * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8FB0FF'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(w * 0.28, h * 0.45)
  ctx.lineTo(w * 0.5, h * 0.75)
  ctx.lineTo(w * 0.7, h * 0.5)
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#5D87FF'
  ctx.fillRect(0, h * 0.86, w, h * 0.14)
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

function pickType(inputMode: InputMode): BehaviorCaptchaType {
  let forced: string | null = null
  try {
    forced =
      new URLSearchParams(location.search).get('captchaType') ||
      sessionStorage.getItem('captchaMockType')
  } catch {
    forced = null
  }
  const pool: readonly BehaviorCaptchaType[] =
    inputMode === 'keyboard' ? KEYBOARD_TYPES : CAPTCHA_TYPES
  if (forced && isBehaviorType(forced) && pool.includes(forced)) return forced
  return pool[rand(0, pool.length - 1)]
}

function genSlider() {
  const x = 90 + rand(0, BG_W - PIECE_W - 100)
  const y = 30 + rand(0, BG_H - PIECE - 50)
  const [bg, b] = canvas(BG_W, BG_H)
  paintScene(b, BG_W, BG_H)
  pieceShape(b, x, y)
  b.fillStyle = 'rgba(0,0,0,0.35)'
  b.fill()
  b.strokeStyle = 'rgba(255,255,255,0.8)'
  b.stroke()
  const [pc, p] = canvas(PIECE_W, BG_H)
  pieceShape(p, (PIECE_W - PIECE) / 2, y)
  p.fillStyle = '#7fb8ee'
  p.fill()
  p.strokeStyle = '#ffffff'
  p.lineWidth = 2
  p.stroke()
  const answerX = x - (PIECE_W - PIECE) / 2
  return {
    answer: { type: 'SLIDER', x: answerX } as Answer,
    data: {
      type: 'SLIDER' as const,
      background: bg.toDataURL('image/jpeg', 0.9),
      piece: pc.toDataURL('image/png'),
      bgWidth: BG_W,
      bgHeight: BG_H,
      pieceWidth: PIECE_W,
      pieceHeight: BG_H
    },
    hint: answerX
  }
}

function genRotate() {
  // 图片被逆时针转了 r°，用户顺时针转 r° 即正
  const r = rand(40, 320)
  const [c, ctx] = canvas(ROT_SIZE, ROT_SIZE)
  ctx.save()
  ctx.beginPath()
  ctx.arc(ROT_SIZE / 2, ROT_SIZE / 2, ROT_SIZE / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(ROT_SIZE / 2, ROT_SIZE / 2)
  ctx.rotate((-r * Math.PI) / 180)
  ctx.translate(-ROT_SIZE / 2, -ROT_SIZE / 2)
  paintScene(ctx, ROT_SIZE, ROT_SIZE)
  ctx.restore()
  return {
    answer: { type: 'ROTATE', angle: r } as Answer,
    data: { type: 'ROTATE' as const, image: c.toDataURL('image/png'), imageSize: ROT_SIZE },
    hint: r
  }
}

const WORDS = '春夏秋冬山水云风花月星雨'.split('')
const ICONS: { draw: (c: CanvasRenderingContext2D, s: number) => void }[] = [
  { draw: (c, s) => (c.beginPath(), c.arc(0, 0, s, 0, Math.PI * 2), c.fill()) },
  { draw: (c, s) => c.fillRect(-s, -s, s * 2, s * 2) },
  {
    draw: (c, s) => {
      c.beginPath()
      c.moveTo(0, -s)
      c.lineTo(s, s)
      c.lineTo(-s, s)
      c.closePath()
      c.fill()
    }
  },
  {
    draw: (c, s) => {
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2
        const rr = i % 2 ? s * 0.45 : s
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
      }
      c.closePath()
      c.fill()
    }
  },
  {
    draw: (c, s) => {
      c.fillRect(-s, -s * 0.3, s * 2, s * 0.6)
      c.fillRect(-s * 0.3, -s, s * 0.6, s * 2)
    }
  }
]

function iconImage(i: number) {
  const [c, ctx] = canvas(40, 40)
  ctx.translate(20, 20)
  ctx.fillStyle = '#2B4FCC'
  ICONS[i].draw(ctx, 13)
  return c.toDataURL('image/png')
}

/** 不重叠的点位（原图坐标） */
function spots(n: number) {
  const pts: { x: number; y: number }[] = []
  while (pts.length < n) {
    const p = { x: rand(30, BG_W - 30), y: rand(28, BG_H - 28) }
    if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 60)) pts.push(p)
  }
  return pts
}

function shuffle<T>(arr: T[]) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function genClick(kind: 'WORD_CLICK' | 'ICON_CLICK') {
  const total = CLICK_COUNT + 1 // 多一个干扰项
  const pool =
    kind === 'WORD_CLICK' ? shuffle(WORDS.map((_, i) => i)) : shuffle(ICONS.map((_, i) => i))
  const chosen = pool.slice(0, total)
  const pts = spots(total)
  const [bg, b] = canvas(BG_W, BG_H)
  paintScene(b, BG_W, BG_H)
  chosen.forEach((id, i) => {
    const p = pts[i]
    b.save()
    b.translate(p.x, p.y)
    b.fillStyle = 'rgba(255,255,255,0.85)'
    b.beginPath()
    b.arc(0, 0, 19, 0, Math.PI * 2)
    b.fill()
    b.fillStyle = '#2B4FCC'
    if (kind === 'WORD_CLICK') {
      b.rotate(((i % 2 ? 1 : -1) * rand(5, 20) * Math.PI) / 180)
      b.font = 'bold 24px "PingFang SC","Microsoft YaHei",sans-serif'
      b.textAlign = 'center'
      b.textBaseline = 'middle'
      b.fillText(WORDS[id], 0, 1)
    } else {
      ICONS[id].draw(b, 12)
    }
    b.restore()
  })
  const targets = pts.slice(0, CLICK_COUNT)
  const ids = chosen.slice(0, CLICK_COUNT)
  return {
    answer: { type: 'CLICK', points: targets } as Answer,
    data: {
      type: kind,
      background: bg.toDataURL('image/jpeg', 0.9),
      bgWidth: BG_W,
      bgHeight: BG_H,
      hints: kind === 'WORD_CLICK' ? ids.map((i) => WORDS[i]) : ids.map(iconImage)
    },
    hint: targets
  }
}

function genJigsaw() {
  const grid = 2
  const n = grid * grid
  let perm = shuffle(Array.from({ length: n }, (_, i) => i))
  while (perm.every((v, i) => v === i)) perm = shuffle(perm)
  // 原图
  const [src, s] = canvas(BG_W, BG_H)
  paintScene(s, BG_W, BG_H)
  s.fillStyle = '#ffffff'
  s.font = 'bold 30px sans-serif'
  s.textAlign = 'center'
  s.fillText('MUGSUN', BG_W / 2, BG_H * 0.62)
  // 打乱图：打乱格 k 放原图第 perm[k] 块
  const [out, o] = canvas(BG_W, BG_H)
  const cw = BG_W / grid
  const ch = BG_H / grid
  perm.forEach((orig, k) => {
    o.drawImage(
      src,
      (orig % grid) * cw,
      Math.floor(orig / grid) * ch,
      cw,
      ch,
      (k % grid) * cw,
      Math.floor(k / grid) * ch,
      cw,
      ch
    )
  })
  // 还原：位置 p 应放“装着原图 p 块”的打乱格 k，即 perm[k] === p
  const order = Array.from({ length: n }, (_, p) => perm.indexOf(p))
  return {
    answer: { type: 'JIGSAW', order } as Answer,
    data: {
      type: 'JIGSAW' as const,
      image: out.toDataURL('image/jpeg', 0.9),
      bgWidth: BG_W,
      bgHeight: BG_H,
      grid
    },
    hint: order
  }
}

export async function mockConfig(scene: string): Promise<CaptchaConfig> {
  await delay(60)
  return { enabled: true, type: 'RANDOM', scene }
}

function checkLock() {
  if (Date.now() < lockedUntil) {
    fail(CaptchaCode.RATE_LIMITED, '操作过于频繁，请稍后再试', {
      retryAfter: Math.ceil((lockedUntil - Date.now()) / 1000)
    })
  }
}

export async function mockChallenge(inputMode: InputMode = 'pointer'): Promise<CaptchaChallenge> {
  await delay()
  checkLock()
  const mode: InputMode = inputMode === 'keyboard' ? 'keyboard' : 'pointer'
  const type = pickType(mode)
  const gen =
    type === 'SLIDER'
      ? genSlider()
      : type === 'ROTATE'
        ? genRotate()
        : type === 'JIGSAW'
          ? genJigsaw()
          : genClick(type)
  const captchaId = rid()
  store.set(captchaId, {
    answer: gen.answer,
    expireAt: Date.now() + EXPIRE * 1000,
    inputMode: mode
  })
  ;(window as unknown as Record<string, unknown>).__captchaMockAnswer = gen.hint
  const keyboardStep =
    mode === 'keyboard'
      ? type === 'ROTATE'
        ? DEFAULT_ROTATE_STEP_DEG
        : DEFAULT_KEYBOARD_STEP_PX
      : undefined
  return {
    captchaId,
    inputMode: mode,
    expireSeconds: EXPIRE,
    ...(keyboardStep ? { keyboardStep } : {}),
    ...gen.data
  } as CaptchaChallenge
}

function judge(answer: Answer, data: VerifyPayload): boolean {
  const scale = BG_W / data.bgDisplayWidth
  const a = data.answer as Record<string, unknown>
  const dur = data.endTime - data.startTime
  const kb = data.inputMode === 'keyboard'
  const presses = data.keyPresses ?? 0
  switch (answer.type) {
    case 'SLIDER': {
      const real = Number(a.x) * scale
      const modeOk = kb
        ? presses >= 3 &&
          dur >= 600 &&
          Math.abs(presses - Math.round(real / DEFAULT_KEYBOARD_STEP_PX)) <= 1
        : dur >= 300 && data.track.length >= 8
      return modeOk && Math.abs(real - answer.x) <= TOLERANCE
    }
    case 'ROTATE': {
      const angle = Number(a.angle)
      const diff = Math.abs(((angle - answer.angle + 540) % 360) - 180)
      const modeOk = kb
        ? presses >= 3 && Math.abs(presses - Math.round(angle / DEFAULT_ROTATE_STEP_DEG)) <= 1
        : dur >= 300 && data.track.length >= 4
      return modeOk && diff <= ROT_TOLERANCE
    }
    case 'CLICK': {
      const pts = a.points as { x: number; y: number }[] | undefined
      if (!Array.isArray(pts) || pts.length !== answer.points.length || kb) return false
      return pts.every(
        (p, i) =>
          Math.hypot(p.x * scale - answer.points[i].x, p.y * scale - answer.points[i].y) <=
          CLICK_RADIUS
      )
    }
    case 'JIGSAW': {
      const order = a.order as number[] | undefined
      return !kb && Array.isArray(order) && order.join(',') === answer.order.join(',')
    }
  }
}

export async function mockVerify(data: VerifyPayload): Promise<CaptchaVerifyResult> {
  await delay(350)
  checkLock()
  const entry = store.get(data.captchaId)
  store.delete(data.captchaId)
  if (!entry || entry.expireAt < Date.now()) fail(CaptchaCode.EXPIRED, '验证码已过期')
  const ok =
    (data.inputMode || 'pointer') === entry.inputMode &&
    data.bgDisplayWidth >= CAPTCHA_MIN_WIDTH &&
    judge(entry.answer, data)
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
