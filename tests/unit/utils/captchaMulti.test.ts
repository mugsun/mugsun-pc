import { describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))

const { HttpError } = await import('@/utils/http/error')
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

describe('v0.4 verify 错误', () => {
  it('触发锁定的 verify 返回 40012：限流并带 retryAfter（立即倒计时）', () => {
    const e = new HttpError('尝试次数过多', 40012, { data: { retryAfter: 600 } })
    expect(m.classifyVerifyError(e)).toMatchObject({ kind: 'rateLimited', retryAfter: 600 })
  })
  it('verify 连接错误按 40011 处理', () => {
    expect(m.classifyVerifyError(new HttpError('net', 400))).toMatchObject({
      kind: 'failed',
      code: 40011
    })
    expect(m.classifyVerifyError(new TypeError('Failed to fetch'))).toMatchObject({
      kind: 'failed'
    })
  })
  it('40011 / 40010 原样', () => {
    expect(m.classifyVerifyError(new HttpError('x', 40011)).kind).toBe('failed')
    expect(m.classifyVerifyError(new HttpError('x', 40010)).kind).toBe('expired')
  })
})

describe('契约 v0.6.1 对齐', () => {
  it('ROTATE：左边缘行程 / bgDisplayWidth × 360，拖满 = 360° ≡ 0°', () => {
    expect(m.rotateTravelToAngle(0, 320)).toBe(0)
    expect(m.rotateTravelToAngle(80, 320)).toBe(90)
    expect(m.rotateTravelToAngle(160, 260)).toBe(221.5)
    expect(m.rotateTravelToAngle(320, 320)).toBe(0)
    expect(m.rotateTravelToAngle(999, 320)).toBe(0)
    expect(m.rotateAngleToTravel(90, 320)).toBe(80)
    expect(m.rotateAngleToTravel(m.rotateTravelToAngle(123.4, 300), 300)).toBeCloseTo(123.4, 0)
  })
  it('ROTATE：answer.angle = (360 − 施加角) mod 360', () => {
    expect(m.correctionAngle(40)).toBe(320)
    expect(m.correctionAngle(330)).toBe(30)
    expect(m.correctionAngle(360)).toBe(0)
  })
  it('ROTATE 键盘：步长 5° 时施加角为步长整数倍可精确命中', () => {
    const step = m.rotateKeyboardStep(5)
    for (const applied of [30, 35, 180, 325, 330]) {
      const target = m.correctionAngle(applied)
      const presses = m.clampRotateSteps(target / step, step)
      expect(m.normalizeAngle(presses * step)).toBe(target)
      expect(presses).toBeGreaterThanOrEqual(1)
      expect(presses).toBeLessThanOrEqual(72)
    }
    expect(m.rotateKeyboardStep(undefined)).toBe(5)
  })
  it('点选命中半径 max(itemSize × 0.75, 22)', () => {
    expect(m.clickHitRadius(29)).toBe(22)
    expect(m.clickHitRadius(35)).toBe(26)
    expect(m.clickHitRadius(39)).toBe(29)
    expect(m.clickHitRadius(undefined)).toBe(22)
  })
  it('显示坐标 → 原图坐标', () => {
    expect(m.toOriginal(130, 320, 260)).toBe(160)
    expect(m.toOriginal(160, 320, 320)).toBe(160)
  })
  it('外壳宽度：上报 ≥ 260，更窄时整体缩放', () => {
    expect(m.shellLayout(400)).toEqual({ width: 320, scale: 1 })
    expect(m.shellLayout(300)).toEqual({ width: 300, scale: 1 })
    expect(m.shellLayout(234)).toEqual({ width: 260, scale: 0.9 })
    expect(m.cssScale(234, 260)).toBeCloseTo(0.9)
    expect(m.cssScale(0, 260)).toBe(1)
  })
  it('40015：未启用无障碍题型，不自动重试', () => {
    expect(m.classifyCaptchaError(new HttpError('未启用', 40015))).toMatchObject({
      kind: 'noAccessible',
      code: 40015
    })
  })
})

describe('WORD_CLICK 词语 / 成语（点击数由响应决定）', () => {
  it('prompt 数组或整词字符串都按字拆分', () => {
    expect(m.clickPromptChars({ prompt: ['一', '帆', '风', '顺'] })).toEqual([
      '一',
      '帆',
      '风',
      '顺'
    ])
    expect(m.clickPromptChars({ prompt: '一帆风顺' })).toEqual(['一', '帆', '风', '顺'])
    expect(m.clickPromptChars({ promptNames: ['太阳', '钥匙'] })).toEqual(['太阳', '钥匙'])
    expect(m.clickPromptChars({})).toEqual([])
  })
  it('点击数只认 count，缺失回退 3', () => {
    expect(m.clickTargetCount({ count: 4 })).toBe(4)
    expect(m.clickTargetCount({ count: 3 })).toBe(3)
    expect(m.clickTargetCount({})).toBe(3)
    expect(m.clickTargetCount({ count: 99 })).toBe(8)
  })
  it('读屏标签：文字拼成整词，图标空格分隔', () => {
    expect(m.clickPromptLabel({ type: 'WORD_CLICK', prompt: ['一', '帆', '风', '顺'] })).toBe(
      '一帆风顺'
    )
    expect(m.clickPromptLabel({ type: 'ICON_CLICK', promptNames: ['太阳', '鱼'] })).toBe('太阳 鱼')
  })
})

