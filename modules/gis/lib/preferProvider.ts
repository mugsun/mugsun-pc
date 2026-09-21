import type { GisProviderStatus } from '@/api/gis'
import type { GisProviderCode } from './types'
import { DEFAULT_SCENE } from './types'

export const GIS_LAST_PROVIDER_KEY = 'gis:lastProvider'

/** 记住工作台上次底图；下次进入仍用它（仍已配置），否则取状态列表第一项。不按厂商抢焦点。 */
export function rememberGisProvider(code: string): void {
  try {
    localStorage.setItem(GIS_LAST_PROVIDER_KEY, code)
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberedOrFirst(rows: GisProviderStatus[] | undefined): GisProviderCode {
  const ready = (rows || []).filter((p) => p.configured && p.enabled)
  try {
    const last = localStorage.getItem(GIS_LAST_PROVIDER_KEY)
    const hit = ready.find((p) => p.provider === last)
    if (hit) {
      return hit.provider as GisProviderCode
    }
  } catch {
    /* ignore */
  }
  return (ready[0]?.provider as GisProviderCode) || DEFAULT_SCENE.baseMap.provider
}
