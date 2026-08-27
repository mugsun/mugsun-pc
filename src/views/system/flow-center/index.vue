<!-- 审批中心：待办/我发起/已办/抄送我的 + 通用审批抽屉（表单渲染·流程图进度·时间轴·下一节点预测·buttonList 动作） -->
<template>
  <div class="flow-center-page art-full-height">
    <ElCard class="art-table-card">
      <ElTabs v-model="tab" @tab-change="onTabChange">
        <ElTabPane :label="$t('pages.system.flowCenter.tabTodo')" name="todo">
          <div class="fc-toolbar">
            <ElButton :loading="loading" @click="load">{{
              $t('pages.system.flowCenter.refresh')
            }}</ElButton>
          </div>
          <ElTable :data="rows" border :loading="loading">
            <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
            <ElTableColumn
              prop="businessId"
              :label="$t('pages.system.flowCenter.businessId')"
              min-width="150"
            />
            <ElTableColumn
              prop="flowName"
              :label="$t('pages.system.flowCenter.flow')"
              min-width="120"
            />
            <ElTableColumn
              prop="nodeName"
              :label="$t('pages.system.flowCenter.currentNode')"
              min-width="120"
            />
            <ElTableColumn
              prop="createTime"
              :label="$t('pages.system.flowCenter.arriveTime')"
              min-width="170"
            >
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowCenter.actions')" width="140" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openDetail(row, 'todo')">{{
                  $t('pages.system.flowCenter.handle')
                }}</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="$t('pages.system.flowCenter.tabStarted')" name="started">
          <div class="fc-toolbar">
            <ElButton :loading="loading" @click="load">{{
              $t('pages.system.flowCenter.refresh')
            }}</ElButton>
          </div>
          <ElTable :data="rows" border :loading="loading">
            <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
            <ElTableColumn
              prop="businessId"
              :label="$t('pages.system.flowCenter.businessId')"
              min-width="150"
            />
            <ElTableColumn
              prop="flowName"
              :label="$t('pages.system.flowCenter.flow')"
              min-width="120"
            />
            <ElTableColumn
              prop="nodeName"
              :label="$t('pages.system.flowCenter.currentNode')"
              min-width="110"
            />
            <ElTableColumn :label="$t('pages.system.flowCenter.status')" width="90">
              <template #default="{ row }"
                ><ElTag :type="statusTag(row)">{{ statusText(row) }}</ElTag></template
              >
            </ElTableColumn>
            <ElTableColumn
              prop="createTime"
              :label="$t('pages.system.flowCenter.startTime')"
              min-width="170"
            >
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowCenter.actions')" width="170" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openDetail(row, 'view')">{{
                  $t('pages.system.flowCenter.detail')
                }}</ElButton>
                <ElButton
                  v-if="String(row.flowStatus) === '1'"
                  link
                  type="warning"
                  @click="revoke(row)"
                  >{{ $t('pages.system.flowCenter.revoke') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="$t('pages.system.flowCenter.tabDone')" name="done">
          <div class="fc-toolbar">
            <ElButton :loading="loading" @click="load">{{
              $t('pages.system.flowCenter.refresh')
            }}</ElButton>
          </div>
          <ElTable :data="rows" border :loading="loading">
            <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
            <ElTableColumn
              prop="businessId"
              :label="$t('pages.system.flowCenter.businessId')"
              min-width="150"
            />
            <ElTableColumn
              prop="flowName"
              :label="$t('pages.system.flowCenter.flow')"
              min-width="120"
            />
            <ElTableColumn
              prop="nodeName"
              :label="$t('pages.system.flowCenter.handleNode')"
              min-width="110"
            />
            <ElTableColumn :label="$t('pages.system.flowCenter.myAction')" width="90">
              <template #default="{ row }">{{ skipText(row.skipType) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowCenter.flowStatus')" width="90">
              <template #default="{ row }"
                ><ElTag :type="statusTag(row)">{{ statusText(row) }}</ElTag></template
              >
            </ElTableColumn>
            <ElTableColumn
              prop="createTime"
              :label="$t('pages.system.flowCenter.handleTime')"
              min-width="170"
            >
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowCenter.actions')" width="90" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openDetail(row, 'view')">{{
                  $t('pages.system.flowCenter.detail')
                }}</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="$t('pages.system.flowCenter.tabCopy')" name="copy">
          <div class="fc-toolbar">
            <ElButton :loading="loading" @click="load">{{
              $t('pages.system.flowCenter.refresh')
            }}</ElButton>
          </div>
          <ElTable :data="rows" border :loading="loading">
            <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
            <ElTableColumn
              prop="businessId"
              :label="$t('pages.system.flowCenter.businessId')"
              min-width="150"
            />
            <ElTableColumn
              prop="flowName"
              :label="$t('pages.system.flowCenter.flow')"
              min-width="120"
            />
            <ElTableColumn :label="$t('pages.system.flowCenter.status')" width="90">
              <template #default="{ row }"
                ><ElTag :type="statusTag(row)">{{ statusText(row) }}</ElTag></template
              >
            </ElTableColumn>
            <ElTableColumn
              prop="createTime"
              :label="$t('pages.system.flowCenter.copyTime')"
              min-width="170"
            >
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowCenter.actions')" width="90" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openDetail(row, 'view')">{{
                  $t('pages.system.flowCenter.detail')
                }}</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <!-- 通用审批抽屉 -->
    <ElDrawer v-model="detailVisible" :title="detailTitle" size="620px" :destroy-on-close="true">
      <div v-loading="detailLoading" class="fc-detail">
        <ElDivider content-position="left">{{
          $t('pages.system.flowCenter.progressDivider')
        }}</ElDivider>
        <FlowProgress :nodes="progress" />

        <ElDivider content-position="left">{{
          $t('pages.system.flowCenter.formDivider')
        }}</ElDivider>
        <ApprovalForm
          ref="formRef"
          :schema="form.schema"
          :option-json="form.option"
          :data="form.data"
          :perms="form.fieldPerms"
          :readonly="mode !== 'todo'"
        />

        <template v-if="mode === 'todo'">
          <ElDivider content-position="left">{{
            $t('pages.system.flowCenter.nextApproverDivider')
          }}</ElDivider>
          <div v-if="nextApprovers.length" class="fc-next">
            <div v-for="na in nextApprovers" :key="na.nodeCode" class="fc-next-node">
              <span class="fc-next-name">{{ na.nodeName }}</span>
              <template v-if="na.end"
                ><ElTag size="small" type="info">{{
                  $t('pages.system.flowCenter.flowEnd')
                }}</ElTag></template
              >
              <template v-else>
                <ElTag v-for="a in na.approvers" :key="a.id" size="small" class="fc-next-tag">{{
                  a.name
                }}</ElTag>
                <span v-if="!na.approvers.length" class="fc-next-empty">{{
                  $t('pages.system.flowCenter.noneText')
                }}</span>
              </template>
            </div>
          </div>
          <ElEmpty
            v-else
            :description="$t('pages.system.flowCenter.noNextNode')"
            :image-size="50"
          />

          <ElDivider content-position="left">{{
            $t('pages.system.flowCenter.opinionDivider')
          }}</ElDivider>
          <ElInput
            v-model="opinion"
            type="textarea"
            :rows="2"
            :placeholder="$t('pages.system.flowCenter.optional')"
          />
        </template>

        <ElDivider content-position="left">{{
          $t('pages.system.flowCenter.historyDivider')
        }}</ElDivider>
        <ElTimeline>
          <ElTimelineItem
            v-for="(h, i) in history"
            :key="i"
            :type="timelineType(h)"
            :timestamp="formatTableTime(h.createTime)"
          >
            <div class="fc-his-node">{{ h.nodeName }}</div>
            <div class="fc-his-meta">
              {{ statusText(h) }}
              <span v-if="h.approver">{{
                $t('pages.system.flowCenter.handlerText', { name: h.approver })
              }}</span>
              <span v-if="h.message">· {{ h.message }}</span>
            </div>
          </ElTimelineItem>
        </ElTimeline>
      </div>

      <template v-if="mode === 'todo'" #footer>
        <div class="fc-actions">
          <ElButton v-if="btn('pass')" type="success" :loading="submitting" @click="doPass">{{
            $t('pages.system.flowCenter.pass')
          }}</ElButton>
          <ElButton v-if="btn('reject')" type="warning" @click="openOp('reject')">{{
            $t('pages.system.flowCenter.reject')
          }}</ElButton>
          <ElDropdown v-if="hasMore" @command="openOp">
            <ElButton
              >{{ $t('pages.system.flowCenter.more') }}<ElIcon><ArrowDown /></ElIcon
            ></ElButton>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem v-if="btn('rejectNode')" command="rejectNode">{{
                  $t('pages.system.flowCenter.rejectNode')
                }}</ElDropdownItem>
                <ElDropdownItem v-if="btn('transfer')" command="transfer">{{
                  $t('pages.system.flowCenter.transfer')
                }}</ElDropdownItem>
                <ElDropdownItem v-if="btn('depute')" command="depute">{{
                  $t('pages.system.flowCenter.depute')
                }}</ElDropdownItem>
                <ElDropdownItem v-if="btn('addSignature')" command="addSignature">{{
                  $t('pages.system.flowCenter.addSignature')
                }}</ElDropdownItem>
                <ElDropdownItem v-if="btn('reductionSignature')" command="reductionSignature">{{
                  $t('pages.system.flowCenter.reductionSignature')
                }}</ElDropdownItem>
                <ElDropdownItem v-if="btn('copy')" command="copy">{{
                  $t('pages.system.flowCenter.copy')
                }}</ElDropdownItem>
                <ElDropdownItem v-if="btn('terminate')" command="terminate" divided>{{
                  $t('pages.system.flowCenter.terminate')
                }}</ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </template>
    </ElDrawer>

    <!-- 二级动作对话框（退回/转办/委派/加减签/抄送/作废） -->
    <ElDialog v-model="opVisible" :title="opTitle" width="460px" align-center destroy-on-close>
      <ElForm label-width="72px">
        <ElFormItem v-if="opKind === 'node'" :label="$t('pages.system.flowCenter.rejectNodeLabel')">
          <ElSelect
            v-model="opForm.nodeCode"
            :placeholder="$t('pages.system.flowCenter.selectHistoryNode')"
            style="width: 100%"
          >
            <ElOption
              v-for="n in backNodes"
              :key="n.nodeCode"
              :label="n.nodeName"
              :value="n.nodeCode"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="opKind === 'user'" :label="$t('pages.system.flowCenter.selectUser')">
          <ElSelect
            v-model="opForm.handlers"
            multiple
            filterable
            remote
            :remote-method="searchUsers"
            :loading="userSearching"
            :placeholder="$t('pages.system.flowCenter.userSearchPlaceholder')"
            style="width: 100%"
            @change="syncSelected"
          >
            <ElOption v-for="u in users" :key="u.value" :label="u.label" :value="u.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="opAction !== 'copy'"
          :label="$t('pages.system.flowCenter.opinionDivider')"
        >
          <ElInput
            v-model="opForm.message"
            type="textarea"
            :rows="2"
            :placeholder="$t('pages.system.flowCenter.optional')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="opVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitOp">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onDeactivated } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ArrowDown } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { formatTableTime } from '@/utils/date'
  import FlowProgress from './components/FlowProgress.vue'
  import ApprovalForm from './components/ApprovalForm.vue'
  import {
    fetchFlowMyTodo,
    fetchFlowMyStarted,
    fetchFlowMyDone,
    fetchFlowMyCopy,
    fetchFlowProgress,
    fetchFlowHistory,
    fetchFlowNextApprovers,
    fetchFlowTaskButtons,
    fetchFlowTaskForm,
    fetchFlowInstanceForm,
    fetchFlowHandle,
    fetchFlowReject,
    fetchFlowRejectNode,
    fetchFlowRevoke,
    fetchFlowTerminate,
    fetchFlowOperation,
    fetchFlowCopy,
    fetchFlowBackNodes
  } from '@/api/system-manage'
  import { useUserSelectSearch } from '@/hooks'

  defineOptions({ name: 'FlowCenter' })

  const { t } = useI18n()

  const LOADERS: Record<string, () => Promise<any[]>> = {
    todo: fetchFlowMyTodo,
    started: fetchFlowMyStarted,
    done: fetchFlowMyDone,
    copy: fetchFlowMyCopy
  }

  const tab = ref('todo')
  const rows = ref<any[]>([])
  const loading = ref(false)
  // 目标人员远程搜索：成千账号场景不下全量（默认 50 条 + 关键字防抖查询）
  const { userOptions: users, userSearching, searchUsers, syncSelected } = useUserSelectSearch()

  // 详情抽屉
  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const mode = ref<'todo' | 'view'>('view')
  const current = ref<any>(null)
  const progress = ref<any[]>([])
  const history = ref<any[]>([])
  const nextApprovers = ref<any[]>([])
  const buttonList = ref<string[]>([])
  const form = reactive<Record<string, any>>({ schema: '', option: '', data: {}, fieldPerms: {} })
  const opinion = ref('')
  const formRef = ref<any>(null)
  const submitting = ref(false)

  // 二级动作对话框
  const opVisible = ref(false)
  const opAction = ref('')
  const backNodes = ref<any[]>([])
  const opForm = reactive<{ message: string; handlers: any[]; nodeCode: string }>({
    message: '',
    handlers: [],
    nodeCode: ''
  })

  const detailTitle = computed(() =>
    mode.value === 'todo'
      ? t('pages.system.flowCenter.titleHandle', { name: current.value?.businessId ?? '' })
      : t('pages.system.flowCenter.titleDetail', { name: current.value?.businessId ?? '' })
  )
  const btn = (code: string): boolean => buttonList.value.includes(code)
  const hasMore = computed(() =>
    [
      'rejectNode',
      'transfer',
      'depute',
      'addSignature',
      'reductionSignature',
      'copy',
      'terminate'
    ].some(btn)
  )

  const load = async (): Promise<void> => {
    loading.value = true
    try {
      rows.value = (await LOADERS[tab.value]()) || []
    } finally {
      loading.value = false
    }
  }
  const onTabChange = (): void => {
    closeDialogs()
    load()
  }

  const closeDialogs = (): void => {
    detailVisible.value = false
    opVisible.value = false
    ElMessageBox.close()
  }

  const openDetail = async (row: any, m: 'todo' | 'view'): Promise<void> => {
    opVisible.value = false
    current.value = row
    mode.value = m
    opinion.value = ''
    detailVisible.value = true
    detailLoading.value = true
    try {
      const [prog, his] = await Promise.all([
        fetchFlowProgress(row.instanceId),
        fetchFlowHistory(row.instanceId)
      ])
      progress.value = prog || []
      history.value = his || []
      if (m === 'todo') {
        const [f, buttons, next] = await Promise.all([
          fetchFlowTaskForm(row.taskId),
          fetchFlowTaskButtons(row.taskId),
          fetchFlowNextApprovers(row.taskId)
        ])
        setForm(f)
        buttonList.value = buttons || []
        nextApprovers.value = next || []
      } else {
        setForm(await fetchFlowInstanceForm(row.instanceId))
        buttonList.value = []
        nextApprovers.value = []
      }
    } finally {
      detailLoading.value = false
    }
  }

  const setForm = (f: Record<string, any>): void => {
    form.schema = f?.hasForm ? f.schema : ''
    form.option = f?.option || ''
    form.data = f?.data || {}
    form.fieldPerms = f?.fieldPerms || {}
  }

  // ==================== 待办动作 ====================

  const doPass = async (): Promise<void> => {
    if (submitting.value) return
    let variable: Record<string, any> | undefined
    if (form.schema && formRef.value) {
      try {
        await formRef.value.validate()
      } catch {
        ElMessage.warning(t('pages.system.flowCenter.msgFormIncomplete'))
        return
      }
      variable = formRef.value.getFormData()
    }
    submitting.value = true
    try {
      await fetchFlowHandle(current.value.taskId, opinion.value, variable)
      ElMessage.success(t('pages.system.flowCenter.approved'))
      detailVisible.value = false
      load()
    } finally {
      submitting.value = false
    }
  }

  const OP: Record<
    string,
    { title: string; kind: 'message' | 'node' | 'user'; run: (r: any) => Promise<any> }
  > = {
    reject: {
      title: t('pages.system.flowCenter.titleRejectPrev'),
      kind: 'message',
      run: (r) => fetchFlowReject(r.taskId, opForm.message)
    },
    rejectNode: {
      title: t('pages.system.flowCenter.rejectNode'),
      kind: 'node',
      run: (r) => fetchFlowRejectNode(r.taskId, opForm.nodeCode, opForm.message)
    },
    terminate: {
      title: t('pages.system.flowCenter.terminate'),
      kind: 'message',
      run: (r) => fetchFlowTerminate(r.taskId, opForm.message)
    },
    transfer: {
      title: t('pages.system.flowCenter.transfer'),
      kind: 'user',
      run: (r) => fetchFlowOperation(r.taskId, 'transfer', opForm.handlers, opForm.message)
    },
    depute: {
      title: t('pages.system.flowCenter.depute'),
      kind: 'user',
      run: (r) => fetchFlowOperation(r.taskId, 'depute', opForm.handlers, opForm.message)
    },
    addSignature: {
      title: t('pages.system.flowCenter.addSignature'),
      kind: 'user',
      run: (r) => fetchFlowOperation(r.taskId, 'addSignature', opForm.handlers, opForm.message)
    },
    reductionSignature: {
      title: t('pages.system.flowCenter.reductionSignature'),
      kind: 'user',
      run: (r) =>
        fetchFlowOperation(r.taskId, 'reductionSignature', opForm.handlers, opForm.message)
    },
    copy: {
      title: t('pages.system.flowCenter.copy'),
      kind: 'user',
      run: (r) => fetchFlowCopy(r.taskId, opForm.handlers)
    }
  }
  const opTitle = computed(
    () => OP[opAction.value]?.title || t('pages.system.flowCenter.opFallback')
  )
  const opKind = computed(() => OP[opAction.value]?.kind)

  const openOp = async (action: string): Promise<void> => {
    opAction.value = action
    opForm.message = ''
    opForm.handlers = []
    opForm.nodeCode = ''
    // 无预填值：清空已选缓存，防上次对话框的选择残留进选项（有预填时改为 ensureUsers + syncSelected）
    syncSelected([])
    if (OP[action]?.kind === 'node') {
      backNodes.value = (await fetchFlowBackNodes(current.value.instanceId)) || []
    }
    opVisible.value = true
  }

  const submitOp = async (): Promise<void> => {
    if (submitting.value) return
    if (opKind.value === 'user' && !opForm.handlers.length) {
      ElMessage.warning(t('pages.system.flowCenter.selectUserWarn'))
      return
    }
    if (opKind.value === 'node' && !opForm.nodeCode) {
      ElMessage.warning(t('pages.system.flowCenter.selectHistoryNode'))
      return
    }
    submitting.value = true
    try {
      await OP[opAction.value].run(current.value)
      ElMessage.success(t('pages.system.flowCenter.msgSuccess'))
      opVisible.value = false
      detailVisible.value = false
      load()
    } finally {
      submitting.value = false
    }
  }

  const revoke = async (row: any): Promise<void> => {
    await ElMessageBox.confirm(
      t('pages.system.flowCenter.confirmRevoke'),
      t('pages.system.flowCenter.revoke'),
      { type: 'warning' }
    )
    await fetchFlowRevoke(row.instanceId)
    ElMessage.success(t('pages.system.flowCenter.msgRevoked'))
    load()
  }

  // ==================== 文案 ====================

  const STATUS: Record<string, string> = {
    '0': t('pages.system.flowCenter.statusDraft'),
    '1': t('pages.system.flowCenter.statusApproving'),
    '2': t('pages.system.flowCenter.approved'),
    '3': t('pages.system.flowCenter.statusAutoDone'),
    '4': t('pages.system.flowCenter.statusTerminated'),
    '5': t('pages.system.flowCenter.statusVoided'),
    '6': t('pages.system.flowCenter.statusRevoked'),
    '7': t('pages.system.flowCenter.statusTakenBack'),
    '8': t('pages.system.flowCenter.statusCompleted'),
    '9': t('pages.system.flowCenter.returned'),
    '10': t('pages.system.flowCenter.statusExpired'),
    '11': t('pages.system.flowCenter.statusRetrieved'),
    '12': t('pages.system.flowCenter.statusRestarted'),
    '13': t('pages.system.flowCenter.statusSaved')
  }
  const statusText = (h: any): string =>
    STATUS[String(h.flowStatus)] || t('pages.system.flowCenter.statusFallback')
  const statusTag = (h: any): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
    const s = String(h.flowStatus)
    if (s === '2' || s === '8') return 'success'
    if (s === '9' || s === '11') return 'warning'
    if (s === '4' || s === '5' || s === '6') return 'danger'
    if (s === '1') return 'primary'
    return 'info'
  }
  const skipText = (s: string): string =>
    ({
      PASS: t('pages.system.flowCenter.pass'),
      REJECT: t('pages.system.flowCenter.reject'),
      NONE: t('pages.system.flowCenter.submit')
    })[s] ||
    s ||
    '-'
  const timelineType = (h: any): 'primary' | 'success' | 'warning' | 'danger' => {
    const s = String(h.flowStatus)
    if (s === '9' || s === '11') return 'warning'
    if (s === '4' || s === '5') return 'danger'
    if (s === '2' || s === '8') return 'success'
    return 'primary'
  }

  onMounted(() => {
    load()
  })

  onDeactivated(closeDialogs)
</script>

<style scoped>
  .fc-toolbar {
    margin-bottom: 12px;
  }

  /* 页签内表格自由增长：卡片体与 tabs 改 flex 列布局，el-tabs__content 内部滚动，
     防矮视口下表格行被 .el-card__body（height:100% + overflow:hidden）裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .art-table-card :deep(.el-tabs) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .art-table-card :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .fc-detail {
    padding: 0 4px;
  }

  .fc-next-node {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }

  .fc-next-name {
    font-weight: 500;
  }

  .fc-next-tag {
    margin-left: 2px;
  }

  .fc-next-empty {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .fc-his-node {
    font-weight: 500;
  }

  .fc-his-meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--art-text-gray-600);
  }

  .fc-actions {
    display: flex;
    gap: 10px;
  }
</style>
