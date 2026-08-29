export type OverlayKind = 'vector' | 'heatmap' | 'xyz' | 'wms' | '3dtiles'

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

export interface TilesetSpec {
  /** tileset.json 地址：内置示例已在解析时展开成托管路径 */
  url: string
  /** 内置示例 code，外部切片没有此项 */
  hosted?: string
  maximumScreenSpaceError: number
  heightOffset: number
}

/** 内置示例切片的下发路径，与后端 GisTilesetController 对应 */
export function hostedTilesetUrl(code: string): string {
  return `/api/system/gis/tileset/${code}/tileset.json`
}

export function parseTilesetSpec(raw: unknown): TilesetSpec | undefined {
  const rec = (typeof raw === 'object' && raw ? raw : {}) as {
    url?: string
    hosted?: string
    maximumScreenSpaceError?: number
    heightOffset?: number
  }
  const hosted = String(rec.hosted || '').trim()
  const rawUrl = String(rec.url || '').trim()
  const url = hosted
    ? hostedTilesetUrl(hosted)
    : rawUrl.startsWith('hosted:')
      ? hostedTilesetUrl(rawUrl.slice('hosted:'.length))
      : rawUrl
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    return undefined
  }
  const sse = Number(rec.maximumScreenSpaceError)
  const offset = Number(rec.heightOffset)
  return {
    url,
    hosted: hosted || undefined,
    maximumScreenSpaceError: Number.isFinite(sse) && sse > 0 ? sse : 16,
    heightOffset: Number.isFinite(offset) ? offset : 0
  }
}
