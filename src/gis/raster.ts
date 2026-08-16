export type OverlayKind = 'vector' | 'heatmap' | 'xyz' | 'wms'

export interface RasterSpec {
  type: 'XYZ' | 'WMS'
  url: string
  layers?: string
  format?: string
}

export function parseRasterSpec(raw: unknown): RasterSpec | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }
  const rec = raw as { type?: string; url?: string; layers?: string; format?: string }
  const url = String(rec.url || '').trim()
  if (!/^https?:\/\//i.test(url)) {
    return undefined
  }
  if (rec.type === 'WMS' || rec.layers) {
    if (!String(rec.layers || '').trim()) {
      return undefined
    }
    return {
      type: 'WMS',
      url,
      layers: String(rec.layers).trim(),
      format: rec.format || 'image/png'
    }
  }
  if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) {
    return undefined
  }
  return { type: 'XYZ', url }
}
