import request from '@/utils/http'
import { TRACE_HEADER } from '@/utils/http/traceId'
import type { VerifyPayload } from '@/utils/captcha'

/** 验证码场景 */
export type CaptchaScene = 'login' | 'register' | 'sms' | 'forget'

/**
 * 行为验证码类型（契约 v0.6.1，mugsun-boot#35）。
 * 实际出什么题只看 challenge 响应的 type；客户端不能指定类型（请求不带 type，带了服务端也忽略）。
 */
export type CaptchaType = 'SLIDER' | 'ROTATE' | 'WORD_CLICK' | 'ICON_CLICK' | 'JIGSAW'

/** config.type：RANDOM 或某一具体类型（仅提示，以 challenge 为准）；其他值前端视为配置不可用，显示错误态 */
export type CaptchaConfigType = CaptchaType | 'RANDOM' | (string & {})

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
  /** 底图原始像素（默认 320×180）；JIGSAW 为整张 2×2 网格的原始尺寸 */
  bgWidth: number
  bgHeight: number
  /**
   * 仅 keyboard 题返回：每次 ←/→ 的移动量。
   * SLIDER 为原图像素（默认 4，前端换算显示像素）；ROTATE 为角度（度，默认 5）。
   */
  keyboardStep?: number
}

/** 滑块拼图（不含答案 x，拼图块与底图同高，前端只横向平移） */
export interface SliderChallenge extends ChallengeBase {
  type: 'SLIDER'
  /** 服务端渲染的真实底图（JPEG data URL） */
  background: string
  piece: string
  pieceWidth: number
  pieceHeight: number
}

/**
 * 旋转：background 为浅化底图 + 圆位阴影；piece 为已被服务端随机旋转的圆图（PNG），居中叠放。
 * answer.angle = 用户施加的顺时针纠正量 = (360 − 服务端施加角) mod 360。
 */
export interface RotateChallenge extends ChallengeBase {
  type: 'ROTATE'
  background: string
  piece: string
  /** 圆图直径（原始像素，默认 160） */
  pieceSize: number
}

/** 文字 / 图标点选：按提示顺序点击；answer.points 为显示像素，原点底图左上角 */
export interface ClickChallenge extends ChallengeBase {
  type: 'WORD_CLICK' | 'ICON_CLICK'
  background: string
  /** 提示图（data:image/png），前端优先显示 */
  promptImage?: string
  /** WORD_CLICK：整词字符串（v0.6.2，如「一帆风顺」，读屏用）；兼容 v0.6.1 的逐字数组 */
  prompt?: string | string[]
  /** ICON_CLICK：图标名（读屏） */
  promptNames?: string[]
  /** 需点击个数（WORD_CLICK 3 或 4，ICON_CLICK 3）；前端只认此字段 */
  count?: number
  /** WORD_CLICK：画面含 1–2 个形近 / 同音干扰字 */
  hasDecoy?: boolean
  /** v0.6.1 可选：字号 / 图标边长名义值（原始像素） */
  itemSize?: number
}

/**
 * 拼图还原：无 background 字段；tiles 为 JPEG data URL，按当前打乱后的位置顺序（行优先）。
 * answer.order[cell] = 该格最终放的 tiles 下标；bgDisplayWidth = 整个网格的显示宽度。
 */
export interface JigsawChallenge extends ChallengeBase {
  type: 'JIGSAW'
  grid: { rows: number; cols: number }
  tiles: string[]
  tileWidth: number
  tileHeight: number
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

/** 组装请求参数：sms 场景去掉 tenantId（契约 v0.3） */
function withScene(params: SceneParams): SceneParams {
  if (params.scene === 'sms') {
    return { scene: params.scene, clientId: params.clientId }
  }
  return params
}

/**
 * 获取验证码开关与类型（匿名）。
 * 失败不弹 toast（showErrorMessage:false），由页面在验证码区域显示错误态；
 * traceId 放进 X-Trace-Id 头，页面上的「错误编号」就是它，能直接对上后端日志。
 */
export async function fetchCaptchaConfig(params: SceneParams, opts: { traceId?: string } = {}) {
  const q = withScene(params)
  if (useMock) return (await loadMock()).mockConfig(q.scene)
  return request.get<CaptchaConfig>({
    url: '/api/auth/captcha/config',
    params: q,
    showErrorMessage: false,
    headers: opts.traceId ? { [TRACE_HEADER]: opts.traceId } : undefined
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
