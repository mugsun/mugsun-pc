import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import type OlMap from 'ol/Map'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import type { GisProviderCode } from './types'
import { toDisplayLonLat } from './coord'

export interface PlaybackSample {
  lon: number
  lat: number
  t: number
}

export interface OlPlaybackHandle {
  play: () => void
  pause: () => void
  stop: () => void
  setSpeed: (n: number) => void
  seek: (ratio: number) => void
  destroy: () => void
}

interface Opts {
  durationSec: number
  onTick: (state: { ratio: number; clock: number; lon: number; lat: number }) => void
}

const toMap = (lon: number, lat: number, provider: GisProviderCode): [number, number] =>
  fromLonLat(toDisplayLonLat([lon, lat], provider)) as [number, number]

/**
 * 沿时间戳折线插值：播放 / 暂停 / 倍速 / 拖进度。
 */
export function attachOlPlayback(
  map: OlMap,
  samples: PlaybackSample[],
  provider: GisProviderCode,
  opts: Opts
): OlPlaybackHandle {
  const sorted = [...samples].sort((a, b) => a.t - b.t)
  const duration = Math.max(opts.durationSec, sorted.at(-1)?.t || 1)
  const path = new LineString(sorted.map((s) => toMap(s.lon, s.lat, provider)))
  const trail = new LineString([path.getFirstCoordinate() ?? [0, 0]])
  const mover = new Feature({ geometry: new Point(path.getFirstCoordinate() ?? [0, 0]) })
  const lineFeat = new Feature({ geometry: path })
  const trailFeat = new Feature({ geometry: trail })
  const source = new VectorSource({ features: [lineFeat, trailFeat, mover] })
  const layer = new VectorLayer({
    className: 'gis-ol-playback',
    zIndex: 40,
    source,
    style: (feat) => {
      if (feat === mover) {
        return new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: '#2563eb' }),
            stroke: new Stroke({ color: '#fff', width: 2 })
          })
        })
      }
      if (feat === trailFeat) {
        return new Style({
          stroke: new Stroke({ color: '#f97316', width: 5, lineCap: 'round' })
        })
      }
      return new Style({
        stroke: new Stroke({ color: '#64748b', width: 3, lineDash: [8, 8] })
      })
    }
  })
  map.addLayer(layer)

  let speed = 1
  let playing = false
  let clock = 0
  let lastTs = 0
  let raf = 0

  const atTime = (sec: number): { lon: number; lat: number } => {
    if (sorted.length === 1) {
      return { lon: sorted[0].lon, lat: sorted[0].lat }
    }
    const t = Math.min(Math.max(sec, 0), duration)
    let i = 0
    while (i < sorted.length - 2 && sorted[i + 1].t < t) {
      i += 1
    }
    const a = sorted[i]
    const b = sorted[Math.min(i + 1, sorted.length - 1)]
    const span = Math.max(b.t - a.t, 0.0001)
    const u = Math.min(1, Math.max(0, (t - a.t) / span))
    return { lon: a.lon + (b.lon - a.lon) * u, lat: a.lat + (b.lat - a.lat) * u }
  }

  const paint = (): void => {
    const pos = atTime(clock)
    const coord = toMap(pos.lon, pos.lat, provider)
    ;(mover.getGeometry() as Point).setCoordinates(coord)
    const keep: number[][] = []
    for (const s of sorted) {
      if (s.t <= clock) {
        keep.push(toMap(s.lon, s.lat, provider))
      }
    }
    keep.push(coord)
    trail.setCoordinates(keep)
    opts.onTick({ ratio: duration ? clock / duration : 0, clock, lon: pos.lon, lat: pos.lat })
  }

  const step = (ts: number): void => {
    if (!playing) {
      return
    }
    if (lastTs) {
      clock = Math.min(duration, clock + ((ts - lastTs) / 1000) * speed)
    }
    lastTs = ts
    paint()
    if (clock >= duration) {
      playing = false
      return
    }
    raf = requestAnimationFrame(step)
  }

  paint()
  map.getView().fit(path, { padding: [64, 64, 88, 64], maxZoom: 15, duration: 240 })

  return {
    play: () => {
      if (playing) {
        return
      }
      if (clock >= duration) {
        clock = 0
      }
      playing = true
      lastTs = 0
      raf = requestAnimationFrame(step)
    },
    pause: () => {
      playing = false
      lastTs = 0
      if (raf) {
        cancelAnimationFrame(raf)
      }
    },
    stop: () => {
      playing = false
      lastTs = 0
      clock = 0
      if (raf) {
        cancelAnimationFrame(raf)
      }
      paint()
    },
    setSpeed: (n) => {
      speed = Math.max(0.25, n)
    },
    seek: (ratio) => {
      clock = duration * Math.min(1, Math.max(0, ratio))
      paint()
    },
    destroy: () => {
      playing = false
      if (raf) {
        cancelAnimationFrame(raf)
      }
      map.removeLayer(layer)
      source.clear()
    }
  }
}

export function samplesFromTrack(raw: unknown): { samples: PlaybackSample[]; durationSec: number } {
  const rec = raw as {
    features?: Array<{ geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }>
  }
  const feat = rec.features?.[0]
  const coords = feat?.geometry?.coordinates
  if (!Array.isArray(coords)) {
    return { samples: [], durationSec: 1 }
  }
  const times = Array.isArray(feat?.properties?.times) ? (feat.properties.times as number[]) : []
  const samples: PlaybackSample[] = []
  coords.forEach((pt, i) => {
    if (!Array.isArray(pt) || pt.length < 2) {
      return
    }
    samples.push({
      lon: Number(pt[0]),
      lat: Number(pt[1]),
      t: Number.isFinite(Number(times[i])) ? Number(times[i]) : i * 5
    })
  })
  const durationSec = Number(feat?.properties?.durationSec) || samples.at(-1)?.t || 1
  return { samples, durationSec }
}
