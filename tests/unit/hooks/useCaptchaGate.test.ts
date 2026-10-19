import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/locales', () => ({
  $t: (key: string, named?: Record<string, unknown>) =>
    named ? `${key}${JSON.stringify(named)}` : key
}))
const fetchCaptchaConfig = vi.fn()
vi.mock('@/api/captcha', () => ({
  fetchCaptchaConfig: (...a: unknown[]) => fetchCaptchaConfig(...a)
}))

const { HttpError } = await import('@/utils/http/error')
const { useCaptchaGate, isCaptchaCancelled, isCaptchaNotReady } = await import(
  '@/hooks/core/useCaptchaGate'
)

const tick = () => new Promise((r) => setTimeout(r, 0))
const HEX32 = /^[0-9a-f]{32}$/

let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  fetchCaptchaConfig.mockReset()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => consoleError.mockRestore())

describe('useCaptchaGate', () => {
  it('enabled=false：不弹验证码、不带 token', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: false, type: 'SLIDER' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    expect(g.status.value).toBe('ready')
    expect(g.sliderEnabled.value).toBe(false)
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(g.run(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledWith(undefined)
  })

  it('按场景单独查询 config，并带上本次的 X-Trace-Id（sms 仍由 gate 传入 tenantId，api 层剥离）', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'SLIDER', scene: 'sms' })
    const g = useCaptchaGate('sms', { tenantId: () => '000000' })
    await g.loadConfig()
    expect(fetchCaptchaConfig).toHaveBeenCalledWith(
      { scene: 'sms', clientId: 'web', tenantId: '000000' },
      { traceId: expect.stringMatching(HEX32) }
    )
  })

  it('challenge 返回 40014（skip）：不带 token 直接提交', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'SLIDER' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const fn = vi.fn().mockResolvedValue('ok')
    const p = g.run(fn)
    g.onSkip()
    await expect(p).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledWith(undefined)
  })

  it('SLIDER：先弹验证码拿 token 再提交', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'SLIDER' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const fn = vi.fn().mockResolvedValue('ok')
    const p = g.run(fn)
    expect(g.visible.value).toBe(true)
    g.onSuccess('tok')
    await expect(p).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledWith('tok')
  })

  it('关闭弹层：抛 CaptchaCancelledError', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'SLIDER' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const p = g.run(vi.fn())
    g.onClose()
    await expect(p).rejects.toSatisfy(isCaptchaCancelled)
  })

  it('CAPTCHA_REQUIRED 只自动重弹一次', async () => {
    fetchCaptchaConfig.mockResolvedValueOnce({ enabled: false, type: 'SLIDER' })
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'SLIDER' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const required = new HttpError('需要验证', 40013)
    const fn = vi.fn().mockRejectedValue(required)
    const p = g.run(fn)
    await tick()
    await tick()
    expect(g.visible.value).toBe(true)
    g.onSuccess('t2')
    await expect(p).rejects.toBe(required)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('t2')
  })

  it('config.type=RANDOM / ROTATE：走行为验证码', async () => {
    fetchCaptchaConfig.mockResolvedValueOnce({ enabled: true, type: 'RANDOM' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    expect(g.sliderEnabled.value).toBe(true)
    fetchCaptchaConfig.mockResolvedValueOnce({ enabled: true, type: 'ROTATE' })
    await g.loadConfig()
    expect(g.sliderEnabled.value).toBe(true)
  })

  it('只认最后一次 config 请求的结果', async () => {
    let resolveFirst!: (v: unknown) => void
    fetchCaptchaConfig.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
    fetchCaptchaConfig.mockResolvedValueOnce({ enabled: true, type: 'RANDOM' })
    const g = useCaptchaGate('login')
    const first = g.loadConfig()
    await g.loadConfig()
    resolveFirst({ enabled: true, type: 'IMAGE' })
    await first
    expect(g.status.value).toBe('ready')
    expect(g.sliderEnabled.value).toBe(true)
  })
})

