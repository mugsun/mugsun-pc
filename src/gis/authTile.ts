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
