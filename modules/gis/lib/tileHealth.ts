/**
 * 底图瓦片健康度：按地图容器（OL target / Cesium container）各记一份。
 * - 连续失败达到阈值（默认 8 张），或首屏一张没成功且已全部失败 → failing
 * - 任意一张成功 → 立刻恢复 ok
 * 视图层用 GisTileErrorHint 订阅；地图层（olMap / cesiumMap）只负责上报和注册重试。
 */
export type TileHealthState = 'ok' | 'failing'

export const TILE_FAIL_THRESHOLD = 8

type Listener = (state: TileHealthState) => void

export class TileHealth {
  private consecutiveFail = 0
  private everSucceeded = false
  private started = 0
  private settled = 0
  private failed = 0
  private current: TileHealthState = 'ok'
  private listeners = new Set<Listener>()
  private retryFn: (() => void) | undefined
  private reason: string | undefined

  constructor(private readonly threshold = TILE_FAIL_THRESHOLD) {}

  get state(): TileHealthState {
    return this.current
  }

  /** 最近一次失败的原因码（后端 X-Mugsun-Tile-Error，或 network / empty-tile），用于提示 */
  get lastReason(): string | undefined {
    return this.reason
  }

  start(): void {
    this.started++
  }

  success(): void {
    this.settled++
    this.consecutiveFail = 0
    this.everSucceeded = true
    this.set('ok')
  }

  /** 预期内的“无图”（超出 maxZoom、越界）：既不算成功也不算失败 */
  neutral(): void {
    this.settled++
  }

  fail(reason?: string): void {
    if (reason) this.reason = reason
    this.settled++
    this.failed++
    this.consecutiveFail++
    const firstScreenAllFailed =
      !this.everSucceeded && this.settled >= this.started && this.failed >= this.started
    if (this.consecutiveFail >= this.threshold || firstScreenAllFailed) {
      this.set('failing')
    }
  }

  /** 换底图 / 重试前清零，避免旧图层的失败算到新图层头上 */
  reset(): void {
    this.consecutiveFail = 0
    this.everSucceeded = false
    this.started = 0
    this.settled = 0
    this.failed = 0
    this.reason = undefined
    this.set('ok')
  }

  setRetry(fn: (() => void) | undefined): void {
    this.retryFn = fn
  }

  retry(): void {
    this.reset()
    this.retryFn?.()
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    fn(this.current)
    return () => this.listeners.delete(fn)
  }

  private set(next: TileHealthState): void {
    if (next === this.current) return
    this.current = next
    this.listeners.forEach((fn) => fn(next))
  }
}

const registry = new WeakMap<object, TileHealth>()

export function tileHealthFor(host: object): TileHealth {
  let h = registry.get(host)
  if (!h) {
    h = new TileHealth()
    registry.set(host, h)
  }
  return h
}

/** 后端瓦片代理的失败原因头（boot UX-101 起：失败回 502/504/403/404 + 此头） */
export const TILE_ERROR_HEADER = 'X-Mugsun-Tile-Error'

/** 预期内的无图，不计入失败 */
export function isNeutralTileReason(reason: string | null | undefined): boolean {
  return reason === 'out-of-range'
}

/**
 * 兼容旧版后端：在上游失败（被拦截、超时、非白名单类型等）时回 200 + 空白 PNG，
 * 并带 Cache-Control: no-store；正常瓦片是 private, max-age=86400。以此识别“代理回的空瓦片”。
 */
export function isProxyEmptyTile(cacheControl: string | null | undefined): boolean {
  return !!cacheControl && /\bno-store\b/i.test(cacheControl)
}

/**
 * 三维瓦片健康度：包一层 requestImage 观察每张瓦片的成败。
 * 后端 UX-101 起失败回非 2xx，Cesium 的请求会 reject，能识别为失败；
 * 但拿不到响应头，旧版后端的“空白瓦片”（200 + no-store）在三维里仍算成功，越界 404 也会计为失败。
 */
export function watchCesiumImagery(
  imagery: { requestImage: (...args: never[]) => unknown },
  health: TileHealth
): void {
  const orig = imagery.requestImage.bind(imagery) as (...args: unknown[]) => unknown
  ;(imagery as { requestImage: (...args: unknown[]) => unknown }).requestImage = (
    ...args: unknown[]
  ) => {
    const p = orig(...args)
    // undefined 表示请求被节流，稍后 Cesium 会重试，不计数
    if (p && typeof (p as Promise<unknown>).then === 'function') {
      health.start()
      ;(p as Promise<unknown>).then(
        () => health.success(),
        () => health.fail()
      )
    }
    return p
  }
}
