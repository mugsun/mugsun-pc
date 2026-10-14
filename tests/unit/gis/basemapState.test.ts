import { describe, expect, it } from 'vitest'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'
import {
  basemapDocUrl,
  basemapErrorKind,
  basemapStateOf,
  isCanceled,
  GIS_BASEMAP_DOC_EN,
  GIS_BASEMAP_DOC_ZH
} from '@/gis/basemapState'

const p = (provider: string, configured: boolean, enabled: boolean) => ({
  provider,
  configured,
  enabled
})

describe('底图空状态判定（以后端 status 为准）', () => {
  it('没有「已配置且启用」的底图 → unconfigured', () => {
    expect(
      basemapStateOf({
        enabled: true,
        providers: [p('tianditu', false, false), p('amap', true, false), p('xyz', false, false)]
      })
    ).toBe('unconfigured')
    expect(basemapStateOf({ enabled: true, providers: [] })).toBe('unconfigured')
  })

  it('任一底图已配置且启用（含默认 OSM 预设）→ ready', () => {
    expect(
      basemapStateOf({
        enabled: true,
        providers: [p('tianditu', false, false), p('xyz', true, true)]
      })
    ).toBe('ready')
  })

  it('模块关闭与取不到状态分别处理，不当成未配置', () => {
    expect(basemapStateOf({ enabled: false, providers: [] })).toBe('moduleOff')
    expect(basemapStateOf(null)).toBe('error')
  })

  it('网络错误和服务端错误区分', () => {
    expect(basemapErrorKind({ code: 400, message: '网络连接异常' })).toBe('network')
    expect(basemapErrorKind(new Error('timeout'))).toBe('network')
    expect(basemapErrorKind({ code: 500, data: { msg: 'boom' } })).toBe('server')
    expect(isCanceled({ canceled: true })).toBe(true)
    expect(isCanceled({ code: 400 })).toBe(false)
  })

  it('文档链接按语言指向 gis-basemap 页', () => {
    expect(basemapDocUrl('zh')).toBe(GIS_BASEMAP_DOC_ZH)
    expect(basemapDocUrl('en')).toBe(GIS_BASEMAP_DOC_EN)
    expect(GIS_BASEMAP_DOC_ZH).toBe('https://docs.mugsun.com/pc/gis-basemap')
  })

  it('中英文文案齐全，且不含 vue-i18n 需要转义的字符', () => {
    const zk = zh.pages.gis.basemapEmpty as Record<string, string>
    const ek = en.pages.gis.basemapEmpty as Record<string, string>
    expect(Object.keys(zk).sort()).toEqual(Object.keys(ek).sort())
    for (const v of [...Object.values(zk), ...Object.values(ek)]) {
      expect(v).not.toMatch(/[{}@|]/)
    }
    expect(zk.tipTianditu).toContain('天地图')
    expect(zk.tipXyz).toContain('XYZ')
    expect(ek.tipXyz).toContain('OpenStreetMap')
  })
})
