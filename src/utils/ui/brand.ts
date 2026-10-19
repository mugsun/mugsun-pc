/**
 * 品牌字标颜色
 *
 * 顶部栏、登录页这类不在侧栏里的位置，背景不跟菜单主题走，
 * 所以字标取「设计主题」的 systemNameColor（亮色模式）或暗色模式菜单的 systemNameColor，
 * 与侧栏字标同源于主题配置，不在组件里写死颜色。
 *
 * @module utils/ui/brand
 */
import { MenuThemeEnum } from '@/enums/appEnum'
import type { MenuThemeType } from '@/types/store'

export function resolveBrandTextColor(
  isDark: boolean,
  themeList: readonly MenuThemeType[],
  darkMenuStyles: readonly MenuThemeType[]
): string | undefined {
  if (isDark) return darkMenuStyles[0]?.systemNameColor
  return themeList.find((item) => item.theme === MenuThemeEnum.DESIGN)?.systemNameColor
}
