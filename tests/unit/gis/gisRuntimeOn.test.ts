import { describe, expect, it } from 'vitest'
import { isGisRuntimeOn } from '@/modules/flags'

describe('isGisRuntimeOn：构建期开关 && /auth/info 的 gisEnabled', () => {
  it('构建开关开 + gisEnabled:true → 显示', () => {
    expect(isGisRuntimeOn({ gisEnabled: true }, true)).toBe(true)
  })

  it('gisEnabled:false → 不显示', () => {
    expect(isGisRuntimeOn({ gisEnabled: false }, true)).toBe(false)
  })

  it('gisEnabled 缺失 / undefined / 用户信息为空 → 当作 false', () => {
    expect(isGisRuntimeOn({}, true)).toBe(false)
    expect(isGisRuntimeOn({ gisEnabled: undefined }, true)).toBe(false)
    expect(isGisRuntimeOn(null, true)).toBe(false)
    expect(isGisRuntimeOn(undefined, true)).toBe(false)
  })

  it('构建开关关（GIS 代码不在包里）→ 即使 gisEnabled:true 也不显示', () => {
    expect(isGisRuntimeOn({ gisEnabled: true }, false)).toBe(false)
  })
})
