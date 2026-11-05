// 图形流程设计的前端模型：节点树（数组表示）+ 提交前转递归 DTO
import { $t } from '@/locales'

let seq = 0
const uid = (): string => `g${Date.now().toString(36)}${(seq++).toString(36)}`

export interface Rule {
  field: string
  op: string
  value: string
}
export interface GBranch {
  id: string
  name: string
  conditions: Rule[]
  logic: 'AND' | 'OR'
  isDefault: boolean
  children: GNode[]
}

/** KV 映射一行（设计器编辑用；提交时压成 Record） */
export interface GMapEntry {
  key: string
  value: string
}

export interface GNode {
  id: string
  type: 'approval' | 'condition' | 'parallel' | 'ai'
  name: string
  candidates: { type: string; value: string }[]
  nodeRatio: string
  branches: GBranch[]
  /** AI 节点：已启用 AiApp id（Long；前端按 string|number 存） */
  aiFlowId?: string | number
  inputMap?: GMapEntry[]
  outputMap?: GMapEntry[]
  timeoutMs?: number
  /** rejectLast | stay | transfer:role:<code> */
  onFailure?: string
}

export const newBranch = (name = $t('pages.system.flowGraph.branch')): GBranch => ({
  id: uid(),
  name,
  conditions: [],
  logic: 'AND',
  isDefault: false,
  children: []
})

export const newNode = (type: string): GNode => {
  const base: GNode = {
    id: uid(),
    type: type as GNode['type'],
    name: '',
    candidates: [{ type: 'role', value: 'admin' }],
    nodeRatio: '0',
    branches: []
  }
  if (type === 'condition') {
    base.name = $t('pages.system.flowGraph.typeCondition')
    base.branches = [
      newBranch($t('pages.system.flowGraph.branchOne')),
      { ...newBranch($t('pages.system.flowGraph.branchElse')), isDefault: true }
    ]
  } else if (type === 'parallel') {
    base.name = $t('pages.system.flowGraph.typeParallel')
    base.branches = [
      newBranch($t('pages.system.flowGraph.branchOne')),
      newBranch($t('pages.system.flowGraph.branchTwo'))
    ]
  } else if (type === 'ai') {
    base.name = $t('pages.system.flowGraph.typeAi')
    base.candidates = []
    base.aiFlowId = ''
    base.inputMap = []
    base.outputMap = []
    base.timeoutMs = 120000
    base.onFailure = 'rejectLast'
  } else {
    base.name = $t('pages.system.flowGraph.typeApproval')
  }
  return base
}

// 单个候选人 → storageId 前缀 token（与后端 FlowConstants 前缀一致）
const candidateToken = (c: { type: string; value: string }): string => {
  if (c.type === 'initiator') return 'initiator'
  if (c.type === 'deptLeader') return 'deptLeader'
  return c.value ? `${c.type}:${c.value}` : ''
}

const entriesToMap = (entries?: GMapEntry[]): Record<string, string> | undefined => {
  if (!entries?.length) return undefined
  const out: Record<string, string> = {}
  for (const e of entries) {
    const k = (e.key || '').trim()
    if (!k) continue
    out[k] = e.value ?? ''
  }
  return Object.keys(out).length ? out : undefined
}

const ON_FAILURE_OK = (v: string): boolean =>
  v === 'rejectLast' || v === 'stay' || /^transfer:role:[A-Za-z0-9_.-]+$/.test(v)

/** outputMap 目标键白名单：固定写回变量或 ai_ext_* */
const OUTPUT_TARGET_OK = (k: string): boolean =>
  k === 'ai_summary' ||
  k === 'ai_pass' ||
  k === 'ai_reason' ||
  k === 'ai_run_id' ||
  /^ai_ext_[A-Za-z0-9_]+$/.test(k)

// 节点数组 → 后端递归 DTO（childNode 单链 + branches[].childNode）
export const toTree = (nodes: GNode[], i = 0): any => {
  if (i >= nodes.length) return null
  const n = nodes[i]
  const out: any = { type: n.type, name: n.name, childNode: toTree(nodes, i + 1) }
  if (n.type === 'approval') {
    out.candidates = n.candidates.map(candidateToken).filter(Boolean)
    out.nodeRatio = n.nodeRatio
  } else if (n.type === 'ai') {
    out.aiFlowId = n.aiFlowId === '' || n.aiFlowId == null ? undefined : n.aiFlowId
    // inputMap 强制字段：始终带上（空对象 = 零注入）
    out.inputMap = entriesToMap(n.inputMap) ?? {}
    const outputMap = entriesToMap(n.outputMap)
    if (outputMap) out.outputMap = outputMap
    out.timeoutMs =
      n.timeoutMs == null || Number.isNaN(Number(n.timeoutMs)) ? 120000 : Number(n.timeoutMs)
    out.onFailure = (n.onFailure || 'rejectLast').trim() || 'rejectLast'
  } else {
    out.branches = n.branches.map((b) => ({
      name: b.name,
      logic: b.logic,
      conditions: b.isDefault ? [] : b.conditions.filter((r) => r.field && r.op),
      childNode: toTree(b.children, 0)
    }))
  }
  return out
}

