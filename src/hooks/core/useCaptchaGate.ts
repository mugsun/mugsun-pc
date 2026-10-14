/**
 * 验证码闸门：提交前按 config 决定走行为验证码 / 旧数字码 / 不验证
 *
 * - config.enabled && type 为 RANDOM 或已知题型（SLIDER/ROTATE/WORD_CLICK/ICON_CLICK/JIGSAW）：
 *   提交前弹 CaptchaDialog（实际题型看 challenge.type），拿到 captchaToken 再调业务接口
 * - config.type 为 IMAGE / 未知值，或 config 拉取失败：保留旧数字码流程（过渡一个版本）
 * - challenge 返回未知题型：CaptchaDialog 触发 fallback，闸门切到旧数字码
 * - config.enabled === false：不带 token
 * - 业务接口返回 CAPTCHA_REQUIRED(40013)：重拉 config 并只自动重弹一次，再次失败交由全局 msg 提示
 */
import { computed, ref } from 'vue'
import type { CaptchaConfig, CaptchaScene } from '@/api/captcha'
import { fetchCaptchaConfig } from '@/api/captcha'
import { isBehaviorConfigType, isCaptchaRequired } from '@/utils/captcha'

/** 用户关闭滑块弹层（调用方静默处理即可） */
export class CaptchaCancelledError extends Error {
  constructor() {
    super('captcha cancelled')
    this.name = 'CaptchaCancelledError'
  }
}

export function useCaptchaGate(
  scene: CaptchaScene,
  options: { clientId?: string; tenantId?: () => string | undefined } = {}
) {
  const clientId = options.clientId ?? 'web'
  const config = ref<CaptchaConfig | null>(null)
  const loaded = ref(false)
  const visible = ref(false)
  const tenantId = computed(() => options.tenantId?.() || undefined)

  let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null

  /** challenge 下发了前端不认识的题型：本页回退旧数字码 */
  const forceLegacy = ref(false)
  /** 走行为验证码（多题型） */
  const sliderEnabled = computed(
    () => !forceLegacy.value && !!config.value?.enabled && isBehaviorConfigType(config.value.type)
  )
  /** 走旧数字码：config 不可用（旧后端）、type 非行为题型，或出现未知题型 */
  const legacyEnabled = computed(
    () =>
      !config.value ||
      (config.value.enabled && (forceLegacy.value || !isBehaviorConfigType(config.value.type)))
  )

  async function loadConfig() {
    try {
      // 每次只查一个场景（v0.2：scene=login|register|sms|forget）
      config.value = await fetchCaptchaConfig({ scene, clientId, tenantId: tenantId.value })
    } catch {
      config.value = null
    } finally {
      loaded.value = true
    }
    return config.value
  }

  /** 需要滑块时弹出并等待 token；不需要时返回 undefined */
  function requestToken(): Promise<string | undefined> {
    if (!sliderEnabled.value) return Promise.resolve(undefined)
    pending?.reject(new CaptchaCancelledError())
    visible.value = true
    return new Promise<string>((resolve, reject) => {
      pending = { resolve, reject }
    })
  }

  function onSuccess(token: string) {
    visible.value = false
    pending?.resolve(token)
    pending = null
  }

  /** challenge 返回 40014（当前无需验证）：不带 token 直接提交 */
  function onSkip() {
    visible.value = false
    pending?.resolve('')
    pending = null
  }

  /** challenge 返回未知题型：关闭弹层、切旧数字码，调用方需提示用户填写数字码后重新提交 */
  function onFallback() {
    forceLegacy.value = true
    visible.value = false
    pending?.reject(new CaptchaCancelledError())
    pending = null
  }

  function onClose() {
    visible.value = false
    pending?.reject(new CaptchaCancelledError())
    pending = null
  }

  /** 包裹业务提交：自动取 token；CAPTCHA_REQUIRED 仅自动重弹一次 */
  async function run<T>(fn: (captchaToken?: string) => Promise<T>): Promise<T> {
    const token = (await requestToken()) || undefined
    try {
      return await fn(token)
    } catch (err) {
      if (!isCaptchaRequired(err)) throw err
      await loadConfig()
      if (!sliderEnabled.value) throw err
      const retry = (await requestToken()) || undefined
      return fn(retry)
    }
  }

  return {
    config,
    loaded,
    visible,
    clientId,
    tenantId,
    sliderEnabled,
    legacyEnabled,
    loadConfig,
    requestToken,
    run,
    onSuccess,
    onSkip,
    onFallback,
    onClose
  }
}

export const isCaptchaCancelled = (e: unknown): e is CaptchaCancelledError =>
  e instanceof CaptchaCancelledError
