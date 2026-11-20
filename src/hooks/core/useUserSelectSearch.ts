import { onMounted, ref } from 'vue'
import { fetchUserSelect } from '@/api/message'

export interface UserSelectOption {
  label: string
  value: number | string
}

export interface UserSelectSearchConfig {
  /**
   * 挂载时就取默认列表，默认 true。候选人要按某条数据去取的页面（比如审批里的转办、加签）传 false，
   * 等弹窗打开、知道是哪条数据时再调 `loadUsers`。
   */
  immediate?: boolean
  /**
   * 取候选人的接口，默认是用户管理的选人接口。换接口时让它自己不弹全局提示，
   * 页面把 `userLoadError` 显示在选人框旁边。
   */
  fetcher?: (keyword?: string) => Promise<UserSelectOption[] | null | undefined>
}

/** 远程搜索防抖间隔（毫秒） */
const SEARCH_DEBOUNCE_MS = 300

/** 接口没有给出原因时的说法 */
const LOAD_FAILED = '候选人加载失败。请稍后重试'

const reasonOf = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message ? message : LOAD_FAILED
}

/**
 * 用户选择器远程搜索（成千账号场景不下全量）：
 * - 默认挂载即拉默认列表（后端封顶 50 条启用用户）；`immediate: false` 时由页面调 `loadUsers`；
 * - `searchUsers` 供 ElSelect `remote-method`，关键字防抖后查询用户名/昵称；
 * - 已选中项始终保留在选项中（避免远程结果刷新后选中标签退化为原始 id）；
 * - `ensureUsers` 按 id 精确补拉（编辑回显场景，只走用户管理的选人接口）；
 * - 取候选人失败时原因在 `userLoadError`，列表只留已选中的人。
 */
export function useUserSelectSearch(config: UserSelectSearchConfig = {}) {
  const {
    immediate = true,
    fetcher = (keyword?: string) => fetchUserSelect(keyword ? { keyword } : undefined)
  } = config
  const userOptions = ref<UserSelectOption[]>([])
  const userSearching = ref(false)
  /** 最近一次取候选人失败的原因；重新去取时清空 */
  const userLoadError = ref('')
  /** 所有加载过的选项缓存（value → option） */
  const cache = new Map<number | string, UserSelectOption>()
  /** 当前已选中的 value（多选传数组、单选传单值，由页面 change 时同步） */
  const selectedValues = ref<Array<number | string>>([])
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  /** 只认最后发出的那次请求：前一次回来得晚，不能盖掉后一次的结果 */
  let latest = 0

  /** 选项 = 已选中项 ∪ 本次搜索结果（去重） */
  const rebuild = (results: UserSelectOption[]): void => {
    const merged = new Map<number | string, UserSelectOption>()
    selectedValues.value.forEach((v) => {
      const hit = cache.get(v)
      if (hit) merged.set(v, hit)
    })
    results.forEach((o) => merged.set(o.value, o))
    userOptions.value = [...merged.values()]
  }

  const load = async (keyword?: string): Promise<void> => {
    const mine = ++latest
    userSearching.value = true
    userLoadError.value = ''
    try {
      const list = (await fetcher(keyword)) || []
      if (mine !== latest) return
      list.forEach((o) => cache.set(o.value, o))
      rebuild(list)
    } catch (error) {
      if (mine !== latest) return
      userLoadError.value = reasonOf(error)
      rebuild([])
    } finally {
      if (mine === latest) userSearching.value = false
    }
  }

  /** ElSelect remote-method：关键字防抖搜索（空串回默认列表） */
  const searchUsers = (keyword: string): void => {
    if (debounceTimer) clearTimeout(debounceTimer)
    const kw = keyword.trim()
    debounceTimer = setTimeout(() => void load(kw || undefined), SEARCH_DEBOUNCE_MS)
  }

  /** 立即取默认列表（不防抖）：弹窗打开时调，还没发出去的搜索作废 */
  const loadUsers = (): Promise<void> => {
    if (debounceTimer) clearTimeout(debounceTimer)
    return load()
  }

  /** 页面在 ElSelect change 时同步当前选中值，保证已选项不因搜索刷新而丢标签 */
  const syncSelected = (value: number | string | Array<number | string> | undefined): void => {
    selectedValues.value = value == null ? [] : Array.isArray(value) ? [...value] : [value]
    rebuild(userOptions.value)
  }

  /** 编辑回显：按 id 精确补拉缺失选项 */
  const ensureUsers = async (ids: Array<number | string>): Promise<void> => {
    const missing = ids.filter((id) => !cache.has(id))
    if (!missing.length) return
    const list = (await fetchUserSelect({ ids: missing.join(',') })) || []
    list.forEach((o) => cache.set(o.value, o))
    rebuild(userOptions.value)
  }

  onMounted(() => {
    if (immediate) void load()
  })

  return {
    userOptions,
    userSearching,
    userLoadError,
    searchUsers,
    loadUsers,
    syncSelected,
    ensureUsers
  }
}
