/**
 * AI 流 foreach / parallel 契约（对齐 boot AiFlowControlConstants / AiFlowExecutor）。
 * 设计器 P0：属性面板有序 nodeId，不做画布子框；禁嵌套 foreach/parallel。
 */

export const TYPE_FOREACH = 'foreach'
export const TYPE_PARALLEL = 'parallel'

export const FOREACH_DEFAULT_MAX_ITERATIONS = 20
export const FOREACH_HARD_MAX_ITERATIONS = 100
export const PARALLEL_DEFAULT_MAX_BRANCHES = 8
export const PARALLEL_HARD_MAX_BRANCHES = 16
export const DEFAULT_TIMEOUT_MS = 120_000
export const MAX_TIMEOUT_MS = 300_000

export const AGG_ARRAY = 'array'
export const AGG_LAST = 'last'
export const AGG_NONE = 'none'
export const ON_FAIL_CONTINUE = 'continue'
export const ON_FAIL_ABORT = 'abort'

export const ERR_FOREACH_INPUT_NOT_ARRAY = 'AI_FOREACH_INPUT_NOT_ARRAY'
export const ERR_FOREACH_MAX_ITERATIONS = 'AI_FOREACH_MAX_ITERATIONS'
export const ERR_FOREACH_TIMEOUT = 'AI_FOREACH_TIMEOUT'
export const ERR_FOREACH_BODY_INVALID = 'AI_FOREACH_BODY_INVALID'
export const ERR_FOREACH_ITEM_ERROR = 'AI_FOREACH_ITEM_ERROR'
export const ERR_PARALLEL_BRANCH_INVALID = 'AI_PARALLEL_BRANCH_INVALID'
export const ERR_PARALLEL_TIMEOUT = 'AI_PARALLEL_TIMEOUT'
export const ERR_PARALLEL_BRANCH_FAILED = 'AI_PARALLEL_BRANCH_FAILED'

export type ParallelBranch = {
  id: string
  label?: string
  bodyNodeIds: string[]
  outputVar?: string
}

export function isControlType(type: string | undefined | null): boolean {
  const t = (type || '').toLowerCase()
  return t === TYPE_FOREACH || t === TYPE_PARALLEL
}

export function clampMaxIterations(configured: number): number {
  const v = !configured || configured <= 0 ? FOREACH_DEFAULT_MAX_ITERATIONS : configured
  return Math.min(v, FOREACH_HARD_MAX_ITERATIONS)
}

export function clampMaxBranches(configured: number): number {
  const v = !configured || configured <= 0 ? PARALLEL_DEFAULT_MAX_BRANCHES : configured
  return Math.min(v, PARALLEL_HARD_MAX_BRANCHES)
}

export function clampTimeoutMs(timeoutMs: number): number {
  if (!timeoutMs || timeoutMs <= 0) return DEFAULT_TIMEOUT_MS
  return Math.min(timeoutMs, MAX_TIMEOUT_MS)
}

/** 有序合并：保留旧序，再追加新选 */
export function syncOrderedIds(prev: string[] | undefined, next: string[]): string[] {
  const prevArr = Array.isArray(prev) ? prev : []
  const set = new Set(next)
  const kept = prevArr.filter((id) => set.has(id))
  const added = next.filter((id) => !prevArr.includes(id))
  return [...kept, ...added]
}

export function defaultForeachData(): Record<string, unknown> {
  return {
    type: TYPE_FOREACH,
    inputPath: '',
    itemVar: 'item',
    indexVar: 'index',
    maxIterations: FOREACH_DEFAULT_MAX_ITERATIONS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    aggregate: AGG_ARRAY,
    onItemFailure: ON_FAIL_CONTINUE,
    bodyMode: 'nodeIds',
    bodyNodeIds: [] as string[],
    outputVar: 'foreachResults'
  }
}

export function defaultParallelData(): Record<string, unknown> {
  return {
    type: TYPE_PARALLEL,
    waitAll: true,
    onBranchFailure: ON_FAIL_CONTINUE,
    maxBranches: PARALLEL_DEFAULT_MAX_BRANCHES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    branches: [
      { id: 'b1', label: '', bodyNodeIds: [] as string[], outputVar: 'branch_b1' },
      { id: 'b2', label: '', bodyNodeIds: [] as string[], outputVar: 'branch_b2' }
    ] as ParallelBranch[]
  }
}

export function defaultDataForType(type: string): Record<string, unknown> {
  if (type === TYPE_FOREACH) return defaultForeachData()
  if (type === TYPE_PARALLEL) return defaultParallelData()
  return {
    type,
    prompt: '',
    text: '',
    url: '',
    sql: '',
    knowledgeId: '',
    expression: '',
    value: 'true',
    outputVar: ''
  }
}

export type FlowNodeLike = {
  id: string
  data?: { type?: string; label?: unknown; [k: string]: unknown }
}

