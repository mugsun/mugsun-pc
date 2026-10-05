/**
 * useTableColumnPersist - 表格列配置持久化
 *
 * 与 useTable 配合：将列的顺序、显隐、列宽按「当前用户 + 表格标识」持久化到后端，
 * 刷新或重新登录后自动恢复，并支持一键恢复默认。
 *
 * 列宽走 el-table 表头拖拽（header-dragend），顺序/显隐复用工具栏列设置面板。
 *
 * @module useTableColumnPersist
 * @author Mugsun
 */

import { watch, nextTick, onUnmounted, type Ref } from 'vue'
import type { ColumnOption } from '@/types/component'
import { getColumnKey, getColumnVisibility } from '@/hooks/core/useTableColumns'
import {
  fetchGetTableColumn,
  fetchSaveTableColumn,
  fetchResetTableColumn
} from '@/api/table-column'

/** 持久化的单列结构（后端不解析，前端自定义） */
interface PersistedColumn {
  key: string
  visible: boolean
  width?: number | string
}

interface UseTableColumnPersistOptions {
  /** 表格唯一标识（同一用户下区分不同表格） */
  tableKey: string
  /** useTable 暴露的列勾选状态 */
  columnChecks: Ref<ColumnOption[]>
  /** 出厂默认列工厂（与 useTable 同一个），用于合并与恢复 */
  columnsFactory: () => ColumnOption[]
  /** useTable 暴露的整表列重设 */
  setColumns: (cols: ColumnOption[]) => void
  /** useTable 暴露的重置到出厂默认 */
  resetColumns: () => void
  /** 保存防抖毫秒，默认 600 */
  debounce?: number
}

export function useTableColumnPersist(options: UseTableColumnPersistOptions) {
  const { tableKey, columnChecks, columnsFactory, setColumns, resetColumns } = options
  const debounce = options.debounce ?? 600
  // 加载 / 恢复期间抑制自动保存，避免回写刚拉取的配置
  let applying = false

  /** 序列化当前列状态：顺序即数组序 */
  const serialize = (): PersistedColumn[] =>
    columnChecks.value.map((c) => {
      const item: PersistedColumn = { key: getColumnKey(c), visible: getColumnVisibility(c) }
      if (c.width != null && c.width !== '') item.width = c.width
      return item
    })

  /** 将保存的配置合并进出厂默认列（兼容代码侧新增/删除列的演进） */
  const merge = (saved: PersistedColumn[]): ColumnOption[] => {
    const factory = columnsFactory()
    const byKey = new Map(factory.map((c) => [getColumnKey(c), c]))
    const ordered: ColumnOption[] = []
    // 1. 按保存的顺序恢复仍存在的列
    for (const s of saved) {
      const col = byKey.get(s.key)
      if (!col) continue // 代码已移除的列，丢弃
      ordered.push({
        ...col,
        visible: s.visible,
        checked: s.visible,
        ...(s.width != null ? { width: s.width } : {})
      })
      byKey.delete(s.key)
    }
    // 2. 追加保存中没有、出厂新增的列（保持出厂相对顺序）
    for (const col of factory) {
      if (byKey.has(getColumnKey(col))) ordered.push(col)
    }
    return ordered
  }

  /** 拉取后端配置并应用 */
  const load = async () => {
    try {
      const record: any = await fetchGetTableColumn(tableKey)
      if (!record?.configJson) return
      const saved = JSON.parse(record.configJson) as PersistedColumn[]
      if (!Array.isArray(saved) || !saved.length) return
      applying = true
      setColumns(merge(saved))
      await nextTick()
    } catch (e) {
      console.warn('[表格列配置] 加载失败', e)
    } finally {
      applying = false
    }
  }

  /** 防抖保存 */
  let timer: ReturnType<typeof setTimeout> | null = null
  const flushSave = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    fetchSaveTableColumn(tableKey, JSON.stringify(serialize())).catch((e) =>
      console.warn('[表格列配置] 保存失败', e)
    )
  }
  const save = () => {
    if (applying) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(flushSave, debounce)
  }

  // 列状态变化即保存（顺序 / 显隐 / 列宽）
  watch(columnChecks, save, { deep: true })

  // 卸载时兜底 flush 未决的防抖保存，避免改动后 debounce 窗内立即离开路由丢失最后一次
  onUnmounted(() => {
    if (timer) flushSave()
  })

  /** 恢复默认：删后端记录成功后才回出厂默认列 */
  const resetToDefault = async () => {
    applying = true
    try {
      await fetchResetTableColumn(tableKey)
      resetColumns()
      await nextTick()
    } finally {
      applying = false
    }
  }

  /** el-table 表头拖拽结束：写回列宽（经 setColumns 保证与顺序一致） */
  const onHeaderDragend = (newWidth: number, _oldWidth: number, column: { property?: string }) => {
    const key = column?.property
    if (!key) return
    setColumns(
      columnChecks.value.map((c) =>
        getColumnKey(c) === key ? { ...c, width: newWidth } : { ...c }
      )
    )
  }

  load()

  return { resetToDefault, onHeaderDragend }
}
