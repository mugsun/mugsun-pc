import { describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))

const m = await import('@/utils/captcha')

describe('题型分发', () => {
  it('已知题型映射到面板', () => {
    expect(m.resolvePanel('SLIDER')).toBe('slider')
    expect(m.resolvePanel('ROTATE')).toBe('rotate')
    expect(m.resolvePanel('WORD_CLICK')).toBe('click')
    expect(m.resolvePanel('ICON_CLICK')).toBe('click')
    expect(m.resolvePanel('JIGSAW')).toBe('jigsaw')
  })
  it('未知题型返回 null（回退旧数字码）', () => {
    expect(m.resolvePanel('IMAGE')).toBeNull()
    expect(m.resolvePanel('RANDOM')).toBeNull()
    expect(m.resolvePanel(undefined)).toBeNull()
    expect(m.resolvePanel('GESTURE')).toBeNull()
  })
  it('config.type：RANDOM 与具体题型走行为验证码，IMAGE / 未知走旧码', () => {
    expect(m.isBehaviorConfigType('RANDOM')).toBe(true)
    for (const t of m.CAPTCHA_TYPES) expect(m.isBehaviorConfigType(t)).toBe(true)
    expect(m.isBehaviorConfigType('IMAGE')).toBe(false)
    expect(m.isBehaviorConfigType('FOO')).toBe(false)
  })
  it('只有 SLIDER / ROTATE 支持键盘', () => {
    expect(m.supportsKeyboard('SLIDER')).toBe(true)
    expect(m.supportsKeyboard('ROTATE')).toBe(true)
    expect(m.supportsKeyboard('WORD_CLICK')).toBe(false)
    expect(m.supportsKeyboard('ICON_CLICK')).toBe(false)
    expect(m.supportsKeyboard('JIGSAW')).toBe(false)
  })
})

describe('ROTATE answer', () => {
  it('角度归一到 [0,360)', () => {
    expect(m.buildRotateAnswer(370)).toEqual({ angle: 10 })
    expect(m.buildRotateAnswer(-30)).toEqual({ angle: 330 })
    expect(m.buildRotateAnswer(359.99)).toEqual({ angle: 0 })
    expect(m.buildRotateAnswer(Number.NaN)).toEqual({ angle: 0 })
  })
  it('滑条偏移 → 角度', () => {
    expect(m.offsetToAngle(0, 200)).toBe(0)
    expect(m.offsetToAngle(100, 200)).toBe(180)
    expect(m.offsetToAngle(50, 200)).toBe(90)
    expect(m.offsetToAngle(10, 0)).toBe(0)
  })
  it('键盘步长（度）与步数夹取', () => {
    expect(m.rotateKeyboardStep(undefined)).toBe(m.DEFAULT_ROTATE_STEP_DEG)
    expect(m.rotateKeyboardStep(15)).toBe(15)
    expect(m.clampRotateSteps(-3, 5)).toBe(0)
    expect(m.clampRotateSteps(100, 5)).toBe(71)
  })
})

describe('点选 answer', () => {
  it('追加至上限、撤销', () => {
    let pts: { x: number; y: number }[] = []
    pts = m.addClickPoint(pts, { x: 10.04, y: 20.06 })
    pts = m.addClickPoint(pts, { x: 30, y: 40 })
    pts = m.addClickPoint(pts, { x: 50, y: 60 })
    expect(m.addClickPoint(pts, { x: 1, y: 1 })).toHaveLength(3)
    expect(m.undoClickPoint(pts)).toHaveLength(2)
    expect(m.undoClickPoint(pts, 0)).toEqual([])
    expect(m.buildClickAnswer(pts)).toEqual({
      points: [
        { x: 10, y: 20.1 },
        { x: 30, y: 40 },
        { x: 50, y: 60 }
      ]
    })
  })
})

describe('拼图 answer', () => {
  it('初始排列与交换', () => {
    const o = m.initialOrder(2)
    expect(o).toEqual([0, 1, 2, 3])
    const s = m.swapTiles(o, 0, 3)
    expect(s).toEqual([3, 1, 2, 0])
    expect(o).toEqual([0, 1, 2, 3])
    expect(m.swapTiles(o, 1, 1)).toBe(o)
    expect(m.swapTiles(o, 0, 9)).toBe(o)
    expect(m.buildJigsawAnswer(s)).toEqual({ order: [3, 1, 2, 0] })
  })
  it('格背景偏移', () => {
    expect(m.tileBackgroundPosition(0, 2)).toBe('0% 0%')
    expect(m.tileBackgroundPosition(3, 2)).toBe('100% 100%')
  })
})

describe('buildPayload', () => {
  const part = {
    answer: { angle: 90 },
    track: [{ x: 0, y: 0, t: 0 }],
    startTime: 1,
    endTime: 900,
    keyPresses: 18
  }
  it('pointer：keyPresses 为 null，宽度夹取', () => {
    const p = m.buildPayload({ captchaId: 'a', displayWidth: 999, inputMode: 'pointer', part })
    expect(p).toMatchObject({
      captchaId: 'a',
      bgDisplayWidth: 320,
      inputMode: 'pointer',
      keyPresses: null
    })
    expect(p.answer).toEqual({ angle: 90 })
  })
  it('keyboard：带 keyPresses', () => {
    const p = m.buildPayload({ captchaId: 'a', displayWidth: 300, inputMode: 'keyboard', part })
    expect(p.keyPresses).toBe(18)
    expect(p).not.toHaveProperty('type')
  })
})
