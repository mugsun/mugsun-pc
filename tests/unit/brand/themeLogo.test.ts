import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import config from '@/config'
import {
  FALLBACK_LOGO_FILE,
  THEME_LOGO_HEXES,
  normalizeHex,
  resolveThemeLogo
} from '@/utils/brand/themeLogo'

const themeDir = resolve(__dirname, '../../../src/assets/brand/theme')

describe('授权页主题色 logo', () => {
  it('预设色与 config.systemMainColor 一一对应', () => {
    expect(config.systemMainColor.map((c) => normalizeHex(c))).toEqual([...THEME_LOGO_HEXES])
  })

  it.each([
    ['#5D87FF', '5d87ff'],
    ['#B48DF3', 'b48df3'],
    ['#1D84FF', '1d84ff'],
    ['#60C041', '60c041'],
    ['#38C0FC', '38c0fc'],
    ['#F9901F', 'f9901f'],
    ['#FF80C8', 'ff80c8']
  ])('%s：亮色用 B 版、暗色用 A 版，且文件存在', (color, hex) => {
    const light = resolveThemeLogo(color, false)
    const dark = resolveThemeLogo(color, true)
    expect(light.file).toBe(`${hex}-B-icon.svg`)
    expect(dark.file).toBe(`${hex}-A-icon.svg`)
    expect(light.hex).toBe(hex)
    expect(existsSync(resolve(themeDir, light.file))).toBe(true)
    expect(existsSync(resolve(themeDir, dark.file))).toBe(true)
  })

  it('比较 hex 忽略大小写与 #', () => {
    expect(resolveThemeLogo('#5d87ff', false).file).toBe('5d87ff-B-icon.svg')
    expect(resolveThemeLogo('5D87FF', true).file).toBe('5d87ff-A-icon.svg')
  })

  it.each(['#123456', '#5D87FE', '', null, undefined, 'red'])(
    '自定义主题色 %s 回退原版黑金，亮暗相同、不描边',
    (color) => {
      for (const dark of [false, true]) {
        expect(resolveThemeLogo(color, dark)).toEqual({
          file: FALLBACK_LOGO_FILE,
          hex: null,
          outlined: false
        })
      }
    }
  )

  it('只有橙、粉的 B 版加描边', () => {
    for (const hex of THEME_LOGO_HEXES) {
      expect(resolveThemeLogo(`#${hex}`, false).outlined).toBe(hex === 'f9901f' || hex === 'ff80c8')
      expect(resolveThemeLogo(`#${hex}`, true).outlined).toBe(false)
    }
  })
})
