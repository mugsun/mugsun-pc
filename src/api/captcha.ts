import request from '@/utils/http'
import type { VerifyPayload } from '@/utils/captcha'

/** 验证码场景 */
export type CaptchaScene = 'login' | 'register' | 'sms' | 'forget'

/**
 * 行为验证码类型（多类型假设，待契约 v0.5 定稿；字段集中在此处便于对齐）。
 * 实际出什么题只看 challenge 响应的 type；客户端不能指定类型（生产请求不带 type）。
 */
export type CaptchaType = 'SLIDER' | 'ROTATE' | 'WORD_CLICK' | 'ICON_CLICK' | 'JIGSAW'

/** config.type：RANDOM 或某一具体类型；IMAGE / 其他未知值走旧数字码（过渡一个版本） */
export type CaptchaConfigType = CaptchaType | 'RANDOM' | 'IMAGE' | (string & {})

/** 验证码开关与类型 */
export interface CaptchaConfig {
  enabled: boolean
  type: CaptchaConfigType
  scene?: string
}

interface ChallengeBase {
  captchaId: string
  /** 出题时声明的输入模式；verify 必须一致。keyboard 题服务端只出 SLIDER / ROTATE */
  inputMode: 'pointer' | 'keyboard'
  expireSeconds: number
  /**
   * 仅 keyboard 题返回：每次 ←/→ 的移动量。
   * SLIDER 为原图像素（默认 4，前端换算显示像素）；ROTATE 为角度（度）。
   */
  keyboardStep?: number
}

/** 滑块拼图（不含答案 x，拼图块与底图同高，前端只横向平移） */
export interface SliderChallenge extends ChallengeBase {
  type: 'SLIDER'
  background: string
  piece: string
  bgWidth: number
  bgHeight: number
  pieceWidth: number
  pieceHeight: number
}

/** 旋转：圆图已被服务端旋转随机角度；answer.angle 为用户顺时针旋转量 0–360 */
export interface RotateChallenge extends ChallengeBase {
  type: 'ROTATE'
  /** 圆形图片（PNG，透明角） */
  image: string
  /** 原图边长（像素） */
  imageSize: number
}

/** 文字 / 图标点选：按 hints 顺序点击；answer.points 为显示像素 */
export interface ClickChallenge extends ChallengeBase {
  type: 'WORD_CLICK' | 'ICON_CLICK'
  background: string
  bgWidth: number
  bgHeight: number
  /** WORD_CLICK：单字；ICON_CLICK：图标图片（data URL） */
  hints: string[]
}

/** 拼图还原：image 为已打乱的整图，切成 grid×grid；answer.order[pos] = 该位置当前放的打乱格序号 */
export interface JigsawChallenge extends ChallengeBase {
  type: 'JIGSAW'
  image: string
  bgWidth: number
  bgHeight: number
  /** 先只做 2 */
  grid: number
}

export type CaptchaChallenge = SliderChallenge | RotateChallenge | ClickChallenge | JigsawChallenge

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

/** 获取挑战（须声明 inputMode；不带 type，题型由服务端决定） */
export async function fetchCaptchaChallenge(params: ChallengeParams) {
  const body = withScene(params) as ChallengeParams
  if (useMock) return (await loadMock()).mockChallenge(body.inputMode)
  return request.post<CaptchaChallenge>({
    url: '/api/auth/captcha/challenge',
    data: { ...body, inputMode: body.inputMode || 'pointer' },
    showErrorMessage: false
  })
}

/** 校验答案与轨迹，成功换一次性 captchaToken */
export async function fetchCaptchaVerify(data: VerifyPayload) {
  if (useMock) return (await loadMock()).mockVerify(data)
  return request.post<CaptchaVerifyResult>({
    url: '/api/auth/captcha/verify',
    data,
    showErrorMessage: false
  })
}