/** 可选 body 节点：排除自身与 foreach/parallel（禁嵌套） */
export function bodyCandidateNodes(
  nodes: FlowNodeLike[],
  selfId: string | undefined
): FlowNodeLike[] {
  return nodes.filter((n) => {
    if (selfId && n.id === selfId) return false
    const t = (n.data?.type || '').toLowerCase()
    return t !== TYPE_FOREACH && t !== TYPE_PARALLEL
  })
}

export type ControlValidateMsg = { code: string; message: string }

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function readBranches(data: Record<string, any> | undefined): ParallelBranch[] {
  const raw = data?.branches
  if (!Array.isArray(raw)) return []
  return raw.map((b: any, i: number) => ({
    id: String(b?.id ?? `b${i + 1}`).trim(),
    label: typeof b?.label === 'string' ? b.label : '',
    bodyNodeIds: asStringArray(b?.bodyNodeIds ?? b?.data?.bodyNodeIds),
    outputVar: typeof b?.outputVar === 'string' ? b.outputVar : `branch_${b?.id || i + 1}`
  }))
}

/**
 * 保存前校验 foreach/parallel；返回首个错误（code 对齐 boot）。
 * nodesById 用于检查 body 是否存在、是否嵌套。
 */
export function validateControlNode(
  node: FlowNodeLike,
  nodesById: Map<string, FlowNodeLike>
): ControlValidateMsg | null {
  const type = (node.data?.type || '').toLowerCase()
  const data = (node.data || {}) as Record<string, any>
  if (type === TYPE_FOREACH) {
    const inputPath = String(data.inputPath ?? '').trim()
    if (!inputPath) {
      return { code: ERR_FOREACH_INPUT_NOT_ARRAY, message: 'foreach 缺少 inputPath' }
    }
    const bodyIds = asStringArray(data.bodyNodeIds)
    if (!bodyIds.length) {
      return { code: ERR_FOREACH_BODY_INVALID, message: 'foreach bodyNodeIds 不能为空' }
    }
    const nest = checkBodyNoNest(bodyIds, nodesById)
    if (nest) return { code: ERR_FOREACH_BODY_INVALID, message: nest }
    const maxIter = Number(data.maxIterations)
    if (Number.isFinite(maxIter) && maxIter > FOREACH_HARD_MAX_ITERATIONS) {
      return {
        code: ERR_FOREACH_MAX_ITERATIONS,
        message: `maxIterations 硬顶 ${FOREACH_HARD_MAX_ITERATIONS}`
      }
    }
    const timeout = Number(data.timeoutMs)
    if (Number.isFinite(timeout) && timeout > MAX_TIMEOUT_MS) {
      return { code: ERR_FOREACH_TIMEOUT, message: `timeoutMs 硬顶 ${MAX_TIMEOUT_MS}` }
    }
    return null
  }
  if (type === TYPE_PARALLEL) {
    const branches = readBranches(data)
    const maxBranches = clampMaxBranches(Number(data.maxBranches) || 0)
    if (branches.length < 2) {
      return { code: ERR_PARALLEL_BRANCH_INVALID, message: 'parallel 至少 2 个分支' }
    }
    if (branches.length > maxBranches) {
      return {
        code: ERR_PARALLEL_BRANCH_INVALID,
        message: `parallel 分支数超过上限 ${maxBranches}`
      }
    }
    if (branches.length > PARALLEL_HARD_MAX_BRANCHES) {
      return {
        code: ERR_PARALLEL_BRANCH_INVALID,
        message: `parallel 分支硬顶 ${PARALLEL_HARD_MAX_BRANCHES}`
      }
    }
    const seen = new Set<string>()
    for (const b of branches) {
      if (!b.id) {
        return { code: ERR_PARALLEL_BRANCH_INVALID, message: 'branch.id 不能为空' }
      }
      if (seen.has(b.id)) {
        return { code: ERR_PARALLEL_BRANCH_INVALID, message: `branch.id 重复: ${b.id}` }
      }
      seen.add(b.id)
      if (!b.bodyNodeIds.length) {
        return {
          code: ERR_PARALLEL_BRANCH_INVALID,
          message: `branch bodyNodeIds 不能为空: ${b.id}`
        }
      }
      const nest = checkBodyNoNest(b.bodyNodeIds, nodesById)
      if (nest) return { code: ERR_PARALLEL_BRANCH_INVALID, message: nest }
    }
    const timeout = Number(data.timeoutMs)
    if (Number.isFinite(timeout) && timeout > MAX_TIMEOUT_MS) {
      return { code: ERR_PARALLEL_TIMEOUT, message: `timeoutMs 硬顶 ${MAX_TIMEOUT_MS}` }
    }
    return null
  }
  return null
}

