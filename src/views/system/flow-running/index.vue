<!-- 运行中的流程：挂起、恢复，或填写原因后终止 -->
<template>
  <div class="flow-running-page art-full-height">
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElInput
          v-model="instanceId"
          clearable
          class="id-input"
          :placeholder="$t('pages.system.flowRunning.instancePlaceholder')"
          @keyup.enter="load"
        />
        <ElInput
          v-model="flowCode"
          clearable
          class="code-input"
          :placeholder="$t('pages.system.flowRunning.flowCodePlaceholder')"
          @keyup.enter="load"
        />
        <ElButton @click="load">{{ $t('pages.system.flowRunning.search') }}</ElButton>
        <ElButton @click="reset">{{ $t('pages.system.flowRunning.reset') }}</ElButton>
      </div>
      <ElAlert
        v-if="!loading && rows.length === 0"
        type="info"
        :closable="false"
        :title="$t('pages.system.flowRunning.empty')"
      />
      <ElTable v-loading="loading" :data="rows" border>
        <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
        <ElTableColumn
          prop="flowName"
          :label="$t('pages.system.flowRunning.flow')"
          min-width="120"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="businessId"
          :label="$t('pages.system.flowRunning.businessId')"
          min-width="120"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="nodeName"
          :label="$t('pages.system.flowRunning.node')"
          min-width="100"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('pages.system.flowRunning.activity')" width="88">
          <template #default="{ row }">
            <ElTag :type="row.activityStatus === 0 ? 'warning' : 'success'">
              {{
                row.activityStatus === 0
                  ? $t('pages.system.flowRunning.suspended')
                  : $t('pages.system.flowRunning.active')
              }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.flowRunning.time')" width="168">
          <template #default="{ row }">{{ formatTableTime(row.createTime) }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('table.column.operation')" width="168" fixed="right">
          <template #default="{ row }">
            <ElButton
              v-if="row.activityStatus !== 0"
              v-perm="'sys:flow:running:active'"
              link
              type="warning"
              @click="suspend(row)"
              >{{ $t('pages.system.flowRunning.suspend') }}</ElButton
            >
            <ElButton
              v-else
              v-perm="'sys:flow:running:active'"
              link
              type="primary"
              @click="resume(row)"
              >{{ $t('pages.system.flowRunning.resume') }}</ElButton
            >
            <ElButton
              v-perm="'sys:flow:running:terminate'"
              link
              type="danger"
              @click="openStop(row)"
              >{{ $t('pages.system.flowRunning.terminate') }}</ElButton
            >
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="$t('pages.system.flowRunning.terminate')"
      width="420px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.flowRunning.reason')" prop="reason">
          <ElInput
            v-model="form.reason"
            type="textarea"
            :rows="3"
            :placeholder="$t('pages.system.flowRunning.reasonPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="stop">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { formatTableTime } from '@/utils/date'
  import {
    fetchFlowRunning,
    fetchResumeRunningFlow,
    fetchStopRunningFlow,
    fetchSuspendRunningFlow
  } from '@/api/system-manage'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'FlowRunning' })

  const { t } = useI18n()
  const instanceId = ref('')
  const flowCode = ref('')
  const rows = ref<any[]>([])
  const loading = ref(false)
  const visible = ref(false)
  const saving = ref(false)
  const currentId = ref('')
  const formRef = ref<FormInstance>()
  const form = reactive({ reason: '' })
  const rules: FormRules = {
    reason: [
      { required: true, message: t('pages.system.flowRunning.reasonPlaceholder'), trigger: 'blur' }
    ]
  }

  async function load() {
    loading.value = true
    try {
      rows.value =
        (await fetchFlowRunning({
          instanceId: instanceId.value || undefined,
          flowCode: flowCode.value || undefined
        })) || []
    } finally {
      loading.value = false
    }
  }

  function reset() {
    instanceId.value = ''
    flowCode.value = ''
    load()
  }

  async function suspend(row: any) {
    await fetchSuspendRunningFlow(String(row.instanceId))
    ElMessage.success(t('pages.system.flowRunning.suspendedOk'))
    await load()
  }

  async function resume(row: any) {
    await fetchResumeRunningFlow(String(row.instanceId))
    ElMessage.success(t('pages.system.flowRunning.resumed'))
    await load()
  }

  function openStop(row: any) {
    currentId.value = String(row.instanceId)
    form.reason = ''
    visible.value = true
  }

  async function stop() {
    if (!formRef.value || saving.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      saving.value = true
      try {
        await fetchStopRunningFlow(currentId.value, form.reason)
        visible.value = false
        ElMessage.success(t('pages.system.flowRunning.terminated'))
        await load()
      } finally {
        saving.value = false
      }
    })
  }

  onMounted(load)
</script>

<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .id-input,
  .code-input {
    width: 200px;
  }

  .art-table-card :deep(.el-alert) {
    margin-bottom: 12px;
  }
</style>
