import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MenuThemeEnum } from '@/enums/appEnum'
import { resolveBrandTextColor } from '@/utils/ui/brand'
import type { MenuThemeType } from '@/types/store'

const root = path.resolve(__dirname, '../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

const themeList = [
  { theme: MenuThemeEnum.DESIGN, systemNameColor: 'var(--art-gray-800)' },
  { theme: MenuThemeEnum.DARK, systemNameColor: '#D9DADB' },
  { theme: MenuThemeEnum.LIGHT, systemNameColor: 'var(--art-gray-800)' }
] as MenuThemeType[]
const darkMenuStyles = [
  { theme: MenuThemeEnum.DARK, systemNameColor: '#DDDDDD' }
] as MenuThemeType[]

describe('品牌字标颜色', () => {
  it('亮色模式取设计主题的 systemNameColor', () => {
    expect(resolveBrandTextColor(false, themeList, darkMenuStyles)).toBe('var(--art-gray-800)')
  })
  it('暗色模式取暗色菜单的 systemNameColor', () => {
    expect(resolveBrandTextColor(true, themeList, darkMenuStyles)).toBe('#DDDDDD')
  })
  it('顶部栏和登录页不写死字标颜色', () => {
    for (const f of [
      'src/components/core/layouts/art-header-bar/index.vue',
      'src/components/core/views/login/LoginLeftView.vue'
    ]) {
      const s = read(f)
      expect(s).toContain(':word-color="getBrandTextColor"')
      expect(s).not.toMatch(/word-color="[^"]*#[0-9A-Fa-f]{3,6}/)
    }
  })
})

describe('品牌资源', () => {
  const svgs = [
    'src/assets/brand/mugsun-icon-dark.svg',
    'src/assets/brand/mugsun-icon-simple-small.svg',
    'src/assets/images/favicon.svg'
  ]
  it.each(svgs)('%s 已压缩且不嵌位图', (f) => {
    const s = read(f)
    expect(Buffer.byteLength(s)).toBeLessThan(12 * 1024)
    expect(s).not.toMatch(/<image\b|data:image\//)
  })
  it('ArtLogo 使用改名后的子集字体，并保留系统无衬线回退', () => {
    const s = read('src/components/core/base/art-logo/index.vue')
    expect(s).toContain('mugsun-saira-600.woff2')
    expect(s).toContain("font-family: 'Mugsun Saira'")
    expect(s).toMatch(/sans-serif/)
    expect(existsSync(path.join(root, 'src/assets/brand/fonts/mugsun-saira-600.woff2'))).toBe(true)
    expect(existsSync(path.join(root, 'src/assets/brand/fonts/LICENSE-Saira-OFL.txt'))).toBe(true)
  })
  it('NOTICE 写明 Saira（OFL-1.1，已子集化）', () => {
    const s = read('NOTICE')
    expect(s).toContain('Saira')
    expect(s).toContain('OFL-1.1')
    expect(s).toContain('子集化')
  })
  it('未引用的 src/assets/images/favicon.ico 已删除', () => {
    expect(existsSync(path.join(root, 'src/assets/images/favicon.ico'))).toBe(false)
  })
})