function checkBodyNoNest(bodyIds: string[], nodesById: Map<string, FlowNodeLike>): string | null {
  for (const id of bodyIds) {
    const n = nodesById.get(id)
    if (!n) return `body 节点不存在: ${id}`
    if (isControlType(n.data?.type)) return `P0 禁止嵌套 foreach/parallel: ${id}`
  }
  return null
}

/** 规范化写入 DSL 的 data（补默认、钳位） */
export function normalizeControlData(
  type: string | undefined,
  data: Record<string, any> | undefined
): Record<string, any> {
  const t = (type || data?.type || '').toLowerCase()
  const d = { ...(data || {}) }
  if (t === TYPE_FOREACH) {
    d.type = TYPE_FOREACH
    d.inputPath = String(d.inputPath ?? '').trim()
    d.itemVar = String(d.itemVar || 'item').trim() || 'item'
    d.indexVar = String(d.indexVar || 'index').trim() || 'index'
    d.maxIterations = clampMaxIterations(Number(d.maxIterations) || 0)
    d.timeoutMs = clampTimeoutMs(Number(d.timeoutMs) || 0)
    const agg = String(d.aggregate || AGG_ARRAY).toLowerCase()
    d.aggregate = [AGG_ARRAY, AGG_LAST, AGG_NONE].includes(agg) ? agg : AGG_ARRAY
    const onFail = String(d.onItemFailure || ON_FAIL_CONTINUE).toLowerCase()
    d.onItemFailure = onFail === ON_FAIL_ABORT ? ON_FAIL_ABORT : ON_FAIL_CONTINUE
    d.bodyMode = 'nodeIds'
    d.bodyNodeIds = asStringArray(d.bodyNodeIds)
    d.outputVar = String(d.outputVar || 'foreachResults').trim() || 'foreachResults'
    return d
  }
  if (t === TYPE_PARALLEL) {
    d.type = TYPE_PARALLEL
    d.waitAll = d.waitAll !== false
    d.onBranchFailure = ON_FAIL_CONTINUE
    d.maxBranches = clampMaxBranches(Number(d.maxBranches) || 0)
    d.timeoutMs = clampTimeoutMs(Number(d.timeoutMs) || 0)
    const branches = readBranches(d).map((b, i) => ({
      id: b.id || `b${i + 1}`,
      label: b.label || '',
      bodyNodeIds: b.bodyNodeIds,
      outputVar: (b.outputVar || `branch_${b.id || i + 1}`).trim()
    }))
    d.branches =
      branches.length >= 2 ? branches : (defaultParallelData().branches as ParallelBranch[])
    return d
  }
  return d
}

export type ControlNodeOutput = {
  nodeId: string
  nodeType: string
  status?: string
  truncated?: boolean
  partial?: boolean
  iterations?: unknown[]
  branches?: unknown[]
  parallelResults?: Record<string, unknown>
  inputCount?: number
  ranCount?: number
  errorCode?: string
  output?: string
  raw?: unknown
}

/** 从 runDetail.nodes[].outputJson 或 mock nodeOutputs 抽出可展示控制节点结果 */
export function extractControlOutputs(
  nodes: Array<{ nodeId?: string; nodeType?: string; type?: string; outputJson?: string | object }>
): ControlNodeOutput[] {
  const out: ControlNodeOutput[] = []
  for (const n of nodes || []) {
    const nodeType = String(n.nodeType || n.type || '').toLowerCase()
    if (!isControlType(nodeType)) continue
    let parsed: any = n.outputJson
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        parsed = {}
      }
    }
    if (!parsed || typeof parsed !== 'object') parsed = {}
    out.push({
      nodeId: String(n.nodeId || ''),
      nodeType,
      status: parsed.status,
      truncated: Boolean(parsed.truncated),
      partial: Boolean(parsed.partial),
      iterations: Array.isArray(parsed.iterations) ? parsed.iterations : undefined,
      branches: Array.isArray(parsed.branches) ? parsed.branches : undefined,
      parallelResults:
        parsed.parallelResults && typeof parsed.parallelResults === 'object'
          ? parsed.parallelResults
          : undefined,
      inputCount: parsed.inputCount,
      ranCount: parsed.ranCount,
      errorCode: parsed.errorCode,
      output: parsed.output,
      raw: parsed
    })
  }
  return out
}

/** DEV + 显式 true 才启用本地假数据（默认关） */
export function isAiFlowControlMockEnabled(
  env: { DEV?: boolean; VITE_AI_FLOW_CONTROL_MOCK?: string } = import.meta.env as {
    DEV?: boolean
    VITE_AI_FLOW_CONTROL_MOCK?: string
  }
): boolean {
  return (
    Boolean(env.DEV) &&
    String(env.VITE_AI_FLOW_CONTROL_MOCK ?? '')
      .trim()
      .toLowerCase() === 'true'
  )
}
