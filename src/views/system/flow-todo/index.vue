<!-- 待办工作台：我的待办（办理/退回/撤回/转办/委派/加减签/作废/抄送）+ 我的抄送 + 进度时间线 -->
<template>
  <div class="flow-todo-page art-full-height">
    <ElCard class="art-table-card">
      <ElTabs v-model="tab" @tab-change="onTabChange">
        <ElTabPane :label="$t('pages.system.flowTodo.tabTodo')" name="todo">
          <div class="flow-toolbar">
            <ElButton :loading="loading" @click="loadTodo">{{
              $t('pages.system.flowTodo.refresh')
            }}</ElButton>
          </div>
          <ElTable :data="todo" border :loading="loading">
            <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
            <ElTableColumn
              prop="businessId"
              :label="$t('pages.system.flowTodo.businessId')"
              min-width="150"
            />
            <ElTableColumn
              prop="flowName"
              :label="$t('pages.system.flowTodo.flow')"
              min-width="120"
            />
            <ElTableColumn
              prop="nodeName"
              :label="$t('pages.system.flowTodo.currentNode')"
              min-width="120"
            />
            <ElTableColumn
              prop="createTime"
              :label="$t('pages.system.flowTodo.arriveTime')"
              min-width="170"
            >
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowTodo.actions')" width="300" fixed="right">
              <template #default="{ row }">
                <ElButton link type="success" @click="open('pass', row)">{{
                  $t('pages.system.flowTodo.pass')
                }}</ElButton>
                <ElButton link type="warning" @click="open('reject', row)">{{
                  $t('pages.system.flowTodo.reject')
                }}</ElButton>
                <ElButton link type="primary" @click="showHistory(row)">{{
                  $t('pages.system.flowTodo.progress')
                }}</ElButton>
                <ElDropdown class="flow-more" @command="(c: string) => open(c, row)">
                  <ElButton link type="info"
                    >{{ $t('pages.system.flowTodo.more') }}<ElIcon><ArrowDown /></ElIcon
                  ></ElButton>
                  <template #dropdown>
                    <ElDropdownMenu>
                      <ElDropdownItem command="rejectNode">{{
                        $t('pages.system.flowTodo.rejectNode')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="transfer">{{
                        $t('pages.system.flowTodo.transfer')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="depute">{{
                        $t('pages.system.flowTodo.depute')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="addSignature">{{
                        $t('pages.system.flowTodo.addSignature')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="reductionSignature">{{
                        $t('pages.system.flowTodo.reductionSignature')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="copy">{{
                        $t('pages.system.flowTodo.copy')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="revoke" divided>{{
                        $t('pages.system.flowTodo.revoke')
                      }}</ElDropdownItem>
                      <ElDropdownItem command="terminate">{{
                        $t('pages.system.flowTodo.terminate')
                      }}</ElDropdownItem>
                    </ElDropdownMenu>
                  </template>
                </ElDropdown>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane :label="$t('pages.system.flowTodo.tabCopy')" name="copy">
          <div class="flow-toolbar">
            <ElButton :loading="loading" @click="loadCopy">{{
              $t('pages.system.flowTodo.refresh')
            }}</ElButton>
          </div>
          <ElTable :data="copyList" border :loading="loading">
            <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
            <ElTableColumn
              prop="businessId"
              :label="$t('pages.system.flowTodo.businessId')"
              min-width="150"
            />
            <ElTableColumn
              prop="flowName"
              :label="$t('pages.system.flowTodo.flow')"
              min-width="120"
            />
            <ElTableColumn prop="flowStatus" :label="$t('pages.system.flowTodo.status')" width="90">
              <template #default="{ row }">
                <ArtDictTag :code="DICT_CODE.FLOW_STATUS" :value="row.flowStatus" />
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="createTime"
              :label="$t('pages.system.flowTodo.copyTime')"
              min-width="170"
            >
              <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.flowTodo.actions')" width="90" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="showHistory(row)">{{
                  $t('pages.system.flowTodo.progress')
                }}</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>

      <!-- 统一动作对话框 -->
      <ElDialog v-model="opVisible" :title="opTitle" width="480px" align-center destroy-on-close>
        <ElForm label-width="72px">
          <ElFormItem v-if="opKind === 'node'" :label="$t('pages.system.flowTodo.rejectNodeLabel')">
            <ElSelect
              v-model="opForm.nodeCode"
              :placeholder="$t('pages.system.flowTodo.selectHistoryNode')"
              style="width: 100%"
            >
              <ElOption
                v-for="n in nodes"
                :key="n.nodeCode"
                :label="n.nodeName"
                :value="n.nodeCode"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem v-if="opKind === 'user'" :label="$t('pages.system.flowTodo.selectUser')">
            <ElSelect
              v-model="opForm.handlers"
              multiple
              filterable
              remote
              :remote-method="searchUsers"
              :loading="userSearching"
              :placeholder="$t('pages.system.flowTodo.userSearchPlaceholder')"
              style="width: 100%"
              @change="syncSelected"
            >
              <ElOption v-for="u in users" :key="u.value" :label="u.label" :value="u.value" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem v-if="opAction !== 'copy'" :label="$t('pages.system.flowTodo.opinion')">
            <ElInput
              v-model="opForm.message"
              type="textarea"
              :rows="2"
              :placeholder="$t('pages.system.flowTodo.optional')"
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

      <ElDialog
        v-model="historyVisible"
        :title="$t('pages.system.flowTodo.historyTitle')"
        width="520px"
        align-center
        destroy-on-close
        class="flow-history-dialog"
      >
        <ElTimeline>
          <ElTimelineItem
            v-for="(h, i) in history"
            :key="i"
            :type="timelineType(h)"
            :timestamp="formatTableTime(h.createTime)"
          >
            <div class="flow-his-node">{{ h.nodeName }}</div>
            <div class="flow-his-meta">
              {{ statusText(h) }}
              <span v-if="h.approver">{{
                $t('pages.system.flowTodo.handlerText', { name: h.approver })
              }}</span>
              <span v-if="h.message">· {{ h.message }}</span>
            </div>
          </ElTimelineItem>
        </ElTimeline>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onDeactivated } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ArrowDown } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import ArtDictTag from '@/components/core/base/art-dict-tag/index.vue'
  import { useDictStore } from '@/store/modules/dict'
  import { DICT_CODE } from '@/utils/constants'
  import { formatTableTime } from '@/utils/date'
  import {
    fetchFlowMyTodo,
    fetchFlowMyCopy,
    fetchFlowHandle,
    fetchFlowReject,
    fetchFlowRejectNode,
    fetchFlowRevoke,
    fetchFlowTerminate,
    fetchFlowOperation,
    fetchFlowCopy,
    fetchFlowBackNodes,
    fetchFlowHistory
  } from '@/api/system-manage'
  import { useUserSelectSearch } from '@/hooks'

  defineOptions({ name: 'FlowTodo' })

  const { t } = useI18n()

  const dictStore = useDictStore()

  const tab = ref('todo')
  const todo = ref<any[]>([])
  const copyList = ref<any[]>([])
  const loading = ref(false)
  // 目标人员远程搜索：成千账号场景不下全量（默认 50 条 + 关键字防抖查询）
  const { userOptions: users, userSearching, searchUsers, syncSelected } = useUserSelectSearch()

  const historyVisible = ref(false)
  const history = ref<any[]>([])

  // 动作对话框
  const opVisible = ref(false)
  const opAction = ref('')
  const opRow = ref<any>(null)
  const nodes = ref<any[]>([])
  const submitting = ref(false)
  const opForm = reactive<{ message: string; handlers: any[]; nodeCode: string }>({
    message: '',
    handlers: [],
    nodeCode: ''
  })

  // 动作元数据：kind 决定对话框字段，run 分派 API
  const ACTIONS: Record<
    string,
    { title: string; kind: 'message' | 'node' | 'user'; run: (row: any) => Promise<any> }
  > = {
    pass: {
      title: t('pages.system.flowTodo.pass'),
      kind: 'message',
      run: (r) => fetchFlowHandle(r.taskId, opForm.message)
    },
    reject: {
      title: t('pages.system.flowTodo.titleRejectPrev'),
      kind: 'message',
      run: (r) => fetchFlowReject(r.taskId, opForm.message)
    },
    rejectNode: {
      title: t('pages.system.flowTodo.rejectNode'),
      kind: 'node',
      run: (r) => fetchFlowRejectNode(r.taskId, opForm.nodeCode, opForm.message)
    },
    revoke: {
      title: t('pages.system.flowTodo.revoke'),
      kind: 'message',
      run: (r) => fetchFlowRevoke(r.instanceId, opForm.message)
    },
    terminate: {
      title: t('pages.system.flowTodo.terminate'),
      kind: 'message',
      run: (r) => fetchFlowTerminate(r.taskId, opForm.message)
    },
    transfer: {
      title: t('pages.system.flowTodo.transfer'),
      kind: 'user',
      run: (r) => fetchFlowOperation(r.taskId, 'transfer', opForm.handlers, opForm.message)
    },
    depute: {
      title: t('pages.system.flowTodo.depute'),
      kind: 'user',
      run: (r) => fetchFlowOperation(r.taskId, 'depute', opForm.handlers, opForm.message)
    },
    addSignature: {
      title: t('pages.system.flowTodo.addSignature'),
      kind: 'user',
      run: (r) => fetchFlowOperation(r.taskId, 'addSignature', opForm.handlers, opForm.message)
    },
    reductionSignature: {
      title: t('pages.system.flowTodo.reductionSignature'),
      kind: 'user',
      run: (r) =>
        fetchFlowOperation(r.taskId, 'reductionSignature', opForm.handlers, opForm.message)
    },
    copy: {
      title: t('pages.system.flowTodo.copy'),
      kind: 'user',
      run: (r) => fetchFlowCopy(r.taskId, opForm.handlers)
    }
  }

  const opTitle = computed(
    () => ACTIONS[opAction.value]?.title || t('pages.system.flowTodo.opFallback')
  )
  const opKind = computed(() => ACTIONS[opAction.value]?.kind)

  const closeDialogs = (): void => {
    opVisible.value = false
    historyVisible.value = false
    ElMessageBox.close()
  }

  const loadTodo = async (): Promise<void> => {
    loading.value = true
    try {
      todo.value = (await fetchFlowMyTodo()) || []
    } finally {
      loading.value = false
    }
  }
  const loadCopy = async (): Promise<void> => {
    loading.value = true
    try {
      copyList.value = (await fetchFlowMyCopy()) || []
    } finally {
      loading.value = false
    }
  }
  const onTabChange = (name: string | number): void => {
    if (name === 'copy') loadCopy()
    else loadTodo()
  }

  const open = async (action: string, row: any): Promise<void> => {
    historyVisible.value = false
    opAction.value = action
    opRow.value = row
    opForm.message = ''
    opForm.handlers = []
    opForm.nodeCode = ''
    // 无预填值：清空已选缓存，防上次对话框的选择残留进选项（有预填时改为 ensureUsers + syncSelected）
    syncSelected([])
    if (ACTIONS[action]?.kind === 'node') {
      nodes.value = (await fetchFlowBackNodes(row.instanceId)) || []
    }
    opVisible.value = true
  }

  const submitOp = async (): Promise<void> => {
    if (submitting.value) return
    submitting.value = true
    try {
      await ACTIONS[opAction.value].run(opRow.value)
      ElMessage.success(t('pages.system.flowTodo.msgSuccess'))
      opVisible.value = false
      loadTodo()
    } finally {
      submitting.value = false
    }
  }

  const showHistory = async (row: any): Promise<void> => {
    opVisible.value = false
    history.value = (await fetchFlowHistory(row.instanceId)) || []
    historyVisible.value = true
  }

  // 字典运行时驱动：状态文案取 flow_status 字典（时间线纯文本场景用），不再手写 map
  const statusText = (h: any): string =>
    dictStore.getItem(DICT_CODE.FLOW_STATUS, h.flowStatus)?.dictValue ||
    h.skipType ||
    t('pages.system.flowTodo.statusFallback')

  const timelineType = (h: any): 'primary' | 'success' | 'warning' | 'danger' => {
    const s = String(h.flowStatus)
    if (s === '9' || s === '11') return 'warning'
    if (s === '4' || s === '5') return 'danger'
    if (s === '2' || s === '8') return 'success'
    return 'primary'
  }

  onMounted(() => {
    dictStore.ensure([DICT_CODE.FLOW_STATUS])
    loadTodo()
  })

  onDeactivated(closeDialogs)
</script>

<style scoped>
  .flow-toolbar {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }

  .flow-more {
    margin-left: 12px;
  }

  .flow-his-node {
    font-weight: 500;
  }

  .flow-his-meta {
    margin-top: 2px;
    font-size: 12px;
    color: var(--art-text-gray-600);
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
</style>

<!-- 进度弹窗内容 teleport 到 body，时间线条目数不定：非 scoped 类限定滚动（同 track-app-dialog 范式），防矮视口截断 -->
<style>
  .flow-history-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
