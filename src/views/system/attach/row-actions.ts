/**
 * 附件表格操作列（下载 / 删除）
 *
 * 从 index.vue 抽出，便于挂载测试：删除按钮按 sys:file:remove（FileController 同码）
 * 判断，没有权限时不渲染。
 *
 * @module views/system/attach/row-actions
 * @author Mugsun
 */

import { h, type VNode } from 'vue'
import { ElButton } from 'element-plus'
import { hasPerm } from '@/utils/permission'

export interface AttachRowActionOptions {
  t: (key: string) => string
  onDownload: (row: any) => void
  onDelete: (row: any) => void
}

export function renderAttachRowActions(row: any, opts: AttachRowActionOptions): VNode {
  return h('div', { class: 'flex gap-1' }, [
    h(
      ElButton,
      { link: true, type: 'primary', size: 'small', onClick: () => opts.onDownload(row) },
      () => opts.t('pages.system.attach.downloadBtn')
    ),
    hasPerm('sys:file:remove')
      ? h(
          ElButton,
          {
            link: true,
            type: 'danger',
            size: 'small',
            class: 'attach-row-delete',
            onClick: () => opts.onDelete(row)
          },
          () => opts.t('common.delete')
        )
      : null
  ])
}
