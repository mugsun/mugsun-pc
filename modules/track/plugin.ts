/**
 * 埋点接入模块（mugsun-pc 自监控）
 *
 * SDK 为平台内 file 依赖（../mugsun-track，@mugsun/track-web），Vue 层 install 统一完成：
 * provide/$track/v-track 指令、errorHandler 链式挂接（保留既有 setupErrorHandle）、
 * router 集成（route_path 取 matched 路由模板防高基数，afterEach 驱动 SPA pageview 配对）。
 *
 * 身份口径：事件级 user_id 恒由服务端按 token 裁定（客户端上报值不可信），
 * 故上报请求经 headers 携带登录 token（与 @/utils/http 的 Sa-Token 裸 token 方案一致）；
 * identify 仅上报 $identify 申请绑定（user_id 放 props，是否落映射由服务端裁定）。
 * 匿名（未登录）页面照常采集（如登录页 PV），user_id 留空——设计语义。
 *
 * 会话回放（G100）：回放插件经桥接插件动态加载（import('@mugsun/track-web/replay') 独立 chunk，
 * rrweb 再由插件内部懒加载），主包不含录制实现；是否录制由 SDK 按 config 下发的
 * replayEnabled/replaySampleRate 自决（远端开启后下次启动生效），前端零判断。
 *
 * 接口监控（G102）：api-monitor 不在 SDK 默认插件集，此处显式注册进 plugins 序列；
 * 是否包装 fetch/XHR、是否采集响应体由 SDK 按 config 下发的
 * apiMonitorEnabled/apiBodyEnabled/apiBodyMaskEnabled 自决（远端开启后下次启动生效），前端零判断。
 *
 * 圈选埋点（G104）：visual-track 同不在默认插件集，显式注册；URL 带 __mst_inspect 令牌即进
 * 圈选模式（不依赖远端配置），常态按 config 下发的 visualRules 命中上报自定义事件。
 *
 * 精确位置（G106）：geo 插件显式注册；是否征求定位由 /track/config geoEnabled 自决（默认关，下次启动生效）。
 *
 * @module plugins/track
 * @author Mugsun
 */
import type { App } from 'vue'
import MugsunTrack from '@mugsun/track-web/vue'
import {
  apiMonitorPlugin,
  autocapturePlugin,
  errorPlugin,
  exposurePlugin,
  geoPlugin,
  pageleavePlugin,
  pageviewPlugin,
  visualTrack,
  webVitalsPlugin,
  type PluginContext,
  type TrackClient,
  type TrackPlugin
} from '@mugsun/track-web'
import { router } from '@/router'
import { useUserStore } from '@/store/modules/user'

/** 默认应用种子 app_key（与后端 track 库 T2 迁移种子一致；VITE_TRACK_APP_KEY 可覆盖） */
const DEFAULT_TRACK_APP_KEY = 'ak_000000000000000000000001'

/** SDK 实例（setupTrack 后可用；未初始化时为 null，调用方一律静默跳过） */
let tracker: TrackClient | null = null

/**
 * 回放桥接插件：install 同步路径不阻塞（首屏 pageview/error 等既有采集零时差），
 * 回放实现 chunk 异步就绪后补挂 setup；加载失败仅回放缺位，不影响主采集链路。
 * teardown 幂等：chunk 未就绪先卸 = 标记 disposed 防补挂，已补挂则透传卸除。
 */
function replayBridgePlugin(): TrackPlugin {
  return {
    name: 'replay',
    setup(ctx: PluginContext) {
      let disposed = false
      let teardown: unknown
      void import('@mugsun/track-web/replay')
        .then(({ replayPlugin }) => {
          if (disposed) return
          teardown = replayPlugin().setup(ctx)
        })
        .catch(() => {
          // 回放 chunk 加载失败（弱网/构建缺块）：静默降级，主采集不受影响
        })
      return () => {
        disposed = true
        if (typeof teardown === 'function') (teardown as () => void)()
      }
    }
  }
}

/**
 * 初始化埋点（router 就绪后、mount 前调用）。
 * endpoint 缺省 /api：dev 下 /api/track/collect 经 vite 代理到后端；release 取构建版本号。
 * plugins 显式给定（与 SDK vue 适配层 router 模式同一序列，外加回放桥接）——
 * 不传则适配层内部默认序列不含回放。
 */
export function setupTrack(app: App): void {
  app.use(MugsunTrack, {
    endpoint: import.meta.env.VITE_TRACK_ENDPOINT || '/api',
    appKey: import.meta.env.VITE_TRACK_APP_KEY || DEFAULT_TRACK_APP_KEY,
    release: import.meta.env.VITE_VERSION,
    router,
    plugins: [
      pageviewPlugin({ manual: true }),
      pageleavePlugin(),
      autocapturePlugin(),
      exposurePlugin(),
      webVitalsPlugin(),
      errorPlugin(),
      apiMonitorPlugin(),
      visualTrack(),
      geoPlugin(),
      replayBridgePlugin()
    ],
    // 上报携带登录 token 供服务端身份裁定；beacon 冲刷场景无法自定义头，按匿名处理，不阻断采集
    headers: (): Record<string, string> => {
      const token = useUserStore().accessToken
      return token ? { Authorization: token } : {}
    }
  })
  tracker = app.config.globalProperties.$track as TrackClient
}

/**
 * 登录身份绑定（上报 $identify；SDK 侧幂等，重复绑定无副作用）。
 * 常规路径由路由守卫拉取用户信息后调用；登录 applyToken 快速路径以已缓存信息兜底调用。
 */
export function trackIdentify(userId: string | number): void {
  tracker?.identify(userId)
}

/** 登出/切号：清空登录身份、更换 anonymous_id、轮换会话（userStore.logOut 内调用） */
export function trackReset(): void {
  tracker?.reset()
}
