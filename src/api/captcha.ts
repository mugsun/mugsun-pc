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
  /** 出题时声明的输入模式；verify 必须一致 */
  inputMode: 'pointer' | 'keyboard'
  background: string
  piece: string
  bgWidth: number
  bgHeight: number
  pieceWidth: number
  pieceHeight: number
  expireSeconds: number
  /** 仅 keyboard 题返回：每次 ←/→ 移动的原图像素，默认 4；前端换算为显示像素 */
  keyboardStep?: number
}

export interface CaptchaVerifyResult {
  captchaToken: string
  expireSeconds: number
}

interface SceneParams {
  scene: CaptchaScene
  clientId: string
  /** scene=sms 时不要传（服务端忽略）；其他场景可选 */
  tenantId?: string
}

interface ChallengeParams extends SceneParams {
  /** v0.3：出题时声明，verify 须一致；切换 pointer/keyboard 须重新取题 */
  inputMode: 'pointer' | 'keyboard'
}

/**
 * 开发期 mock：仅 `import.meta.env.DEV && VITE_CAPTCHA_MOCK === 'true'` 生效。
 * 生产构建 DEV 恒为 false，动态 import 分支被消除，mock 代码不会进入产物。
 */
const useMock = import.meta.env.DEV && import.meta.env.VITE_CAPTCHA_MOCK === 'true'
const loadMock = () => import('./captcha.mock')

/** 获取验证码开关与类型（匿名） */
/** 组装请求参数：sms 场景去掉 tenantId（契约 v0.3） */
function withScene(params: SceneParams): SceneParams {
  if (params.scene === 'sms') {
    return { scene: params.scene, clientId: params.clientId }
  }
  return params
}

export async function fetchCaptchaConfig(params: SceneParams) {
  const q = withScene(params)
  if (useMock) return (await loadMock()).mockConfig(q.scene)
  return request.get<CaptchaConfig>({
    url: '/api/auth/captcha/config',
    params: q,
    showErrorMessage: false
  })
}

/** 获取滑块挑战（须声明 inputMode） */
export async function fetchCaptchaChallenge(params: ChallengeParams) {
  const body = withScene(params) as ChallengeParams
  if (useMock) return (await loadMock()).mockChallenge(body.inputMode)
  return request.post<CaptchaChallenge>({
    url: '/api/auth/captcha/challenge',
    data: { ...body, inputMode: body.inputMode || 'pointer' },
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
