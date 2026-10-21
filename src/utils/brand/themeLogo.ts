/**
 * 授权页（登录 / 注册 / 忘记密码）主题色 logo 选择。
 *
 * - 7 个预设主题色（与 config.systemMainColor 一致）各有两版方标：
 *   A 版（深底，暗色模式用）、B 版（浅底，亮色模式用），文件在 src/assets/brand/theme/
 * - 不在预设内的主题色一律回退原版黑金 mugsun-icon-dark.svg（亮暗相同），不在运行时生成颜色
 * - 橙 f9901f、粉 ff80c8 的 B 版底色过浅，需加 1px 描边
 *
 * @module utils/brand/themeLogo
 */

/** 有主题版方标的预设色（小写、不带 #） */
export const THEME_LOGO_HEXES = [
  '5d87ff',
  'b48df3',
  '1d84ff',
  '60c041',
  '38c0fc',
  'f9901f',
  'ff80c8'
] as const

export type ThemeLogoHex = (typeof THEME_LOGO_HEXES)[number]

/** B 版需要描边的主题色 */
const OUTLINED_B: readonly ThemeLogoHex[] = ['f9901f', 'ff80c8']

/** 回退文件名（原版黑金） */
export const FALLBACK_LOGO_FILE = 'mugsun-icon-dark.svg'

export interface ThemeLogoChoice {
  /** 文件名：`<hex>-A-icon.svg` / `<hex>-B-icon.svg`，或回退的 mugsun-icon-dark.svg */
  file: string
  /** 命中的预设色；回退时为 null */
  hex: ThemeLogoHex | null
  /** 是否加 1px 描边 */
  outlined: boolean
}

/** 归一化 hex：去空白、去 #、转小写；3 位简写展开为 6 位 */
export function normalizeHex(color: string | null | undefined): string {
  let h = String(color ?? '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase()
  if (/^[0-9a-f]{3}$/.test(h)) h = h.replace(/./g, (c) => c + c)
  return h
}

export function resolveThemeLogo(
  themeColor: string | null | undefined,
  isDark: boolean
): ThemeLogoChoice {
  const h = normalizeHex(themeColor)
  const hex = (THEME_LOGO_HEXES as readonly string[]).includes(h) ? (h as ThemeLogoHex) : null
  if (!hex) return { file: FALLBACK_LOGO_FILE, hex: null, outlined: false }
  const variant = isDark ? 'A' : 'B'
  return {
    file: `${hex}-${variant}-icon.svg`,
    hex,
    outlined: !isDark && OUTLINED_B.includes(hex)
  }
}
