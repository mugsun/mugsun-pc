/// <reference types="vite/client" />

declare module 'nprogress'

declare module 'crypto-js'

declare module 'vue-img-cutter'

declare module 'file-saver'

declare module 'qrcode.vue' {
  export type Level = 'L' | 'M' | 'Q' | 'H'
  export type RenderAs = 'canvas' | 'svg'
  export type GradientType = 'linear' | 'radial'
  export interface ImageSettings {
    src: string
    height: number
    width: number
    excavate: boolean
  }
  export interface QRCodeProps {
    value: string
    size?: number
    level?: Level
    background?: string
    foreground?: string
    renderAs?: RenderAs
  }
  const QrcodeVue: any
  export default QrcodeVue
}

// 全局变量声明
declare const __APP_VERSION__: string // 存储键版本（VITE_VERSION）
declare const __PKG_VERSION__: string // 产品版本（package.json version）
declare const CESIUM_BASE_URL: string

interface ImportMetaEnv {
  readonly VITE_ENABLE_GIS?: string
  readonly VITE_ENABLE_TRACK?: string
  readonly VITE_ENABLE_AI?: string
  readonly VITE_TRACK_ENDPOINT?: string
  readonly VITE_TRACK_APP_KEY?: string
  /** 埋点是否跳过已处理错误：true / false（不区分大小写）；不设则用 SDK 默认值 */
  readonly VITE_TRACK_SKIP_HANDLED_ERRORS?: string
  /** 埋点问数据 DEV mock：仅 true 启用本地假数据；默认/未设打真 API */
  readonly VITE_TRACK_ASK_MOCK?: string
  /** 埋点空间行为 DEV mock：仅 true 启用本地假数据；默认/未设打真 API */
  readonly VITE_TRACK_SPATIAL_MOCK?: string
  /** AI 流 foreach/parallel DEV mock；仅 DEV 且显式 true 时走本地假运行 */
  readonly VITE_AI_FLOW_CONTROL_MOCK?: string
  /** 审批流 AI 节点 AiApp 下拉 DEV mock：仅 true；默认/未设打真 API */
  readonly VITE_FLOW_AI_MOCK?: string
  readonly VITE_VERSION?: string
  /** 可选构建期接口传输密钥；非空时须与 bootstrap 下发值字节一致，否则禁用加密 */
  readonly VITE_CRYPTO_API_KEY?: string
  /** 开发期滑块验证码 mock（仅 dev 生效，默认关闭） */
  readonly VITE_CAPTCHA_MOCK?: string
  /** 仅 mock：旋转容差（度），缺省 10 */
  readonly VITE_CAPTCHA_MOCK_ROTATE_TOL?: string
}
