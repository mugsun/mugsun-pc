<!-- 递归流程链：审批 / 条件 / 并行 / AI；条件/并行内嵌分支列 → 递归子链 -->
<template>
  <div class="g-chain">
    <div class="g-add">
      <GraphAdd @pick="(t: string) => insertAt(0, t)" />
    </div>
    <template v-for="(node, idx) in nodes" :key="node.id">
      <div class="g-node" :class="`g-node--${node.type}`">
        <div class="g-node-hd">
          <span class="g-type">{{ typeLabel(node.type) }}</span>
          <ElInput
            v-model="node.name"
            size="small"
            :placeholder="typeLabel(node.type)"
            class="g-name"
          />
          <ElButton link type="danger" size="small" @click="removeNode(idx)">{{
            $t('pages.system.flowGraph.delete')
          }}</ElButton>
        </div>

        <!-- 审批节点 -->
        <div v-if="node.type === 'approval'" class="g-node-bd">
          <div v-for="(c, ci) in node.candidates" :key="ci" class="g-cand">
            <ElSelect v-model="c.type" size="small" class="g-cand-type" @change="c.value = ''">
              <ElOption :label="$t('pages.system.flowGraph.role')" value="role" />
              <ElOption :label="$t('pages.system.flowGraph.dept')" value="dept" />
              <ElOption :label="$t('pages.system.flowGraph.specifiedUser')" value="user" />
              <ElOption :label="$t('pages.system.flowGraph.initiator')" value="initiator" />
              <ElOption :label="$t('pages.system.flowGraph.deptLeader')" value="deptLeader" />
            </ElSelect>
            <ElSelect
              v-if="c.type === 'role'"
              v-model="c.value"
              size="small"
              class="g-cand-val"
              :placeholder="$t('pages.system.flowGraph.role')"
            >
              <ElOption v-for="r in reg.roles" :key="r.value" :label="r.label" :value="r.value" />
            </ElSelect>
            <ElSelect
              v-else-if="c.type === 'dept'"
              v-model="c.value"
              size="small"
              class="g-cand-val"
              :placeholder="$t('pages.system.flowGraph.dept')"
            >
              <ElOption v-for="d in reg.depts" :key="d.value" :label="d.label" :value="d.value" />
            </ElSelect>
            <ElSelect
              v-else-if="c.type === 'user'"
              v-model="c.value"
              size="small"
              filterable
              remote
              :remote-method="reg.searchUsers"
              :loading="reg.userSearching"
              class="g-cand-val"
              :placeholder="$t('pages.system.flowGraph.userSearchPlaceholder')"
              @change="reg.syncSelected"
            >
              <ElOption v-for="u in reg.users" :key="u.value" :label="u.label" :value="u.value" />
            </ElSelect>
            <ElButton
              v-if="node.candidates.length > 1"
              link
              type="danger"
              size="small"
              @click="node.candidates.splice(ci, 1)"
              >×</ElButton
            >
          </div>
          <div class="g-row">
            <ElButton
              link
              type="primary"
              size="small"
              @click="node.candidates.push({ type: 'role', value: '' })"
              >{{ $t('pages.system.flowGraph.addCandidate') }}</ElButton
            >
            <ElSelect v-model="node.nodeRatio" size="small" class="g-ratio">
              <ElOption :label="$t('pages.system.flowGraph.ratioAny')" value="0" />
              <ElOption :label="$t('pages.system.flowGraph.ratioAll')" value="100" />
              <ElOption :label="$t('pages.system.flowGraph.ratioMajority')" value="50" />
            </ElSelect>
          </div>
        </div>

        <!-- AI 节点：绑已启用 AiApp + 映射 / 超时 / 失败策略；不做节点内提示词编辑 -->
        <div v-else-if="node.type === 'ai'" class="g-node-bd g-ai">
          <div class="g-ai-row">
            <span class="g-ai-label">{{ $t('pages.system.flowGraph.aiFlow') }}</span>
            <ElSelect
              v-model="node.aiFlowId"
              size="small"
              filterable
              clearable
              class="g-ai-flow"
              :loading="aiApps.loading"
              :placeholder="$t('pages.system.flowGraph.aiFlowPlaceholder')"
            >
              <ElOption
                v-for="a in aiApps.list"
                :key="String(a.id)"
                :label="`${a.name} (${a.appType})`"
                :value="a.id"
              />
            </ElSelect>
            <ElButton link size="small" :loading="aiApps.loading" @click="aiApps.reload()">{{
              $t('pages.system.flowGraph.refresh')
            }}</ElButton>
          </div>
          <div class="g-ai-row">
            <span class="g-ai-label">{{ $t('pages.system.flowGraph.aiTimeout') }}</span>
            <ElInputNumber
              v-model="node.timeoutMs"
              size="small"
              :min="1000"
              :max="600000"
              :step="1000"
              controls-position="right"
              class="g-ai-timeout"
            />
            <span class="g-ai-hint">ms</span>
          </div>
          <div class="g-ai-row">
            <span class="g-ai-label">{{ $t('pages.system.flowGraph.aiOnFailure') }}</span>
            <ElSelect
              v-model="node.onFailure"
              size="small"
              class="g-ai-fail"
              allow-create
              filterable
            >
              <ElOption :label="$t('pages.system.flowGraph.aiFailRejectLast')" value="rejectLast" />
              <ElOption :label="$t('pages.system.flowGraph.aiFailStay')" value="stay" />
              <ElOption
                v-for="r in reg.roles"
                :key="`tr-${r.value}`"
                :label="
                  $t('pages.system.flowGraph.aiFailTransferRole', { code: r.label || r.value })
                "
                :value="`transfer:role:${r.value}`"
              />
            </ElSelect>
          </div>
          <div class="g-ai-map">
            <div class="g-ai-map-hd">{{ $t('pages.system.flowGraph.aiInputMap') }}</div>
            <div v-for="(e, ei) in node.inputMap || []" :key="`in-${ei}`" class="g-rule">
              <ElInput
                v-model="e.key"
                size="small"
                class="g-rf"
                :placeholder="$t('pages.system.flowGraph.aiMapKey')"
              />
              <ElInput
                v-model="e.value"
                size="small"
                class="g-rv-wide"
                :placeholder="$t('pages.system.flowGraph.aiMapValue')"
              />
              <ElButton
                link
                type="danger"
                size="small"
                @click="node.inputMap && node.inputMap.splice(ei, 1)"
                >×</ElButton
              >
            </div>
            <ElButton
              link
              size="small"
              @click="(node.inputMap ||= []).push({ key: '', value: '' })"
              >{{ $t('pages.system.flowGraph.aiAddMap') }}</ElButton
            >
          </div>
          <div class="g-ai-map">
            <div class="g-ai-map-hd">{{ $t('pages.system.flowGraph.aiOutputMap') }}</div>
            <div v-for="(e, ei) in node.outputMap || []" :key="`out-${ei}`" class="g-rule">
              <ElInput
                v-model="e.key"
                size="small"
                class="g-rf"
                :placeholder="$t('pages.system.flowGraph.aiMapKey')"
              />
              <ElInput
                v-model="e.value"
                size="small"
                class="g-rv-wide"
                :placeholder="$t('pages.system.flowGraph.aiMapValue')"
              />
              <ElButton
                link
                type="danger"
                size="small"
                @click="node.outputMap && node.outputMap.splice(ei, 1)"
                >×</ElButton
              >
            </div>
            <ElButton
              link
              size="small"
              @click="(node.outputMap ||= []).push({ key: '', value: '' })"
              >{{ $t('pages.system.flowGraph.aiAddMap') }}</ElButton
            >
          </div>
          <p class="g-ai-tip">{{ $t('pages.system.flowGraph.aiPromptHint') }}</p>
        </div>

        <!-- 条件/并行分支 -->
        <div v-else class="g-branches">
          <div v-for="(b, bi) in node.branches" :key="b.id" class="g-branch">
            <div class="g-branch-hd">
              <ElInput
                v-model="b.name"
                size="small"
                :placeholder="$t('pages.system.flowGraph.branchNamePlaceholder')"
                class="g-bname"
              />
              <ElButton
                v-if="node.branches.length > 1"
                link
                type="danger"
                size="small"
                @click="node.branches.splice(bi, 1)"
                >×</ElButton
              >
            </div>
            <div v-if="node.type === 'condition'" class="g-rules">
              <ElCheckbox v-model="b.isDefault" size="small">{{
                $t('pages.system.flowGraph.elseDefault')
              }}</ElCheckbox>
              <template v-if="!b.isDefault">
                <div v-for="(r, ri) in b.conditions" :key="ri" class="g-rule">
                  <ElInput
                    v-model="r.field"
                    size="small"
                    :placeholder="$t('pages.system.flowGraph.variable')"
                    class="g-rf"
                  />
                  <ElSelect v-model="r.op" size="small" class="g-ro">
                    <ElOption v-for="o in OPS" :key="o.value" :label="o.label" :value="o.value" />
                  </ElSelect>
                  <ElInput
                    v-model="r.value"
                    size="small"
                    :placeholder="$t('pages.system.flowGraph.valuePlaceholder')"
                    class="g-rv"
                  />
                  <ElButton link type="danger" size="small" @click="b.conditions.splice(ri, 1)"
                    >×</ElButton
                  >
                </div>
                <div class="g-row">
                  <ElButton
                    link
                    size="small"
                    @click="b.conditions.push({ field: '', op: 'eq', value: '' })"
                    >{{ $t('pages.system.flowGraph.addConditionBtn') }}</ElButton
                  >
                  <ElRadioGroup v-if="b.conditions.length > 1" v-model="b.logic" size="small">
                    <ElRadioButton value="AND">{{
                      $t('pages.system.flowGraph.logicAnd')
                    }}</ElRadioButton>
                    <ElRadioButton value="OR">{{
                      $t('pages.system.flowGraph.logicOr')
                    }}</ElRadioButton>
                  </ElRadioGroup>
                </div>
              </template>
            </div>
            <GraphChain :nodes="b.children" />
          </div>
          <div class="g-add-branch">
            <ElButton link type="primary" size="small" @click="node.branches.push(newBranch())">{{
              $t('pages.system.flowGraph.addBranch')
            }}</ElButton>
          </div>
        </div>
      </div>
      <div class="g-add">
        <GraphAdd @pick="(t: string) => insertAt(idx + 1, t)" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { inject, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import GraphAdd from './GraphAdd.vue'
  import { newNode, newBranch, type GNode } from './graph-model'
  import { flowAiAppsStore } from './flow-ai-apps'

  defineOptions({ name: 'GraphChain' })

  const { t } = useI18n()

  const props = defineProps<{ nodes: GNode[] }>()

  // flowReg 由 flow-graph 页 provide：角色/部门全量选项 + 用户远程搜索方法（syncSelected 忽略入参，内部全量同步整树已选）
  const reg = inject<{
    roles: any[]
    depts: any[]
    users: any[]
    userSearching: boolean
    searchUsers: (keyword: string) => void
    syncSelected: () => void
  }>('flowReg', {
    roles: [],
    depts: [],
    users: [],
    userSearching: false,
    searchUsers: () => undefined,
    syncSelected: () => undefined
  })

  // AiApp 列表：模块级 store，递归多实例共享一次加载
  const aiApps = inject('flowAiApps', flowAiAppsStore)

  onMounted(() => {
    if (!aiApps.list.length && !aiApps.loading) void aiApps.reload()
  })

  const OPS = [
    { label: t('pages.system.flowGraph.opEq'), value: 'eq' },
    { label: t('pages.system.flowGraph.opNe'), value: 'ne' },
    { label: t('pages.system.flowGraph.opGt'), value: 'gt' },
    { label: t('pages.system.flowGraph.opGe'), value: 'ge' },
    { label: t('pages.system.flowGraph.opLt'), value: 'lt' },
    { label: t('pages.system.flowGraph.opLe'), value: 'le' },
    { label: t('pages.system.flowGraph.opLike'), value: 'like' },
    { label: t('pages.system.flowGraph.opNotLike'), value: 'notLike' }
  ]

  const typeLabel = (type: string): string =>
    ({
      approval: t('pages.system.flowGraph.typeApproval'),
      condition: t('pages.system.flowGraph.typeCondition'),
      parallel: t('pages.system.flowGraph.typeParallel'),
      ai: t('pages.system.flowGraph.typeAi')
    })[type] || type

  // 递归树编辑器：节点链是父级下传的共享响应式数组，就地增删是该场景既定模式（各层协同编辑同一棵树）
  const insertAt = (idx: number, type: string): void => {
    // eslint-disable-next-line vue/no-mutating-props
    props.nodes.splice(idx, 0, newNode(type))
  }
  const removeNode = (idx: number): void => {
    // eslint-disable-next-line vue/no-mutating-props
    props.nodes.splice(idx, 1)
  }
</script>

<style scoped>
  .g-chain {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .g-add {
    display: flex;
    justify-content: center;
    height: 24px;
  }

  .g-node {
    width: 240px;
    padding: 8px 10px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 8px;
  }

  .g-node--condition {
    width: auto;
    border-left-color: var(--el-color-warning);
  }

  .g-node--parallel {
    width: auto;
    border-left-color: var(--el-color-success);
  }

  .g-node--ai {
    width: 320px;
    border-left-color: var(--el-color-primary-dark-2, #337ecc);
  }

  .g-node-hd {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }

  .g-type {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .g-name {
    flex: 1;
  }

  .g-cand,
  .g-rule {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 4px;
  }

  .g-cand-type {
    width: 92px;
  }

  .g-cand-val {
    width: 110px;
  }

  .g-ratio {
    width: 132px;
  }

  .g-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 2px;
  }

  .g-ai-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }

  .g-ai-label {
    flex-shrink: 0;
    width: 64px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .g-ai-flow {
    flex: 1;
    min-width: 0;
  }

  .g-ai-timeout {
    width: 140px;
  }

  .g-ai-fail {
    flex: 1;
    min-width: 0;
  }

  .g-ai-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .g-ai-map {
    margin-top: 4px;
    margin-bottom: 6px;
  }

  .g-ai-map-hd {
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .g-rv-wide {
    flex: 1;
    min-width: 0;
  }

  .g-ai-tip {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }

  .g-branches {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .g-branch {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .g-branch-hd {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 4px;
  }

  .g-bname {
    width: 120px;
  }

  .g-rules {
    width: 260px;
    padding: 6px;
    margin-bottom: 6px;
    background: var(--el-bg-color);
    border-radius: 6px;
  }

  .g-rf {
    width: 78px;
  }

  .g-ro {
    width: 92px;
  }

  .g-rv {
    width: 64px;
  }

  .g-add-branch {
    align-self: center;
  }
</style>
