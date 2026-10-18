import { describe, expect, it } from 'vitest'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'
import { GEO_HEAT_EMPTY_KEY, geoHeatState, showGeoCount } from '@/views/track/shared/geoHeatState'

const pick = (msgs: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], msgs)

describe('geoHeatState：概览访问热力卡片状态', () => {
  it('构建开关关闭 → noBuild（不论 gisEnabled 与坐标数）', () => {
    expect(geoHeatState({ gisEnabled: true }, 10, false)).toBe('noBuild')
    expect(geoHeatState({ gisEnabled: false }, 0, false)).toBe('noBuild')
    expect(geoHeatState(null, 0, false)).toBe('noBuild')
  })

  it('构建开关打开、gisEnabled 不是 true → serviceOff', () => {
    expect(geoHeatState({ gisEnabled: false }, 10, true)).toBe('serviceOff')
    expect(geoHeatState({}, 10, true)).toBe('serviceOff')
    expect(geoHeatState(undefined, 0, true)).toBe('serviceOff')
  })

  it('GIS 可用：有坐标 → ready，没有 → noData', () => {
    expect(geoHeatState({ gisEnabled: true }, 3, true)).toBe('ready')
    expect(geoHeatState({ gisEnabled: true }, 0, true)).toBe('noData')
  })

  it('「精确坐标 N 条」只在 noData 时隐藏', () => {
    expect(showGeoCount('noData')).toBe(false)
    expect(showGeoCount('ready')).toBe(true)
    expect(showGeoCount('noBuild')).toBe(true)
    expect(showGeoCount('serviceOff')).toBe(true)
  })

  it('三种空态文案中英都有，且按约定取值', () => {
    for (const key of Object.values(GEO_HEAT_EMPTY_KEY)) {
      expect(typeof pick(zh, key)).toBe('string')
      expect(typeof pick(en, key)).toBe('string')
    }
    expect(pick(zh, GEO_HEAT_EMPTY_KEY.noBuild)).toBe('当前版本未包含地图模块，无法显示访问热力。')
    expect(pick(zh, GEO_HEAT_EMPTY_KEY.serviceOff)).toBe(
      'GIS 地图服务未启用，暂无法显示访问热力。请联系管理员在服务端启用后刷新页面。'
    )
    expect(pick(zh, GEO_HEAT_EMPTY_KEY.noData)).toBe(
      '暂无地域数据。开通 IP 属地后按省份统计；开启精确位置后可看热力。'
    )
    expect(pick(en, GEO_HEAT_EMPTY_KEY.noBuild)).toBe(
      'This build does not include the map module, so the visit heatmap is unavailable.'
    )
    expect(pick(en, GEO_HEAT_EMPTY_KEY.serviceOff)).toBe(
      'The GIS map service is not enabled, so the visit heatmap is unavailable. Ask an administrator to enable it on the server, then reload the page.'
    )
  })
})