const RULE_OPS = new Set(['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'like', 'notLike'])
const NODE_TYPES = new Set(['approval', 'condition', 'parallel', 'ai'])
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

// 校验：审批须有候选人；AI 须绑 aiFlowId+必填 inputMap（可为空对象）；条件分支须有非空分支
export const validateTree = (nodes: GNode[]): string => {
  for (const n of nodes) {
    if (!NODE_TYPES.has(n.type)) return $t('pages.system.flowGraph.errNodeType')
    if (n.type === 'approval') {
      const ratio = (n.nodeRatio || '').trim()
      if (ratio && (!/^-?\d+$/.test(ratio) || Number(ratio) < 0 || Number(ratio) > 100)) {
        return $t('pages.system.flowGraph.errRatio')
      }
      if (!n.candidates.map(candidateToken).filter(Boolean).length)
        return $t('pages.system.flowGraph.errNodeNoCandidate', { name: n.name })
    } else if (n.type === 'ai') {
      const aiName = (n.name || '').trim() || $t('pages.system.flowGraph.typeAi')
      const id = n.aiFlowId
      if (id === '' || id == null || (typeof id === 'string' && !id.trim())) {
        return $t('pages.system.flowGraph.errAiFlowId', { name: aiName })
      }
      // inputMap 字段必填：缺省 / null / undefined 失败；显式 []/仅空行 → {} 允许（零注入）
      if (n.inputMap == null) {
        return $t('pages.system.flowGraph.errAiInputMap', { name: aiName })
      }
      for (const e of n.inputMap) {
        const k = (e.key || '').trim()
        if (!k && !(e.value || '').trim()) continue
        if (!k || !FIELD_RE.test(k)) return $t('pages.system.flowGraph.errAiMapKey')
      }
      const timeout = n.timeoutMs == null ? 120000 : Number(n.timeoutMs)
      if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 300000) {
        return $t('pages.system.flowGraph.errAiTimeout')
      }
      const fail = (n.onFailure || 'rejectLast').trim() || 'rejectLast'
      if (!ON_FAILURE_OK(fail)) return $t('pages.system.flowGraph.errAiOnFailure')
      for (const e of n.outputMap || []) {
        const k = (e.key || '').trim()
        if (!k && !(e.value || '').trim()) continue
        if (!k || !FIELD_RE.test(k)) return $t('pages.system.flowGraph.errAiMapKey')
        if (!OUTPUT_TARGET_OK(k)) return $t('pages.system.flowGraph.errAiOutputMapKey')
      }
    } else {
      if (n.type === 'parallel' && n.branches.length < 2)
        return $t('pages.system.flowGraph.errParallelMinBranch', {
          name: (n.name || '').trim() || '未命名'
        })
      if (!n.branches.length)
        return $t('pages.system.flowGraph.errBranchMin', {
          name: (n.name || '').trim() || '未命名'
        })
      for (const b of n.branches) {
        if (
          n.type === 'condition' &&
          !b.isDefault &&
          b.conditions.some((r) => (r.field && !r.op) || (!r.field && r.op))
        ) {
          return $t('pages.system.flowGraph.errRuleIncomplete')
        }
        if (n.type === 'condition' && b.conditions.some((r) => r.op && !RULE_OPS.has(r.op))) {
          return $t('pages.system.flowGraph.errOpUnsupported')
        }
        if (
          n.type === 'condition' &&
          b.conditions.some(
            (r) => r.field && r.op && RULE_OPS.has(r.op) && !FIELD_RE.test(r.field.trim())
          )
        ) {
          return $t('pages.system.flowGraph.errFieldInvalid')
        }
        if (
          n.type === 'condition' &&
          b.conditions.some(
            (r) =>
              r.field &&
              r.op &&
              ((r.value || '').includes('|') ||
                (r.value || '').includes('@@') ||
                (r.value || '').includes('\n') ||
                (r.value || '').includes('\r'))
          )
        ) {
          return $t('pages.system.flowGraph.errValueInvalid')
        }
        if (n.type === 'condition' && !b.isDefault && !b.conditions.filter((r) => r.field).length)
          return $t('pages.system.flowGraph.errConditionRequired', { name: b.name })
        const sub = validateTree(b.children)
        if (sub) return sub
      }
    }
  }
  return ''
}
