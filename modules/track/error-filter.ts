/**
 * 埋点错误监控的管理台侧过滤（UX-007）。
 *
 * 请求层已经把 HttpError 转成提示（toast / 字段校验）展示给用户，属于已处理的业务或网络失败，
 * 接口成败另由 apiMonitorPlugin 记录。它们若再作为 $error 上报，错误监控会被
 * 「请填写应用名称」「网络连接异常」这类提示淹没。SDK 没有 beforeSend 钩子，
 * 这里不改 SDK，只在接入层做两处过滤：
 * - unhandledrejection：包一层 errorPlugin，在它的监听器之前登记标记，命中则丢弃这次 $error；
 * - Vue errorHandler：HttpError 绕过 SDK 的处理器，直接交给原有 handler（仍会打控制台日志）。
 */
import type { App } from 'vue'
import type { PluginContext, TrackClient, TrackPlugin } from '@mugsun/track-web'
import { HttpError } from '@/utils/http/error'

/**
 * 已处理的错误不进错误监控：HttpError（请求层已提示或是取消），
 * 以及带 handled===true / expected===true 标记的错误（与 SDK ignoreErrors 默认规则一致）。
 * SDK 新版自带 ignoreErrors 后，这里作为旧版 SDK 的兜底保留。
 */
export function isHandledError(err: unknown): boolean {
  if (err instanceof HttpError) return true
  if (!err || typeof err !== 'object') return false
  const e = err as { handled?: unknown; expected?: unknown; name?: unknown }
  return e.handled === true || e.expected === true || e.name === 'HttpError'
}

/**
 * 包装 SDK 的 errorPlugin：同一轮 unhandledrejection 派发中，若 reason 是已处理错误，
 * 丢弃 inner 插件发出的 $error。监听器按登记顺序触发，故先登记标记再 setup inner。
 */
export function filterHandledErrors(inner: TrackPlugin): TrackPlugin {
  return {
    name: inner.name,
    setup(ctx: PluginContext) {
      if (typeof window === 'undefined') return inner.setup(ctx)
      let suppress = false
      const mark = (e: PromiseRejectionEvent) => {
        if (!isHandledError(e.reason)) return
        suppress = true
        queueMicrotask(() => {
          suppress = false
        })
      }
      window.addEventListener('unhandledrejection', mark)
      const client = ctx.client
      const filtered = new Proxy(client, {
        get(target, prop, receiver) {
          if (prop === 'track') {
            return (event: string, ...rest: unknown[]) => {
              if (suppress && event === '$error') return
              return (target.track as (...a: unknown[]) => unknown)(event, ...rest)
            }
          }
          const v = Reflect.get(target, prop, receiver)
          return typeof v === 'function' ? v.bind(target) : v
        }
      }) as TrackClient
      const teardown = inner.setup({ ...ctx, client: filtered })
      return () => {
        window.removeEventListener('unhandledrejection', mark)
        if (typeof teardown === 'function') (teardown as () => void)()
      }
    }
  }
}

/**
 * 在 app.use(MugsunTrack) 之后调用：已处理错误绕开 SDK 的 errorHandler，
 * 交还给 SDK 挂接前的 handler（previous）。
 */
export function bypassHandledErrorsInVueHandler(
  app: App,
  previous: App['config']['errorHandler']
): void {
  const sdkHandler = app.config.errorHandler
  if (!sdkHandler || sdkHandler === previous) return
  app.config.errorHandler = (err, instance, info) => {
    if (isHandledError(err)) {
      previous?.(err, instance, info)
      return
    }
    sdkHandler(err, instance, info)
  }
}

/** 新版 SDK 提供 trackApiError；旧版没有，调用前用类型守卫判断 */
export interface ApiErrorCapable {
  trackApiError(payload: {
    url?: string
    method?: string
    status: number
    bizCode?: number
    message: string
  }): void
}

export function hasTrackApiError(client: unknown): client is ApiErrorCapable {
  return !!client && typeof (client as { trackApiError?: unknown }).trackApiError === 'function'
}
