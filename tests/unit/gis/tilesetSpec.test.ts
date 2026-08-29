import { describe, expect, it } from 'vitest'
import { hostedTilesetUrl, parseTilesetSpec } from '@/gis/raster'

describe('parseTilesetSpec（三维切片图层解析）', () => {
  it('hosted 字段展开成托管路径', () => {
    const spec = parseTilesetSpec({ type: '3DTILES', hosted: 'demo-city', url: 'hosted:demo-city' })

    expect(spec?.url).toBe(hostedTilesetUrl('demo-city'))
    expect(spec?.hosted).toBe('demo-city')
  })

  it('只给 hosted: 前缀的 url 也能展开', () => {
    expect(parseTilesetSpec({ url: 'hosted:demo-city' })?.url).toBe(hostedTilesetUrl('demo-city'))
  })

  it('外部 http 地址原样保留，不带 hosted', () => {
    const spec = parseTilesetSpec({ url: 'https://cdn.example.com/city/tileset.json' })

    expect(spec?.url).toBe('https://cdn.example.com/city/tileset.json')
    expect(spec?.hosted).toBeUndefined()
  })

  it('渲染参数缺失或非法时落到默认值', () => {
    const spec = parseTilesetSpec({ url: 'hosted:demo-city' })

    expect(spec?.maximumScreenSpaceError).toBe(16)
    expect(spec?.heightOffset).toBe(0)
  })

  it('渲染参数给了就用给的', () => {
    const spec = parseTilesetSpec({
      url: 'hosted:demo-city',
      maximumScreenSpaceError: 4,
      heightOffset: -12
    })

    expect(spec?.maximumScreenSpaceError).toBe(4)
    expect(spec?.heightOffset).toBe(-12)
  })

  it('非 http(s) 且非站内路径的地址判为无效', () => {
    expect(parseTilesetSpec({ url: 'ftp://x/tileset.json' })).toBeUndefined()
    expect(parseTilesetSpec({ url: '' })).toBeUndefined()
    expect(parseTilesetSpec(null)).toBeUndefined()
    expect(parseTilesetSpec('hosted:demo-city')).toBeUndefined()
  })
})
