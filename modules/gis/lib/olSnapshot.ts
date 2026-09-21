import type OlMap from 'ol/Map'

/** 把当前视口所有 canvas 合成 PNG，供下载或剪贴板。 */
export function snapshotOlMap(map: OlMap): Promise<string> {
  return new Promise((resolve, reject) => {
    map.once('rendercomplete', () => {
      try {
        const canvases = map.getViewport().querySelectorAll('canvas')
        if (!canvases.length) {
          reject(new Error('empty'))
          return
        }
        const first = canvases[0]
        if (!first) {
          reject(new Error('empty'))
          return
        }
        const out = document.createElement('canvas')
        out.width = first.width
        out.height = first.height
        const ctx = out.getContext('2d')
        if (!ctx) {
          reject(new Error('empty'))
          return
        }
        canvases.forEach((item) => {
          const opacity = Number.parseFloat(getComputedStyle(item).opacity || '1')
          ctx.globalAlpha = Number.isFinite(opacity) ? opacity : 1
          ctx.drawImage(item, 0, 0)
        })
        resolve(out.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    })
    map.renderSync()
  })
}

export function downloadDataUrl(dataUrl: string, name: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = name
  link.click()
}