describe('v0.6.2 旋转低速精调 / 40016', () => {
  it('精调参数：0.08 px/ms、200ms、0.6 倍、24px', () => {
    expect(m.ROTATE_SLOW_SPEED).toBe(0.08)
    expect(m.ROTATE_FINE_ENTER_MS).toBe(200)
    expect(m.ROTATE_SLOW_GAIN).toBe(0.6)
    expect(m.ROTATE_FINE_MIN_TRAVEL).toBe(24)
  })
  it('已拖 ≥24px 后持续低速满 200ms 才进入 0.6 倍', () => {
    const f = new m.RotateFineTuner()
    expect(f.delta(30, 16, 0)).toBe(30) // 快拖 30px
    expect(f.delta(1, 16, 16)).toBe(1) // 刚变慢
    expect(f.delta(1, 16, 150)).toBe(1) // 慢 134ms：未满 200ms
    expect(f.delta(1, 16, 215)).toBe(1) // 慢 199ms
    expect(f.fine).toBe(false)
    expect(f.delta(1, 16, 216)).toBeCloseTo(0.6) // 慢满 200ms：精调
    expect(f.fine).toBe(true)
  })
  it('累计不到 24px 时一直慢拖也不进入精调', () => {
    const f = new m.RotateFineTuner()
    let t = 0
    // 每 20ms 1px（0.05 px/ms），20 次累计 20px，历时 400ms
    for (let i = 0; i < 20; i++, t += 20) expect(f.delta(1, 20, t)).toBe(1)
    expect(f.fine).toBe(false)
    // 再慢拖到累计 ≥24px：慢已持续 >200ms，立即进入
    for (let i = 0; i < 3; i++, t += 20) f.delta(1, 20, t)
    expect(f.fine).toBe(false)
    expect(f.delta(1, 20, t)).toBeCloseTo(0.6) // 累计 24px
    expect(f.fine).toBe(true)
  })
  it('一加速立即恢复原速，重新计时；reset 清零累计位移', () => {
    const f = new m.RotateFineTuner()
    f.delta(30, 16, 0)
    f.delta(1, 16, 16)
    expect(f.delta(1, 16, 300)).toBeCloseTo(0.6)
    expect(f.delta(8, 16, 316)).toBe(8) // 0.5 px/ms：退出
    expect(f.fine).toBe(false)
    expect(f.delta(1, 16, 332)).toBe(1) // 重新计时
    f.reset()
    f.delta(1, 16, 400)
    expect(f.delta(1, 16, 700)).toBe(1) // reset 后累计仅 2px
    expect(f.delta(0, 0, 800)).toBe(0)
    expect(f.delta(5, 0, 800)).toBe(5)
  })
  it('提示状态：拖动中精调为 is-fine，退出或松手即去掉（样式 150ms 淡出）', () => {
    const f = new m.RotateFineTuner()
    expect(m.rotateFineHintClass(true, f.fine)).toEqual({ 'is-fine': false })
    f.delta(30, 16, 0)
    f.delta(1, 16, 16)
    f.delta(1, 16, 216)
    expect(m.rotateFineHintClass(true, f.fine)).toEqual({ 'is-fine': true })
    f.delta(8, 16, 232)
    expect(m.rotateFineHintClass(true, f.fine)).toEqual({ 'is-fine': false })
    expect(m.rotateFineHintClass(false, true)).toEqual({ 'is-fine': false })
    expect(m.ROTATE_FINE_HINT_FADE_MS).toBe(150)
  })
  it('快拖 → 慢拖 → 快拖：角度按增量累加，全程连续、不跳角', () => {
    const W = 320
    const d = new m.RotateDrag(W)
    const k = 360 / W
    let t = 0
    let prev = 0
    const seq: Array<[number, number]> = []
    for (let i = 0; i < 10; i++) seq.push([8, 16]) // 快 0.5 px/ms
    for (let i = 0; i < 20; i++) seq.push([1, 20]) // 慢 0.05 px/ms（满 200ms 进入精调）
    for (let i = 0; i < 10; i++) seq.push([8, 16]) // 再快
    let sawFine = false
    for (const [dx, dt] of seq) {
      t += dt
      const wasFine = d.fine
      const a = d.move(dx, dt, t)
      sawFine ||= d.fine
      const gain = d.fine ? m.ROTATE_SLOW_GAIN : 1
      // 每步增量只等于本步 dx × k × 当前倍率（容 0.1° 取整），切换倍率时不回算已累加部分
      expect(Math.abs(a - prev - dx * k * gain)).toBeLessThanOrEqual(0.11)
      if (wasFine !== d.fine) expect(Math.abs(a - prev)).toBeLessThanOrEqual(8 * k + 0.11)
      // 滑块由角度反算
      expect(d.offset).toBeCloseTo(m.rotateAngleToTravel(a, W), 5)
      prev = a
    }
    expect(sawFine).toBe(true)
    expect(d.fine).toBe(false)
  })
  it('提交的答案等于显示角度，track 行程换算的角度与之一致', () => {
    const W = 320
    const d = new m.RotateDrag(W)
    let t = 0
    for (let i = 0; i < 6; i++) d.move(8, 16, (t += 16))
    for (let i = 0; i < 30; i++) d.move(1, 20, (t += 20))
    const shown = Math.round(d.angle * 10) / 10
    expect(m.buildRotateAnswer(d.angle)).toEqual({ angle: shown })
    expect(Math.abs((d.offset / W) * 360 - shown)).toBeLessThanOrEqual(0.2)
  })
  it('40016 归类为 unavailable，不自动重试', () => {
    expect(m.classifyCaptchaError(new HttpError('暂不可用', 40016))).toMatchObject({
      kind: 'unavailable'
    })
  })
})
