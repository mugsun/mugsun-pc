import type OlMap from 'ol/Map'
import OverviewMap from 'ol/control/OverviewMap'
import TileLayer from 'ol/layer/Tile'
import type BaseLayer from 'ol/layer/Base'
import { OL_ROLE_BASEMAP } from './olMap'

export interface OlOverviewHandle {
  setEnabled: (on: boolean) => void
  enabled: () => boolean
  destroy: () => void
}

/** 鹰眼：复用当前底图 source，避免再拉一家 OSM。 */
export function attachOverview(map: OlMap): OlOverviewHandle {
  let control: OverviewMap | undefined
  let on = false

  const cloneBases = (): BaseLayer[] =>
    map
      .getLayers()
      .getArray()
      .filter((layer) => layer.get('mugsunRole') === OL_ROLE_BASEMAP)
      .map((layer) => {
        const tile = layer as TileLayer
        return new TileLayer({ source: tile.getSource() ?? undefined })
      })

  return {
    setEnabled: (enabled) => {
      if (enabled === on) {
        return
      }
      on = enabled
      if (control) {
        map.removeControl(control)
        control = undefined
      }
      if (!enabled) {
        return
      }
      const layers = cloneBases()
      if (!layers.length) {
        on = false
        return
      }
      control = new OverviewMap({
        collapsed: false,
        collapseLabel: '«',
        label: '»',
        layers
      })
      map.addControl(control)
    },
    enabled: () => on,
    destroy: () => {
      if (control) {
        map.removeControl(control)
        control = undefined
      }
      on = false
    }
  }
}
