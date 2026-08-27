<!-- 流程设计中心：图形设计器（条件分支/并行/会签递归树）+ 流程定义版本/发布/停用/分类管理 -->
<template>
  <div class="flow-graph-page art-full-height">
    <ElCard class="art-table-card">
      <div class="fg-toolbar">
        <ElButton v-perm="'sys:flow:design-graph'" type="primary" @click="openDesigner">{{
          $t('pages.system.flowGraph.designGraph')
        }}</ElButton>
        <ElButton :loading="loading" @click="loadDefs">{{
          $t('pages.system.flowGraph.refresh')
        }}</ElButton>
      </div>

      <!-- 表格自由增长：包一层 flex:1 定高壳内部滚动，防矮视口裁切 -->
      <div class="fg-table-wrap">
        <ElTable :data="defs" border height="100%" :loading="loading">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="56" />
          <ElTableColumn
            prop="flowCode"
            :label="$t('pages.system.flowGraph.flowCode')"
            min-width="130"
          />
          <ElTableColumn
            prop="flowName"
            :label="$t('pages.system.flowGraph.flowName')"
            min-width="140"
          />
          <ElTableColumn :label="$t('pages.system.flowGraph.category')" width="100">
            <template #default="{ row }">{{ row.category || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn prop="version" :label="$t('pages.system.flowGraph.version')" width="70" />
          <ElTableColumn :label="$t('pages.system.flowGraph.publish')" width="90">
            <template #default="{ row }">
              <ElTag :type="publishTag(row.isPublish)" size="small">{{
                publishText(row.isPublish)
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.flowGraph.status')" width="90">
            <template #default="{ row }">
              <ElTag :type="String(row.activityStatus) === '1' ? 'success' : 'info'" size="small">
                {{
                  String(row.activityStatus) === '1'
                    ? $t('pages.system.flowGraph.enabled')
                    : $t('pages.system.flowGraph.disabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="createTime"
            :label="$t('pages.system.flowGraph.createTime')"
            min-width="170"
          >
            <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.flowGraph.actions')" width="230" fixed="right">
            <template #default="{ row }">
              <ElButton
                v-if="String(row.activityStatus) === '1'"
                v-perm="'sys:flow:definition'"
                link
                type="warning"
                @click="act('suspend', row)"
                >{{ $t('pages.system.flowGraph.disabled') }}</ElButton
              >
              <ElButton
                v-else
                v-perm="'sys:flow:definition'"
                link
                type="success"
                @click="act('active', row)"
                >{{ $t('pages.system.flowGraph.enabled') }}</ElButton
              >
              <ElButton
                v-perm="'sys:flow:definition'"
                link
                type="primary"
                @click="act('copy', row)"
                >{{ $t('pages.system.flowGraph.copyNewVersion') }}</ElButton
              >
              <ElButton
                v-perm="'sys:flow:definition'"
                link
                type="danger"
                @click="act('remove', row)"
                >{{ $t('pages.system.flowGraph.delete') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 图形设计器 -->
    <ElDialog
      v-model="designerVisible"
      :title="$t('pages.system.flowGraph.designerTitle')"
      fullscreen
      destroy-on-close
    >
      <ElForm :model="design" inline label-width="80px" class="fg-form">
        <ElFormItem :label="$t('pages.system.flowGraph.flowCode')" required>
          <ElInput
            v-model="design.flowCode"
            :placeholder="$t('pages.system.flowGraph.flowCodePlaceholder')"
            style="width: 180px"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.flowGraph.flowName')" required>
          <ElInput
            v-model="design.flowName"
            :placeholder="$t('pages.system.flowGraph.flowNamePlaceholder')"
            style="width: 200px"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.flowGraph.category')">
          <ElInput
            v-model="design.category"
            :placeholder="$t('pages.system.flowGraph.categoryPlaceholder')"
            style="width: 140px"
          />
        </ElFormItem>
      </ElForm>

      <div class="fg-canvas">
        <div class="fg-terminal fg-terminal--start">{{
          $t('pages.system.flowGraph.startNode')
        }}</div>
        <GraphChain :nodes="design.nodes" />
        <div class="fg-terminal fg-terminal--end">{{ $t('pages.system.flowGraph.endNode') }}</div>
      </div>

      <template #footer>
        <ElButton @click="designerVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton
          v-perm="'sys:flow:design-graph'"
          type="primary"
          :loading="submitting"
          @click="submitDesign"
          >{{ $t('pages.system.flowGraph.deploy') }}</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, provide, onMounted, onDeactivated } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import GraphChain from './GraphChain.vue'
  import { newNode, toTree, validateTree, type GNode } from './graph-model'
  import {
    fetchFlowDefinitions,
    fetchFlowDesignGraph,
    fetchFlowDefActive,
    fetchFlowDefSuspend,
    fetchFlowDefCopy,
    fetchFlowDefRemove,
    fetchDeptSelect
  } from '@/api/system-manage'
  import { useUserSelectSearch } from '@/hooks'
  import { fetchRoleCodeSelect } from '@/api/role'
  import { formatTableTime } from '@/utils/date'

  defineOptions({ name: 'FlowGraph' })

  const { t } = useI18n()

  // 候选人「指定用户」远程搜索：成千账号场景不下全量（默认 50 条 + 关键字防抖查询）
  const { userOptions, userSearching, searchUsers, syncSelected, ensureUsers } =
    useUserSelectSearch()

  // 收集整棵节点树的 user 候选人 id（递归分支子链）
  const collectUserValues = (nodes: GNode[]): Array<number | string> =>
    nodes.flatMap((n) => [
      ...n.candidates.filter((c) => c.type === 'user' && c.value !== '').map((c) => c.value),
      ...n.branches.flatMap((b) => collectUserValues(b.children))
    ])

  const defs = ref<any[]>([])
  const loading = ref(false)
  const designerVisible = ref(false)
  const submitting = ref(false)
  const design = reactive<{ flowCode: string; flowName: string; category: string; nodes: GNode[] }>(
    {
      flowCode: '',
      flowName: '',
      category: '',
      nodes: []
    }
  )

  // reg 为 GraphChain 递归子组件共享的注册表：角色/部门量小全量，用户选项由远程搜索驱动
  const reg = reactive<{
    roles: any[]
    depts: any[]
    users: any[]
    userSearching: boolean
    searchUsers: (keyword: string) => void
    syncSelected: () => void
    ensureUsers: (ids: Array<number | string>) => Promise<void>
  }>({
    roles: [],
    depts: [],
    users: [],
    userSearching: false,
    searchUsers,
    // 多候选人单选共享选项缓存：任一选择变化时把整棵树的 user 候选人同步为已选集合
    syncSelected: () => syncSelected(collectUserValues(design.nodes)),
    ensureUsers
  })
  provide('flowReg', reg)

  // composable 选项/加载态同步进 reg，供 GraphChain 候选人下拉渲染
  watch(userOptions, (list) => (reg.users = [...list]), { immediate: true })
  watch(userSearching, (v) => (reg.userSearching = v), { immediate: true })

  const loadDefs = async (): Promise<void> => {
    loading.value = true
    try {
      defs.value = (await fetchFlowDefinitions()) || []
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await loadDefs()
    reg.roles = (await fetchRoleCodeSelect()) || []
    reg.depts = (await fetchDeptSelect()) || []
  })

  const closeDialogs = (): void => {
    designerVisible.value = false
    ElMessageBox.close()
  }

  const openDesigner = (): void => {
    Object.assign(design, {
      flowCode: '',
      flowName: '',
      category: '',
      nodes: [newNode('approval')]
    })
    // 编辑回显兜底：打开时按 id 精确补拉 user 候选人选项（新建时为空集合，直接跳过）
    void ensureUsers(collectUserValues(design.nodes))
    designerVisible.value = true
  }

  const submitDesign = async (): Promise<void> => {
    if (submitting.value) return
    if (!design.flowCode || !design.flowName) {
      ElMessage.warning(t('pages.system.flowGraph.msgCodeNameRequired'))
      return
    }
    if (!design.nodes.length) {
      ElMessage.warning(t('pages.system.flowGraph.msgNodeRequired'))
      return
    }
    const err = validateTree(design.nodes)
    if (err) {
      ElMessage.warning(err)
      return
    }
    submitting.value = true
    try {
      await fetchFlowDesignGraph({
        flowCode: design.flowCode,
        flowName: design.flowName,
        category: design.category || null,
        root: toTree(design.nodes)
      })
      ElMessage.success(t('pages.system.flowGraph.msgDeployed'))
      designerVisible.value = false
      loadDefs()
    } finally {
      submitting.value = false
    }
  }

  const ACTIONS: Record<string, { api: (id: any) => Promise<any>; ok: string; confirm?: string }> =
    {
      suspend: {
        api: fetchFlowDefSuspend,
        ok: t('pages.system.flowGraph.msgSuspended'),
        confirm: t('pages.system.flowGraph.confirmSuspend')
      },
      active: { api: fetchFlowDefActive, ok: t('pages.system.flowGraph.msgEnabled') },
      copy: { api: fetchFlowDefCopy, ok: t('pages.system.flowGraph.msgCopied') },
      remove: {
        api: (id) => fetchFlowDefRemove([id]),
        ok: t('pages.system.flowGraph.msgDeleted'),
        confirm: t('pages.system.flowGraph.confirmDelete')
      }
    }

  const act = async (key: string, row: any): Promise<void> => {
    const a = ACTIONS[key]
    if (a.confirm) {
      await ElMessageBox.confirm(a.confirm, t('common.tips'), { type: 'warning' })
    }
    await a.api(row.id)
    ElMessage.success(a.ok)
    loadDefs()
  }

  const publishText = (s: any): string =>
    ({
      '0': t('pages.system.flowGraph.publish0'),
      '1': t('pages.system.flowGraph.publish1'),
      '9': t('pages.system.flowGraph.publish9')
    })[String(s)] || t('pages.system.flowGraph.publishUnknown')
  const publishTag = (s: any): 'success' | 'info' | 'warning' =>
    String(s) === '1' ? 'success' : String(s) === '9' ? 'warning' : 'info'

  onDeactivated(closeDialogs)
</script>

<style scoped>
  .fg-toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .fg-form {
    margin-bottom: 12px;
  }

  .fg-canvas {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    overflow: auto;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
  }

  .fg-terminal {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 90px;
    padding: 10px;
    color: #fff;
    border-radius: 18px;
  }

  .fg-terminal--start {
    background: var(--el-color-success);
  }

  .fg-terminal--end {
    background: var(--el-color-info);
  }

  /* 表格自由增长：卡片体改 flex 列布局 + 表格壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .fg-table-wrap {
    flex: 1;
    min-height: 0;
  }
</style>
