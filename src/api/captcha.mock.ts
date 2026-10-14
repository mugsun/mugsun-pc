/**
 * 行为验证码开发期 mock（仅 DEV + VITE_CAPTCHA_MOCK=true 时由 api/captcha.ts 动态加载，生产产物不含）。
 * 五种题型：SLIDER / ROTATE / WORD_CLICK / ICON_CLICK / JIGSAW，canvas 生成占位图；响应形状对齐契约 v0.6.1。
 *
 * 指定题型（仅 mock）：URL `?captchaType=ROTATE` 或 sessionStorage `captchaMockType`；缺省随机。
 * keyboard 题只出 SLIDER / ROTATE（与后端约定一致）。
 * 规则模拟服务端：一次一机会、过期 120s、连续失败 5 次限流 10 秒。
 * 难度：滑块 ±8px、旋转 ±10°（同服务端，可配，见 rotTolerance）（真实服务端 ±10°，键盘 5°/步，施加角为步长整数倍）、
 * 点选：文字为 3–4 字词语 / 成语（字数 = count）+ 1–2 干扰字（prompt 整词字符串），图标 3 目标 + 2 干扰、半径 max(itemSize×0.75, 22)（与服务端同式）、拼图 2×2 只交换一对（一步还原）。
 * 模拟 40015：sessionStorage `captchaMockNoKeyboard=1` 时 keyboard 取题返回 40015。
 */
