/**
 * 验证码闸门：提交前按 config 决定走行为验证码 / 不验证；拿不到可用 config 时显示错误态，不回落
 *
 * - config.enabled && type 为 RANDOM 或已知题型（SLIDER/ROTATE/WORD_CLICK/ICON_CLICK/JIGSAW）：
 *   提交前弹 CaptchaDialog（实际题型看 challenge.type），拿到 captchaToken 再调业务接口
 * - config.enabled === false：不带 token
 * - config 拉取失败（网络错误、非 2xx）或返回前端不认识的类型：status=error，
 *   验证码区域显示错误态（文案 + 重试 + 错误编号），不弹 toast，polite live region 播报一次；
 *   就绪前 run() 抛 CaptchaNotReadyError，页面提示先完成验证，不会不带验证码提交
 * - 业务接口返回 CAPTCHA_REQUIRED(40013)：重拉 config 并只自动重弹一次，再次失败交由全局 msg 提示
 */
import { computed, ref } from 'vue'
import type { CaptchaConfig, CaptchaScene } from '@/api/captcha'
import { fetchCaptchaConfig } from '@/api/captcha'
import { $t } from '@/locales'
import { isBehaviorConfigType, isCaptchaRequired } from '@/utils/captcha'
import { newTraceId } from '@/utils/http/traceId'
import { isCanceledError } from '@/utils/sys/error-handle'

/** 用户关闭验证码弹层（调用方静默处理即可） */
export class CaptchaCancelledError extends Error {
  constructor() {
    super('captcha cancelled')
    this.name = 'CaptchaCancelledError'
  }
}

/** 验证码配置还没就绪（加载中或加载失败）：调用方提示先完成验证 */
export class CaptchaNotReadyError extends Error {
  constructor() {
    super('captcha not ready')
    this.name = 'CaptchaNotReadyError'
  }
}

/** config 返回了前端不认识的类型（按配置不可用处理） */
class UnsupportedCaptchaConfigError extends Error {
  constructor(readonly type: unknown) {
    super(`unsupported captcha config type: ${String(type)}`)
    this.name = 'UnsupportedCaptchaConfigError'
  }
}

export type CaptchaGateStatus = 'loading' | 'ready' | 'error'

export function useCaptchaGate(
  scene: CaptchaScene,
  options: { clientId?: string; tenantId?: () => string | undefined } = {}
) {
  const clientId = options.clientId ?? 'web'
  const config = ref<CaptchaConfig | null>(null)
  const status = ref<CaptchaGateStatus>('loading')
  /** 错误编号（本次 config 请求的 X-Trace-Id）；null 表示没有错误 */
  const errorId = ref<string | null>(null)
  /** 给 polite live region：每次失败写入一次，开始加载时清空 */
  const liveText = ref('')
  const visible = ref(false)
  const tenantId = computed(() => options.tenantId?.() || undefined)
  const loaded = computed(() => status.value !== 'loading')
  const ready = computed(() => status.value === 'ready')

  /**
   * 错误文案拆成「消息 + 分隔符」和「编号段」两段渲染，编号段整段换行；
   * 拼起来就是完整文案（读屏用完整文案）。
   */
  const errorLead = computed(
    () => $t('pages.auth.captchaConfig.failed') + $t('pages.auth.captchaConfig.idSep')
  )
  const errorIdPart = computed(() =>
    $t('pages.auth.captchaConfig.idPart', { id: errorId.value ?? '' })
  )
  const errorText = computed(() => errorLead.value + errorIdPart.value)

  let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null
  let seq = 0

  /** 走行为验证码（多题型） */
  const sliderEnabled = computed(() => ready.value && !!config.value?.enabled)

  async function loadConfig() {
    const mine = ++seq
    const traceId = newTraceId()
    status.value = 'loading'
    liveText.value = ''
    try {
      // 每次只查一个场景（v0.2：scene=login|register|sms|forget）
      const data = await fetchCaptchaConfig(
        { scene, clientId, tenantId: tenantId.value },
        { traceId }
      )
      if (mine !== seq) return config.value
      if (!data || typeof data.enabled !== 'boolean') {
        throw new UnsupportedCaptchaConfigError(undefined)
      }
      if (data.enabled && !isBehaviorConfigType(data.type)) {
        throw new UnsupportedCaptchaConfigError(data.type)
      }
      config.value = data
      errorId.value = null
      status.value = 'ready'
    } catch (error) {
      if (mine !== seq || isCanceledError(error)) return config.value
      console.error('[Captcha] config failed', { scene, traceId, error })
      config.value = null
      errorId.value = traceId
      status.value = 'error'
      liveText.value = errorText.value
    }
    return config.value
  }

  /** 需要验证码时弹出并等待 token；不需要时返回 undefined；未就绪抛 CaptchaNotReadyError */
  function requestToken(): Promise<string | undefined> {
    if (!ready.value) return Promise.reject(new CaptchaNotReadyError())
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
    status,
    loaded,
    ready,
    errorId,
    errorLead,
    errorIdPart,
    errorText,
    liveText,
    visible,
    clientId,
    tenantId,
    sliderEnabled,
    loadConfig,
    requestToken,
    run,
    onSuccess,
    onSkip,
    onClose
  }
}

export type CaptchaGate = ReturnType<typeof useCaptchaGate>

export const isCaptchaCancelled = (e: unknown): e is CaptchaCancelledError =>
  e instanceof CaptchaCancelledError

export const isCaptchaNotReady = (e: unknown): e is CaptchaNotReadyError =>
  e instanceof CaptchaNotReadyError
