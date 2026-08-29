import { useUserStore } from '@/store/modules/user'

/** 瓦片请求带登录令牌（OpenLayers/Cesium 默认不会走 axios 拦截器） */
export async function loadAuthedTileBlob(src: string): Promise<string> {
  const token = useUserStore().accessToken
  const res = await fetch(src, {
    headers: token ? { Authorization: token } : {}
  })
  if (!res.ok) {
    throw new Error(`tile ${res.status}`)
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
