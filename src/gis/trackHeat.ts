import { newSketchId, type GisSketchFeature } from './types'

export interface TrackGeoPoint {
  lon: number
  lat: number
  eventName?: string
  ts?: number
  urlPath?: string
}

export function geoPointsToSketch(points: TrackGeoPoint[]): GisSketchFeature[] {
  const out: GisSketchFeature[] = []
  for (const p of points) {
    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) {
      continue
    }
    out.push({
      type: 'Feature',
      id: newSketchId(),
      properties: {
        name: p.eventName || 'geo',
        kind: 'point',
        visible: true
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] }
    })
  }
  return out
}
