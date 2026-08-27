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
export interface GNode {
  id: string
  type: 'approval' | 'condition' | 'parallel'
  name: string
  candidates: { type: string; value: string }[]
  nodeRatio: string
  branches: GBranch[]
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

// 节点数组 → 后端递归 DTO（childNode 单链 + branches[].childNode）
export const toTree = (nodes: GNode[], i = 0): any => {
  if (i >= nodes.length) return null
  const n = nodes[i]
  const out: any = { type: n.type, name: n.name, childNode: toTree(nodes, i + 1) }
  if (n.type === 'approval') {
    out.candidates = n.candidates.map(candidateToken).filter(Boolean)
    out.nodeRatio = n.nodeRatio
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

// 校验：审批节点须有候选人；条件分支须有非空分支
export const validateTree = (nodes: GNode[]): string => {
  for (const n of nodes) {
    if (n.type === 'approval') {
      if (!n.candidates.map(candidateToken).filter(Boolean).length)
        return $t('pages.system.flowGraph.errNodeNoCandidate', { name: n.name })
    } else {
      if (n.type === 'parallel' && n.branches.length < 2)
        return $t('pages.system.flowGraph.errParallelMinBranch', { name: n.name })
      if (!n.branches.length) return $t('pages.system.flowGraph.errBranchMin', { name: n.name })
      for (const b of n.branches) {
        if (n.type === 'condition' && !b.isDefault && !b.conditions.filter((r) => r.field).length)
          return $t('pages.system.flowGraph.errConditionRequired', { name: b.name })
        const sub = validateTree(b.children)
        if (sub) return sub
      }
    }
  }
  return ''
}
