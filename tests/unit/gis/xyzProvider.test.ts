import { describe, expect, it } from 'vitest'
import { layersForStyle, tileUrl } from '@/gis/types'
import { toDisplayLonLat, fromDisplayLonLat } from '@/gis/coord'
import { attributionOf, escapeAttribution, rememberAttributions } from '@/gis/attribution'

describe('自定义 XYZ 底图', () => {
  it('任意样式都只有一层 base', () => {
    expect(layersForStyle('img_label', 'xyz')).toEqual(['base'])
    expect(layersForStyle('vec', 'xyz')).toEqual(['base'])
    expect(tileUrl('xyz', 'base', '{z}', '{x}', '{y}')).toBe(
      '/api/system/gis/tile/xyz/base/{z}/{x}/{y}'
    )
  })

  it('按 WGS84 处理，不做 GCJ/BD 纠偏', () => {
    const p: [number, number] = [116.397428, 39.90923]
    expect(toDisplayLonLat(p, 'xyz')).toEqual(p)
    expect(fromDisplayLonLat(p, 'xyz')).toEqual(p)
  })

  it('归属文本按 provider 记忆并转义 HTML', () => {
    rememberAttributions([
      {
        provider: 'xyz',
        configured: true,
        enabled: true,
        attribution: '© OpenStreetMap contributors'
      }
    ])
    expect(attributionOf('xyz')).toBe('© OpenStreetMap contributors')
    expect(attributionOf('unknown')).toBe('')
    expect(escapeAttribution('<img src=x onerror=alert(1)>&"')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;'
    )
  })
})
