import { useUserStore } from '@/store/modules/user'
import { isProxyEmptyTile, TILE_ERROR_HEADER } from './tileHealth'

/** 瓦片请求失败：HTTP 状态码 + 后端原因头（X-Mugsun-Tile-Error） */
export class TileHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string
  ) {
    super(`tile ${status} ${reason}`)
    this.name = 'TileHttpError'
  }
}

/** 旧版后端代理回了空白瓦片（上游失败）；objectUrl 仍可用来显示 */
export class TileEmptyError extends Error {
  constructor(public readonly objectUrl: string) {
    super('tile empty')
    this.name = 'TileEmptyError'
  }
}

/** 瓦片请求带登录令牌（OpenLayers/Cesium 默认不会走 axios 拦截器） */
export async function loadAuthedTileBlob(src: string): Promise<string> {
  const token = useUserStore().accessToken
  const res = await fetch(src, {
    headers: token ? { Authorization: token } : {}
  })
  if (!res.ok) {
    throw new TileHttpError(res.status, res.headers.get(TILE_ERROR_HEADER) || `http-${res.status}`)
  }
  if (isProxyEmptyTile(res.headers.get('Cache-Control'))) {
    // 代理已回空白瓦片：照常显示（透明），但按失败计入健康度
    const blob = await res.blob()
    throw new TileEmptyError(URL.createObjectURL(blob))
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/** 矢量瓦片是 protobuf，不能走 blob URL，直接把字节给 MVT 解析器 */
export async function loadAuthedTileBuffer(src: string): Promise<ArrayBuffer> {
  const token = useUserStore().accessToken
  const res = await fetch(src, {
    headers: token ? { Authorization: token } : {}
  })
  if (!res.ok) {
    throw new Error(`mvt ${res.status}`)
  }
  return res.arrayBuffer()
}
