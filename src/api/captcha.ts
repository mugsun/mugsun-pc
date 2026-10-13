import request from '@/utils/http'
import type { VerifyPayload } from '@/utils/captcha'

/** 验证码场景 */
export type CaptchaScene = 'login' | 'register' | 'sms' | 'forget'

/** 验证码开关与类型（type 非 SLIDER 时走旧数字码，过渡一个版本） */
export interface CaptchaConfig {
  enabled: boolean
  type: 'SLIDER' | 'IMAGE' | string
  scene?: string
}

/** 滑块挑战（不含答案 x，拼图块与底图同高，前端只横向平移） */
export interface CaptchaChallenge {
  captchaId: string
  type: string
  background: string
  piece: string
  bgWidth: number
  bgHeight: number
  pieceWidth: number
  pieceHeight: number
  expireSeconds: number
  /** v0.3 预留：每次 ←/→ 的移动步长（显示像素）；缺省时前端用默认步长 */
  keyboardStep?: number
}

export interface CaptchaVerifyResult {
  captchaToken: string
  expireSeconds: number
}

interface SceneParams {
  scene: CaptchaScene
  clientId: string
  tenantId?: string
}

/**
 * 开发期 mock：仅 `import.meta.env.DEV && VITE_CAPTCHA_MOCK === 'true'` 生效。
 * 生产构建 DEV 恒为 false，动态 import 分支被消除，mock 代码不会进入产物。
 */
const useMock = import.meta.env.DEV && import.meta.env.VITE_CAPTCHA_MOCK === 'true'
const loadMock = () => import('./captcha.mock')

/** 获取验证码开关与类型（匿名） */
export async function fetchCaptchaConfig(params: SceneParams) {
  if (useMock) return (await loadMock()).mockConfig(params.scene)
  return request.get<CaptchaConfig>({
    url: '/api/auth/captcha/config',
    params,
    showErrorMessage: false
  })
}

/** 获取滑块挑战 */
export async function fetchCaptchaChallenge(params: SceneParams) {
  if (useMock) return (await loadMock()).mockChallenge()
  return request.post<CaptchaChallenge>({
    url: '/api/auth/captcha/challenge',
    data: params,
    showErrorMessage: false
  })
}

/** 校验落点与轨迹，成功换一次性 captchaToken */
export async function fetchCaptchaVerify(data: VerifyPayload) {
  if (useMock) return (await loadMock()).mockVerify(data)
  return request.post<CaptchaVerifyResult>({
    url: '/api/auth/captcha/verify',
    data,
    showErrorMessage: false
  })
}
