import { ref, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { $t } from '@/locales'
import { useTable } from './useTable'
import type { DialogType } from '@/types'
import type { ColumnOption } from '@/types/component'

/**
 * useCrud — 页面级 CRUD 一体封装
 *
 * 在 useTable 之上收敛「列表 + 弹窗 + 删除 + 保存」样板：
 * - 复用 useTable 智能刷新（refreshRemove 删后页码自动回退 / refreshCreate 回首页 / refreshUpdate 保持页）
 * - 收敛弹窗态（dialogVisible/dialogType/currentRow/showDialog）与 handleDelete/handleSubmit
 * - 默认 responseAdapter 兼容 mybatis-flex 分页体（records/totalRow）与纯数组
 *
 * @module hooks/core/useCrud
 * @author Mugsun
 */

/** mybatis-flex 分页体 / 纯数组 通用适配 */
function smartAdapter(resp: any) {
  if (Array.isArray(resp)) {
    return { records: resp, total: resp.length, current: 1, size: resp.length || 10 }
  }
  return {
    records: resp?.records ?? [],
    total: resp?.totalRow ?? resp?.total ?? 0,
    current: resp?.pageNumber ?? resp?.current ?? 1,
    size: resp?.pageSize ?? resp?.size ?? 10
  }
}

interface UseCrudOptions<TApiFn extends (params: any) => Promise<any>> {
  /** 列表查询 API（返回分页体或纯数组） */
  listApi: TApiFn
  /** 保存 API（新增/编辑同端点，可选——只读页可不传） */
  saveApi?: (form: Record<string, any>) => Promise<any>
  /** 删除 API（按 id） */
  removeApi?: (id: any) => Promise<any>
  /** 列工厂 */
  columnsFactory?: () => ColumnOption<any>[]
  /** 默认请求参数（分页页取 { pageNum, pageSize }） */
  apiParams?: Record<string, any>
  /** 分页字段映射，默认后端 pageNum/pageSize */
  paginationKey?: { current?: string; size?: string }
  /** 主键字段，默认 id */
  idKey?: string
  /** 实体标签（删除确认文案，如「参数」） */
  label?: string
  /** 取行显示名（删除确认用），默认取 name/*Name/id */
  rowName?: (row: Record<string, any>) => string
  /** 自定义响应适配（覆盖 smartAdapter） */
  responseAdapter?: (resp: any) => any
}

export function useCrud<TApiFn extends (params: any) => Promise<any>>(
  options: UseCrudOptions<TApiFn>
) {
  const {
    listApi,
    saveApi,
    removeApi,
    columnsFactory,
    apiParams = { pageNum: 1, pageSize: 20 },
    paginationKey = { current: 'pageNum', size: 'pageSize' },
    idKey = 'id',
    label = $t('hooks.crud.defaultLabel'),
    rowName,
    responseAdapter = smartAdapter
  } = options

  const table = useTable({
    core: { apiFn: listApi, apiParams: apiParams as any, paginationKey, columnsFactory },
    transform: { responseAdapter }
  })

  const dialogVisible = ref(false)
  const dialogType = ref<DialogType>('add')
  const currentRow = ref<Record<string, any>>({})

  const nameOf = (row: Record<string, any>): string =>
    rowName ? rowName(row) : (row?.name ?? row?.[`${label}Name`] ?? row?.[idKey] ?? '')

  /** 打开新增/编辑弹窗（编辑传入副本，避免直改列表行） */
  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentRow.value = row ? { ...row } : {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  /** 删除（确认 → removeApi → 删后页码自动回退） */
  const handleDelete = (row: Record<string, any>): void => {
    ElMessageBox.confirm(
      $t('hooks.crud.deleteConfirmMessage', { label, name: nameOf(row) }),
      $t('hooks.crud.deleteConfirmTitle', { label }),
      {
        confirmButtonText: $t('common.confirm'),
        cancelButtonText: $t('common.cancel'),
        type: 'warning'
      }
    ).then(
      async () => {
        if (!removeApi) return
        await removeApi(row[idKey])
        ElMessage.success($t('common.deleteSuccess'))
        await table.refreshRemove()
      },
      () => {
        // 取消时 ElMessageBox 以 'cancel' 拒绝；只吞确认框的拒绝，删除接口的错误仍交由请求层提示
      }
    )
  }

  /** 保存（新增回首页 / 编辑保持当前页） */
  const handleSubmit = async (form: Record<string, any>): Promise<void> => {
    if (saveApi) await saveApi(form)
    dialogVisible.value = false
    if (!saveApi) return
    ElMessage.success($t('common.saveSuccess'))
    await (dialogType.value === 'add' ? table.refreshCreate() : table.refreshUpdate())
  }

  return {
    ...table,
    // 弹窗态
    dialogVisible,
    dialogType,
    currentRow,
    // 操作
    showDialog,
    handleDelete,
    handleSubmit
  }
}
