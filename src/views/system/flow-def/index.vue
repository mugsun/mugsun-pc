<!-- 流程定义管理 + 图形流程设计器（对接 /system/flow）：设计→绑定表单/字段权限→部署→发起（带业务数据）走通 -->
<template>
  <div class="flow-def-page art-full-height">
    <ElCard class="art-table-card">
      <div class="flow-toolbar">
        <ElButton v-perm="'sys:flow:design'" type="primary" @click="openDesigner">{{
          $t('pages.system.flowDef.designFlow')
        }}</ElButton>
        <ElButton :loading="loading" @click="loadData">{{
          $t('pages.system.flowDef.refresh')
        }}</ElButton>
      </div>

      <!-- 表格自由增长：包一层 flex:1 定高壳内部滚动，防矮视口裁切 -->
      <div class="flow-table-wrap">
        <ElTable v-loading="loading" :data="tableData" border height="100%">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn
            prop="flowCode"
            :label="$t('pages.system.flowDef.flowCode')"
            min-width="140"
          />
          <ElTableColumn
            prop="flowName"
            :label="$t('pages.system.flowDef.flowName')"
            min-width="160"
          />
          <ElTableColumn prop="version" :label="$t('pages.system.flowDef.version')" width="90" />
          <ElTableColumn :label="$t('pages.system.flowDef.status')" width="110">
            <template #default="{ row }">
              <ElTag :type="row.isPublish === 1 ? 'success' : 'info'">
                {{
                  row.isPublish === 1
                    ? $t('pages.system.flowDef.published')
                    : $t('pages.system.flowDef.unpublished')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="createTime"
            :label="$t('pages.system.flowDef.createTime')"
            min-width="180"
          >
            <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.flowDef.actions')" width="100" fixed="right">
            <template #default="{ row }">
              <ElButton link type="primary" @click="start(row)">{{
                $t('pages.system.flowDef.start')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 图形流程设计器 -->
    <ElDialog
      v-model="designerVisible"
      :title="$t('pages.system.flowDef.designerTitle')"
      width="880px"
      align-center
      destroy-on-close
      class="flow-designer-dialog"
    >
      <ElForm :model="design" label-width="90px">
        <ElFormItem :label="$t('pages.system.flowDef.flowCode')" required>
          <ElInput
            v-model="design.flowCode"
            :placeholder="$t('pages.system.flowDef.flowCodePlaceholder')"
            style="width: 260px"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.flowDef.flowName')" required>
          <ElInput
            v-model="design.flowName"
            :placeholder="$t('pages.system.flowDef.flowNamePlaceholder')"
            style="width: 260px"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.flowDef.bindForm')">
          <ElSelect
            v-model="design.formKey"
            clearable
            filterable
            :placeholder="$t('pages.system.flowDef.bindFormPlaceholder')"
            style="width: 360px"
            @change="onFormChange"
          >
            <ElOption v-for="f in forms" :key="f.value" :label="f.label" :value="f.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.flowDef.approvalNodes')">
          <ElButton size="small" type="primary" @click="addNode">{{
            $t('pages.system.flowDef.addNode')
          }}</ElButton>
        </ElFormItem>
      </ElForm>

      <!-- 可视化流程图 -->
      <div class="flow-diagram">
        <div class="flow-node flow-node--start">{{ $t('pages.system.flowDef.startNode') }}</div>
        <template v-for="(node, idx) in design.nodes" :key="idx">
          <ArtSvgIcon class="flow-arrow" icon="ri:arrow-right-line" />
          <div class="flow-node flow-node--task">
            <ElInput
              v-model="node.name"
              size="small"
              :placeholder="$t('pages.system.flowDef.nodeNamePlaceholder')"
              class="node-input"
            />
            <div v-for="(c, ci) in node.candidates" :key="ci" class="cand-row">
              <ElSelect v-model="c.type" size="small" class="cand-type" @change="c.value = ''">
                <ElOption :label="$t('pages.system.flowDef.role')" value="role" />
                <ElOption :label="$t('pages.system.flowDef.dept')" value="dept" />
                <ElOption :label="$t('pages.system.flowDef.specifiedUser')" value="user" />
                <ElOption :label="$t('pages.system.flowDef.initiator')" value="initiator" />
                <ElOption :label="$t('pages.system.flowDef.deptLeader')" value="deptLeader" />
              </ElSelect>
              <ElSelect
                v-if="c.type === 'role'"
                v-model="c.value"
                size="small"
                :placeholder="$t('pages.system.flowDef.role')"
                class="cand-val"
              >
                <ElOption v-for="r in roles" :key="r.value" :label="r.label" :value="r.value" />
              </ElSelect>
              <ElSelect
                v-else-if="c.type === 'dept'"
                v-model="c.value"
                size="small"
                :placeholder="$t('pages.system.flowDef.dept')"
                class="cand-val"
              >
                <ElOption v-for="d in depts" :key="d.value" :label="d.label" :value="d.value" />
              </ElSelect>
              <ElSelect
                v-else-if="c.type === 'user'"
                v-model="c.value"
                size="small"
                filterable
                remote
                :remote-method="searchUsers"
                :loading="userSearching"
                :placeholder="$t('pages.system.flowDef.userSearchPlaceholder')"
                class="cand-val"
              >
                <ElOption v-for="u in users" :key="u.value" :label="u.label" :value="u.value" />
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
            <div class="node-ops">
              <ElButton link type="primary" size="small" @click="addCandidate(node)">{{
                $t('pages.system.flowDef.addCandidate')
              }}</ElButton>
              <ElButton
                v-if="design.formKey"
                link
                type="warning"
                size="small"
                @click="openPerms(node)"
                >{{ $t('pages.system.flowDef.fieldPerms') }}</ElButton
              >
              <ElButton link type="danger" size="small" @click="removeNode(idx)">{{
                $t('pages.system.flowDef.delete')
              }}</ElButton>
            </div>
          </div>
        </template>
        <ArtSvgIcon class="flow-arrow" icon="ri:arrow-right-line" />
        <div class="flow-node flow-node--end">{{ $t('pages.system.flowDef.endNode') }}</div>
      </div>

      <template #footer>
        <ElButton @click="designerVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton
          v-perm="'sys:flow:design'"
          type="primary"
          :loading="deploying"
          @click="submitDesign"
          >{{ $t('pages.system.flowDef.deploy') }}</ElButton
        >
      </template>
    </ElDialog>

    <!-- 节点字段权限配置 -->
    <ElDialog
      v-model="permsVisible"
      :title="$t('pages.system.flowDef.fieldPermsTitle')"
      width="480px"
      align-center
      destroy-on-close
    >
      <ElAlert
        type="info"
        :closable="false"
        :title="$t('pages.system.flowDef.fieldPermsTip')"
        style="margin-bottom: 12px"
      />
      <ElTable :data="fields" border max-height="360">
        <ElTableColumn prop="title" :label="$t('pages.system.flowDef.field')" min-width="140" />
        <ElTableColumn prop="field" :label="$t('pages.system.flowDef.fieldKey')" min-width="120" />
        <ElTableColumn :label="$t('pages.system.flowDef.perm')" width="140">
          <template #default="{ row }">
            <ElSelect v-model="permDraft[row.field]" size="small" style="width: 100%">
              <ElOption :label="$t('pages.system.flowDef.writable')" value="WRITE" />
              <ElOption :label="$t('pages.system.flowDef.readonly')" value="READ" />
              <ElOption :label="$t('pages.system.flowDef.hidden')" value="NONE" />
            </ElSelect>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElEmpty
        v-if="!fields.length"
        :description="$t('pages.system.flowDef.noFields')"
        :image-size="50"
      />
      <template #footer>
        <ElButton @click="permsVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" @click="savePerms">{{ $t('pages.system.flowDef.save') }}</ElButton>
      </template>
    </ElDialog>

    <!-- 发起：带业务表单填写 -->
    <ElDialog
      v-model="startVisible"
      :title="
        $t('pages.system.flowDef.startTitle', { name: startCtx.flowName || startCtx.flowCode })
      "
      width="600px"
      align-center
      destroy-on-close
    >
      <ElForm label-width="90px">
        <ElFormItem :label="$t('pages.system.flowDef.businessId')" required>
          <ElInput
            v-model="startBusinessId"
            :placeholder="$t('pages.system.flowDef.businessId')"
            style="width: 320px"
          />
        </ElFormItem>
      </ElForm>
      <ApprovalForm
        v-if="startForm.schema"
        ref="startFormRef"
        :schema="startForm.schema"
        :option-json="startForm.option"
      />
      <template #footer>
        <ElButton @click="startVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="starting" @click="submitStart">{{
          $t('pages.system.flowDef.start')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onDeactivated } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import formCreate from '@form-create/element-ui'
  import ApprovalForm from '../flow-center/components/ApprovalForm.vue'
  import {
    fetchFlowDefinitions,
    fetchFlowStart,
    fetchFlowStartBy,
    fetchFlowStartForm,
    fetchFlowDesign,
    fetchDeptSelect
  } from '@/api/system-manage'
  import { useUserSelectSearch } from '@/hooks'
  import { fetchRoleCodeSelect } from '@/api/role'
  import { fetchFormPage, fetchFormByKey } from '@/api/form'
  import { ElMessage } from 'element-plus'
  import { formatTableTime } from '@/utils/date'

  defineOptions({ name: 'FlowDef' })

  const { t } = useI18n()

  interface Candidate {
    type: string
    value: string
  }
  interface DesignNode {
    name: string
    candidates: Candidate[]
    fieldPerms: Record<string, string>
  }

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const roles = ref<any[]>([])
  const depts = ref<any[]>([])
  // 「指定用户」候选人远程搜索：成千账号场景不下全量（默认 50 条 + 关键字防抖查询）
  const {
    userOptions: users,
    userSearching,
    searchUsers,
    syncSelected,
    ensureUsers
  } = useUserSelectSearch()
  const forms = ref<Array<{ label: string; value: string }>>([])

  const designerVisible = ref(false)
  const deploying = ref(false)
  const design = reactive<{
    flowCode: string
    flowName: string
    formKey: string
    nodes: DesignNode[]
  }>({ flowCode: '', flowName: '', formKey: '', nodes: [] })

  // 各节点的 user 候选人（单选字符串）共享一个选项缓存：把全部 user 候选人 id 作为已选集合同步，
  // 防某节点远程搜索刷新选项后，其他节点已选标签退化为裸 id
  const userCandidateIds = computed(() =>
    design.nodes.flatMap((n) =>
      n.candidates.filter((c) => c.type === 'user' && c.value !== '').map((c) => c.value)
    )
  )
  watch(userCandidateIds, (ids) => syncSelected(ids))

  // 字段权限
  const permsVisible = ref(false)
  const fields = ref<Array<{ field: string; title: string }>>([])
  const permDraft = reactive<Record<string, string>>({})
  const permNode = ref<DesignNode | null>(null)

  // 发起表单
  const startVisible = ref(false)
  const starting = ref(false)
  const startBusinessId = ref('')
  const startCtx = reactive<{ flowCode: string; flowName: string }>({ flowCode: '', flowName: '' })
  const startForm = reactive<{ schema: string; option: string }>({ schema: '', option: '' })
  const startFormRef = ref<any>(null)

  const loadData = async (): Promise<void> => {
    tableData.value = (await fetchFlowDefinitions()) || []
  }

  onMounted(async () => {
    await loadData()
    roles.value = (await fetchRoleCodeSelect()) || []
    depts.value = (await fetchDeptSelect()) || []
    const page = await fetchFormPage({ current: 1, size: 200 })
    forms.value = (page?.records || []).map((f: any) => ({ label: f.name, value: f.formKey }))
  })

  const closeDialogs = (): void => {
    designerVisible.value = false
    permsVisible.value = false
    startVisible.value = false
    ElMessageBox.close()
  }

  // ==================== 发起（带表单） ====================

  const start = async (row: { flowCode: string; flowName?: string }): Promise<void> => {
    designerVisible.value = false
    permsVisible.value = false
    startCtx.flowCode = row.flowCode
    startCtx.flowName = row.flowName || ''
    startBusinessId.value = row.flowCode.toUpperCase() + '-' + Date.now()
    startForm.schema = ''
    startForm.option = ''
    if (row.flowCode !== 'leave') {
      const f = await fetchFlowStartForm(row.flowCode)
      if (f?.hasForm) {
        startForm.schema = f.schema
        startForm.option = f.option || ''
      }
    }
    startVisible.value = true
  }

  const submitStart = async (): Promise<void> => {
    if (starting.value) return
    if (!startBusinessId.value) {
      ElMessage.warning(t('pages.system.flowDef.msgBusinessIdRequired'))
      return
    }
    starting.value = true
    try {
      if (startCtx.flowCode === 'leave') {
        await fetchFlowStart(startBusinessId.value)
      } else {
        let variable: Record<string, any> | undefined
        if (startForm.schema && startFormRef.value) {
          try {
            await startFormRef.value.validate()
          } catch {
            ElMessage.warning(t('pages.system.flowDef.msgFormIncomplete'))
            return
          }
          variable = startFormRef.value.getFormData()
        }
        await fetchFlowStartBy(startCtx.flowCode, startBusinessId.value, { variable })
      }
      ElMessage.success(t('pages.system.flowDef.msgStarted'))
      startVisible.value = false
    } finally {
      starting.value = false
    }
  }

  // ==================== 设计器 ====================

  const newNode = (name: string): DesignNode => ({
    name,
    candidates: [{ type: 'role', value: 'admin' }],
    fieldPerms: {}
  })

  const openDesigner = (): void => {
    permsVisible.value = false
    startVisible.value = false
    Object.assign(design, {
      flowCode: '',
      flowName: '',
      formKey: '',
      nodes: [newNode(t('pages.system.flowDef.defaultDeptApproval'))]
    })
    // 编辑回显兜底：打开时按 id 精确补拉 user 候选人选项（新建时为空集合，直接跳过）
    void ensureUsers(userCandidateIds.value)
    designerVisible.value = true
  }

  const addNode = (): void => {
    design.nodes.push(newNode(t('pages.system.flowDef.approvalNodes')))
  }
  const removeNode = (idx: number): void => {
    design.nodes.splice(idx, 1)
  }
  const addCandidate = (node: DesignNode): void => {
    node.candidates.push({ type: 'role', value: '' })
  }
  const onFormChange = (): void => {
    // 换表单后清空各节点已配的字段权限
    design.nodes.forEach((n) => (n.fieldPerms = {}))
  }

  // 解析 form-create schema 的字段列表（field + title）
  const parseFields = (schema: string): Array<{ field: string; title: string }> => {
    const list: Array<{ field: string; title: string }> = []
    const walk = (rules: any[]): void => {
      rules.forEach((r) => {
        if (r?.field) list.push({ field: r.field, title: r.title || r.field })
        if (Array.isArray(r?.children)) walk(r.children)
      })
    }
    try {
      walk(formCreate.parseJson(schema))
    } catch {
      /* 忽略解析异常 */
    }
    return list
  }

  const openPerms = async (node: DesignNode): Promise<void> => {
    startVisible.value = false
    permNode.value = node
    const detail = await fetchFormByKey(design.formKey)
    fields.value = parseFields(detail?.formSchema || '')
    Object.keys(permDraft).forEach((k) => delete permDraft[k])
    fields.value.forEach((f) => (permDraft[f.field] = node.fieldPerms[f.field] || 'WRITE'))
    permsVisible.value = true
  }

  const savePerms = (): void => {
    if (permNode.value) {
      // 仅保存非默认（非 WRITE）权限，减少冗余
      const perms: Record<string, string> = {}
      Object.entries(permDraft).forEach(([f, p]) => {
        if (p && p !== 'WRITE') perms[f] = p
      })
      permNode.value.fieldPerms = perms
    }
    permsVisible.value = false
  }

  const candidateToken = (c: Candidate): string => {
    if (c.type === 'initiator') return 'initiator'
    if (c.type === 'deptLeader') return 'deptLeader'
    return c.value ? `${c.type}:${c.value}` : ''
  }

  const submitDesign = async (): Promise<void> => {
    if (!design.flowCode || !design.flowName) {
      ElMessage.warning(t('pages.system.flowDef.msgCodeNameRequired'))
      return
    }
    if (!design.nodes.length) {
      ElMessage.warning(t('pages.system.flowDef.msgNodeRequired'))
      return
    }
    const nodes = design.nodes.map((n) => ({
      name: n.name,
      candidates: n.candidates.map(candidateToken).filter(Boolean),
      fieldPerms: n.fieldPerms
    }))
    if (nodes.some((n) => n.candidates.length === 0)) {
      ElMessage.warning(t('pages.system.flowDef.msgCandidateRequired'))
      return
    }
    deploying.value = true
    try {
      await fetchFlowDesign({
        flowCode: design.flowCode,
        flowName: design.flowName,
        formKey: design.formKey || null,
        nodes
      })
      ElMessage.success(t('pages.system.flowDef.msgDeployed'))
      designerVisible.value = false
      loadData()
    } finally {
      deploying.value = false
    }
  }

  onDeactivated(closeDialogs)
</script>

<style scoped>
  .flow-toolbar {
    margin-bottom: 12px;
  }

  .flow-diagram {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    padding: 20px 12px;
    margin-top: 8px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
  }

  .flow-node {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    min-width: 84px;
    padding: 12px 14px;
    color: #fff;
    border-radius: 8px;
  }

  .flow-node--start {
    background: var(--el-color-success);
  }

  .flow-node--end {
    background: var(--el-color-info);
  }

  .flow-node--task {
    min-width: 170px;
    background: var(--el-color-primary);
  }

  .node-input {
    width: 150px;
  }

  .cand-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .cand-type {
    width: 96px;
  }

  .cand-val {
    width: 118px;
  }

  .node-ops {
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }

  .flow-arrow {
    font-size: 20px;
    color: var(--el-text-color-secondary);
  }

  /* 表格自由增长：卡片体改 flex 列布局 + 表格壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .flow-table-wrap {
    flex: 1;
    min-height: 0;
  }
</style>

<!-- 设计器弹窗内容 teleport 到 body，节点数不定：非 scoped 类限定滚动（同 track-app-dialog 范式），防矮视口截断 -->
<style>
  .flow-designer-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
