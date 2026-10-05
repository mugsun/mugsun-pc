import request from '@/utils/http'

/** 取当前用户某表格的列配置，无则返回 null */
export function fetchGetTableColumn(tableKey: string) {
  return request.get<any>({ url: '/api/system/table-column/get', params: { tableKey } })
}

/** 保存列配置（顺序/显隐/宽 JSON 串） */
export function fetchSaveTableColumn(tableKey: string, configJson: string) {
  return request.post<void>({
    url: '/api/system/table-column/save',
    data: { tableKey, configJson }
  })
}

/** 恢复默认：删除当前用户该表配置 */
export function fetchResetTableColumn(tableKey: string) {
  return request.post<void>({
    url: `/api/system/table-column/reset/${tableKey}`,
    data: {},
    showSuccessMessage: true
  })
}
