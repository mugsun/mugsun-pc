import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { hasPerm } from '@/utils/permission'
import {
  basemapDocUrl,
  GIS_PROVIDER_PERM,
  GIS_PROVIDER_ROUTE,
  GIS_PROVIDER_ROUTE_NAME
} from '@/gis/basemapState'

/** 底图配置入口：有 gis:provider:list 权限且底图路由已注册才显示；文档链接按语言 */
export function useGisProviderEntry() {
  const router = useRouter()
  const { locale } = useI18n()

  const canConfigure = computed(() => {
    if (!hasPerm(GIS_PROVIDER_PERM)) {
      return false
    }
    if (router.hasRoute(GIS_PROVIDER_ROUTE_NAME)) {
      return true
    }
    return router.resolve(GIS_PROVIDER_ROUTE).matched.some((r) => r.path === GIS_PROVIDER_ROUTE)
  })

  const docUrl = computed(() => basemapDocUrl(String(locale.value)))

  function goConfigure() {
    router.push(GIS_PROVIDER_ROUTE)
  }

  return { canConfigure, docUrl, goConfigure }
}