import { HttpError } from '@/utils/http/error'
import {
  CaptchaCode,
  CAPTCHA_MIN_WIDTH,
  CAPTCHA_TYPES,
  CLICK_COUNT,
  DEFAULT_KEYBOARD_STEP_PX,
  KEYBOARD_TYPES,
  clickHitRadius,
  correctionAngle,
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
const ROT_SIZE = 160
const EXPIRE = 120
const TOLERANCE = 8
/**
 * mock 旋转容差（度），可配：sessionStorage `captchaMockRotateTol` > env `VITE_CAPTCHA_MOCK_ROTATE_TOL` > 10（同服务端 v0.6.2）。
 * 用于预演服务端收紧（v0.6.1 为 10°，v0.6.2 计划 7°）时的手感。
 */
function rotTolerance(): number {
  let v: unknown
  try {
    v = sessionStorage.getItem('captchaMockRotateTol')
  } catch {
    v = null
  }
  const n = Number(v ?? import.meta.env.VITE_CAPTCHA_MOCK_ROTATE_TOL ?? 10)
  return Number.isFinite(n) && n > 0 && n <= 180 ? n : 10
}
const ITEM_SIZE = 32
const CLICK_DECOYS = 2
const ROTATE_KEY_STEP = 5
const TILE_W = BG_W / 2
const TILE_H = BG_H / 2

type Answer =
  | { type: 'SLIDER'; x: number }
  | { type: 'ROTATE'; angle: number }
  | { type: 'CLICK'; points: { x: number; y: number }[]; radius: number }
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
  // 服务端施加角 applied（keyboardStep 整数倍，∈[30,330]）；正确纠正量 = (360 − applied) mod 360
  const applied = rand(30 / ROTATE_KEY_STEP, 330 / ROTATE_KEY_STEP) * ROTATE_KEY_STEP
  const [src, sc] = canvas(ROT_SIZE, ROT_SIZE)
  paintScene(sc, ROT_SIZE, ROT_SIZE)
  const [c, ctx] = canvas(ROT_SIZE, ROT_SIZE)
  ctx.beginPath()
  ctx.arc(ROT_SIZE / 2, ROT_SIZE / 2, ROT_SIZE / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.translate(ROT_SIZE / 2, ROT_SIZE / 2)
  ctx.rotate((applied * Math.PI) / 180)
  ctx.translate(-ROT_SIZE / 2, -ROT_SIZE / 2)
  ctx.drawImage(src, 0, 0)
  const [bg, b] = canvas(BG_W, BG_H)
  paintScene(b, BG_W, BG_H)
  b.fillStyle = 'rgba(255,255,255,0.5)'
  b.fillRect(0, 0, BG_W, BG_H)
  b.fillStyle = 'rgba(20,30,50,0.25)'
  b.beginPath()
  b.arc(BG_W / 2, BG_H / 2, ROT_SIZE / 2 + 3, 0, Math.PI * 2)
  b.fill()
  const angle = correctionAngle(applied)
  return {
    answer: { type: 'ROTATE', angle } as Answer,
    data: {
      type: 'ROTATE' as const,
      background: bg.toDataURL('image/jpeg', 0.9),
      piece: c.toDataURL('image/png'),
      bgWidth: BG_W,
      bgHeight: BG_H,
      pieceSize: ROT_SIZE
    },
    hint: angle
  }
}

/** WORD_CLICK 小词表：3–4 字常用词语 / 成语（同服务端 v0.6.2，词内无重复字） */
const WORD_LIST = [
  '向日葵',
  '博物馆',
  '天文台',
  '一帆风顺',
  '万事如意',
  '风和日丽',
  '山清水秀',
  '鸟语花香'
]
/** 干扰字池 */
const DECOY_CHARS = '春夏秋冬云星雨林海川石竹松梅兰菊'.split('')
/** 指定词（仅 mock）：sessionStorage `captchaMockWord`，如「一帆风顺」 */
function pickWord(): string[] {
  let forced: string | null = null
  try {
    forced = sessionStorage.getItem('captchaMockWord')
  } catch {
    forced = null
  }
  const w =
    forced && forced.length >= 3 && forced.length <= 4
      ? forced
      : WORD_LIST[rand(0, WORD_LIST.length - 1)]
  return Array.from(w)
}
const ICON_NAMES = ['圆', '方块', '三角', '星', '十字']
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

/** 不重叠的点位（原图坐标） */
function spots(n: number) {
  const pts: { x: number; y: number }[] = []
  while (pts.length < n) {
    const p = { x: rand(36, BG_W - 36), y: rand(36, BG_H - 36) }
    if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 70)) pts.push(p)
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
  // WORD_CLICK：按词的字数出题（2–4），另加 2 个干扰字；ICON_CLICK：3 个目标 + 2 个干扰
  let labels: string[]
  let draws: ((ctx: CanvasRenderingContext2D) => void)[]
  let targetCount: number
  if (kind === 'WORD_CLICK') {
    const word = pickWord()
    const decoys = shuffle(DECOY_CHARS.filter((c) => !word.includes(c))).slice(0, rand(1, 2))
    labels = [...word, ...decoys]
    targetCount = word.length
    draws = labels.map((ch) => (ctx: CanvasRenderingContext2D) => {
      ctx.font = `bold ${ITEM_SIZE}px "PingFang SC","Microsoft YaHei",sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch, 0, 1)
    })
  } else {
    const ids = shuffle(ICONS.map((_, i) => i)).slice(0, CLICK_COUNT + CLICK_DECOYS)
    labels = ids.map((i) => ICON_NAMES[i])
    targetCount = CLICK_COUNT
    draws = ids.map((i) => (ctx: CanvasRenderingContext2D) => ICONS[i].draw(ctx, ITEM_SIZE / 2))
  }
  const pts = spots(labels.length)
  const [bg, b] = canvas(BG_W, BG_H)
  paintScene(b, BG_W, BG_H)
  draws.forEach((draw, i) => {
    const p = pts[i]
    b.save()
    b.translate(p.x, p.y)
    b.fillStyle = 'rgba(255,255,255,0.7)'
    b.beginPath()
    b.arc(0, 0, ITEM_SIZE * 0.75, 0, Math.PI * 2)
    b.fill()
    b.rotate(((i % 2 ? 1 : -1) * rand(0, 12) * Math.PI) / 180)
    b.fillStyle = '#2B4FCC'
    draw(b)
    b.restore()
  })
  const targets = pts.slice(0, targetCount)
  const names = labels.slice(0, targetCount)
  // 提示图宽度随字数自适应：34px / 字 + 8
  const [pc, p] = canvas(34 * targetCount + 8, 36)
  p.fillStyle = '#ffffff'
  p.fillRect(0, 0, pc.width, pc.height)
  draws.slice(0, targetCount).forEach((draw, i) => {
    p.save()
    p.translate(4 + 17 + i * 34, 18)
    p.scale(0.8, 0.8)
    p.fillStyle = '#2B4FCC'
    draw(p)
    p.restore()
  })
  return {
    answer: { type: 'CLICK', points: targets, radius: clickHitRadius(ITEM_SIZE) } as Answer,
    data: {
      type: kind,
      background: bg.toDataURL('image/jpeg', 0.9),
      bgWidth: BG_W,
      bgHeight: BG_H,
      promptImage: pc.toDataURL('image/png'),
      ...(kind === 'WORD_CLICK'
        ? { prompt: names.join(''), hasDecoy: true }
        : { promptNames: names }),
      count: targetCount,
      itemSize: ITEM_SIZE
    },
    hint: targets
  }
}

function genJigsaw() {
  const grid = 2
  const n = grid * grid
  // 难度低：只交换一对格子，一步即可还原
  const perm = Array.from({ length: n }, (_, i) => i)
  const a = rand(0, n - 1)
  let b2 = rand(0, n - 2)
  if (b2 >= a) b2++
  ;[perm[a], perm[b2]] = [perm[b2], perm[a]]
  // 原图
  const [src, s] = canvas(BG_W, BG_H)
  paintScene(s, BG_W, BG_H)
  s.fillStyle = '#ffffff'
  s.font = 'bold 30px sans-serif'
  s.textAlign = 'center'
  s.fillText('MUGSUN', BG_W / 2, BG_H * 0.62)
  // tiles[k] = 原图第 perm[k] 块（JPEG，每块 160×90）；正确排列：格 c 放 perm[k] === c 的那块 k
  const tiles = perm.map((orig) => {
    const [t, tc] = canvas(TILE_W, TILE_H)
    tc.drawImage(
      src,
      (orig % grid) * TILE_W,
      Math.floor(orig / grid) * TILE_H,
      TILE_W,
      TILE_H,
      0,
      0,
      TILE_W,
      TILE_H
    )
    return t.toDataURL('image/jpeg', 0.9)
  })
  const order = Array.from({ length: n }, (_, c) => perm.indexOf(c))
  return {
    answer: { type: 'JIGSAW', order } as Answer,
    data: {
      type: 'JIGSAW' as const,
      bgWidth: BG_W,
      bgHeight: BG_H,
      grid: { rows: grid, cols: grid },
      tiles,
      tileWidth: TILE_W,
      tileHeight: TILE_H
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
  let noKeyboard = false
  try {
    noKeyboard = sessionStorage.getItem('captchaMockNoKeyboard') === '1'
  } catch {
    noKeyboard = false
  }
  if (mode === 'keyboard' && noKeyboard) {
    fail(CaptchaCode.NO_ACCESSIBLE, '未启用无障碍验证方式')
  }
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
        ? ROTATE_KEY_STEP
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
        ? presses >= 1 && Math.abs(presses - Math.round(real / DEFAULT_KEYBOARD_STEP_PX)) <= 1
        : dur >= 150 && data.track.length >= 4
      return modeOk && Math.abs(real - answer.x) <= TOLERANCE
    }
    case 'ROTATE': {
      const angle = Number(a.angle)
      const diff = Math.abs(((angle - answer.angle + 540) % 360) - 180)
      const modeOk = kb
        ? presses >= 1 && Math.abs(presses - Math.round(angle / ROTATE_KEY_STEP)) <= 1
        : dur >= 150 && data.track.length >= 4
      return modeOk && diff <= rotTolerance()
    }
    case 'CLICK': {
      const pts = a.points as { x: number; y: number }[] | undefined
      if (!Array.isArray(pts) || pts.length !== answer.points.length || kb) return false
      return pts.every(
        (p, i) =>
          Math.hypot(p.x * scale - answer.points[i].x, p.y * scale - answer.points[i].y) <=
          answer.radius
      )
    }
    case 'JIGSAW': {
      const order = a.order as number[] | undefined
      return !kb && dur >= 400 && Array.isArray(order) && order.join(',') === answer.order.join(',')
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
