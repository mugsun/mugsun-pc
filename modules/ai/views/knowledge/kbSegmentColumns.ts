import { h } from 'vue'
import { ElButton, ElSwitch, ElTag } from 'element-plus'
import type { ColumnOption } from '@/types/component'

/** 改分段内容、启用停用要的权限码，和后端 /segment/submit、/segment/status 查的是同一个 */
export const KB_SEGMENT_EDIT_PERM = 'ai:kb-seg:edit'

export interface KbSegmentColumnDeps {
  t: (key: string) => string
  /** 当前账号有没有 KB_SEGMENT_EDIT_PERM；没有就只能看 */
  canEdit: boolean
  statusTag: (status: string) => {
    type: 'success' | 'danger' | 'warning' | 'info'
    label: string
  }
  onToggle: (row: any, enabled: boolean) => void
  onEdit: (row: any) => void
}

/** 分段表格的列。没有编辑权限时启用开关只显示状态、不能点，也没有操作列 */
export function kbSegmentColumns(deps: KbSegmentColumnDeps): ColumnOption[] {
  const { t, canEdit, statusTag, onToggle, onEdit } = deps
  const cols: ColumnOption[] = [
    { prop: 'seq', label: '#', width: 60 },
    { prop: 'content', label: t('aiKbDetail.content'), minWidth: 280, showOverflowTooltip: true },
    { prop: 'tokenCount', label: 'Tokens', width: 90 },
    {
      prop: 'vectorStatus',
      label: t('aiKbDetail.colVector'),
      width: 100,
      formatter: (row: any) => {
        const tag = statusTag(row.vectorStatus)
        return h(ElTag, { type: tag.type, size: 'small' }, () => tag.label)
      }
    },
    {
      prop: 'enabled',
      label: t('aiKbDetail.enabled'),
      width: 100,
      formatter: (row: any) =>
        h(ElSwitch, {
          modelValue: row.enabled === 1,
          disabled: !canEdit,
          'onUpdate:modelValue': (v: string | number | boolean) => {
            if (!canEdit) return
            onToggle(row, v === true || v === 1 || v === '1')
          },
          size: 'small'
        })
    }
  ]
  if (canEdit) {
    cols.push({
      prop: 'operation',
      label: t('aiKbDetail.colActions'),
      width: 100,
      formatter: (row: any) =>
        h(ElButton, { link: true, size: 'small', onClick: () => onEdit(row) }, () =>
          t('aiKbDetail.edit')
        )
    })
  }
  return cols
}