describe('useCaptchaGate：config 拿不到时显示错误态，不回落', () => {
  const cases: [string, () => void][] = [
    ['网络错误', () => fetchCaptchaConfig.mockRejectedValueOnce(new Error('Network Error'))],
    ['非 2xx', () => fetchCaptchaConfig.mockRejectedValueOnce(new HttpError('Bad Gateway', 502))],
    [
      '未知类型 IMAGE',
      () => fetchCaptchaConfig.mockResolvedValueOnce({ enabled: true, type: 'IMAGE' })
    ],
    ['空响应', () => fetchCaptchaConfig.mockResolvedValueOnce(null)]
  ]

  for (const [name, arrange] of cases) {
    it(`${name}：status=error，错误编号即请求的 X-Trace-Id，live region 写入一次`, async () => {
      arrange()
      const g = useCaptchaGate('login')
      await expect(g.loadConfig()).resolves.toBeNull()
      const sentId = fetchCaptchaConfig.mock.calls[0][1].traceId
      expect(sentId).toMatch(HEX32)
      expect(g.status.value).toBe('error')
      expect(g.ready.value).toBe(false)
      expect(g.sliderEnabled.value).toBe(false)
      expect(g.errorId.value).toBe(sentId)
      expect(g.errorIdPart.value).toContain(sentId)
      expect(g.errorText.value).toBe(g.errorLead.value + g.errorIdPart.value)
      expect(g.liveText.value).toBe(g.errorText.value)
      expect(consoleError).toHaveBeenCalledWith(
        '[Captcha] config failed',
        expect.objectContaining({ scene: 'login', traceId: sentId })
      )
    })
  }

  it('失败后提交：抛 CaptchaNotReadyError，业务接口不会被调用（不带验证码提交、也不回落数字码）', async () => {
    fetchCaptchaConfig.mockRejectedValueOnce(new HttpError('x', 500))
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const fn = vi.fn()
    await expect(g.run(fn)).rejects.toSatisfy(isCaptchaNotReady)
    expect(fn).not.toHaveBeenCalled()
    expect(g.visible.value).toBe(false)
  })

  it('加载中提交：同样抛 CaptchaNotReadyError', async () => {
    fetchCaptchaConfig.mockReturnValueOnce(new Promise(() => {}))
    const g = useCaptchaGate('login')
    void g.loadConfig()
    expect(g.status.value).toBe('loading')
    const fn = vi.fn()
    await expect(g.run(fn)).rejects.toSatisfy(isCaptchaNotReady)
    expect(fn).not.toHaveBeenCalled()
  })

  it('点重试：加载中清空 live region；再失败编号刷新；成功后恢复就绪并能正常提交', async () => {
    fetchCaptchaConfig
      .mockRejectedValueOnce(new HttpError('x', 500))
      .mockRejectedValueOnce(new HttpError('x', 503))
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const firstId = g.errorId.value

    let resolveRetry!: (v: unknown) => void
    const retrying = g.loadConfig()
    expect(g.status.value).toBe('loading')
    expect(g.liveText.value).toBe('')
    await retrying
    const secondId = g.errorId.value
    expect(secondId).toMatch(HEX32)
    expect(secondId).not.toBe(firstId)

    fetchCaptchaConfig.mockReturnValueOnce(new Promise((r) => (resolveRetry = r)))
    const ok = g.loadConfig()
    resolveRetry({ enabled: true, type: 'RANDOM' })
    await ok
    expect(g.status.value).toBe('ready')
    expect(g.errorId.value).toBeNull()
    expect(g.liveText.value).toBe('')

    const fn = vi.fn().mockResolvedValue('ok')
    const p = g.run(fn)
    expect(g.visible.value).toBe(true)
    g.onSuccess('tok')
    await expect(p).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledWith('tok')
  })
})
