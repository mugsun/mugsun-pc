import formCreate from '@form-create/element-ui'
import FcDesigner from '@form-create/designer'
import type { DragRule } from '@form-create/designer'
import GisPick from './GisPick.vue'

/** 把地图选点挂到 form-create 运行时 + 设计器左侧「辅助」栏 */
export function registerGisPick(): void {
  formCreate.component('gisPick', GisPick)
  FcDesigner.component('gisPick', GisPick)
  const rule: DragRule = {
    menu: 'aide',
    icon: 'icon-location',
    label: '地图选点',
    name: 'gisPick',
    languageKey: [],
    input: true,
    mask: false,
    rule() {
      return {
        type: 'gisPick',
        field: `loc_${Date.now().toString(36)}`,
        title: '位置',
        info: '在地图上点击拾取坐标',
        $required: false
      }
    },
    props() {
      return []
    }
  }
  FcDesigner.addDragRule(rule)
}
