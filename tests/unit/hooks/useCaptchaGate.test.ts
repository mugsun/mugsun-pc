import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/locales', () => ({ $t: (key: string) => key }))
const fetchCaptchaConfig = vi.fn()
vi.mock('@/api/captcha', () => ({
  fetchCaptchaConfig: (...a: unknown[]) => fetchCaptchaConfig(...a)
}))

const { HttpError } = await import('@/utils/http/error')
const { useCaptchaGate, isCaptchaCancelled } = await import('@/hooks/core/useCaptchaGate')

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('useCaptchaGate', () => {
  beforeEach(() => fetchCaptchaConfig.mockReset())

  it('enabled=false：不弹滑块、不带 token', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: false, type: 'SLIDER' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    expect(g.legacyEnabled.value).toBe(false)
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(g.run(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledWith(undefined)
  })

  it('type=IMAGE 或 config 失败：走旧数字码', async () => {
    fetchCaptchaConfig.mockResolvedValueOnce({ enabled: true, type: 'IMAGE' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    expect(g.legacyEnabled.value).toBe(true)
    expect(g.sliderEnabled.value).toBe(false)
    fetchCaptchaConfig.mockRejectedValueOnce(new Error('404'))
    await g.loadConfig()
    expect(g.legacyEnabled.value).toBe(true)
  })

  it('按场景单独查询 config（sms 仍由 gate 传入 tenantId，api 层剥离）', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'SLIDER', scene: 'sms' })
    const g = useCaptchaGate('sms', { tenantId: () => '000000' })
    await g.loadConfig()
    expect(fetchCaptchaConfig).toHaveBeenCalledWith({
      scene: 'sms',
      clientId: 'web',
      tenantId: '000000'
    })
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

  it('SLIDER：先弹滑块拿 token 再提交', async () => {
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
    expect(g.legacyEnabled.value).toBe(false)
    fetchCaptchaConfig.mockResolvedValueOnce({ enabled: true, type: 'ROTATE' })
    await g.loadConfig()
    expect(g.sliderEnabled.value).toBe(true)
  })

  it('challenge 下发未知题型：onFallback 取消本次并切旧数字码', async () => {
    fetchCaptchaConfig.mockResolvedValue({ enabled: true, type: 'RANDOM' })
    const g = useCaptchaGate('login')
    await g.loadConfig()
    const fn = vi.fn()
    const p = g.run(fn)
    g.onFallback()
    await expect(p).rejects.toSatisfy(isCaptchaCancelled)
    expect(fn).not.toHaveBeenCalled()
    expect(g.legacyEnabled.value).toBe(true)
    expect(g.sliderEnabled.value).toBe(false)
  })
})
