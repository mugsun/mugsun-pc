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
  readonly VITE_VERSION?: string
}
