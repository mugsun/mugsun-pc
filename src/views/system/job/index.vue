<!-- 定时任务管理页（对接后端 /system/job，代理 PowerJob） -->
<template>
  <div class="job-page art-full-height">
    <ElCard class="art-table-card">
      <div class="job-toolbar">
        <ElButton v-perm="'sys:job:save'" type="primary" @click="showDialog()">{{
          $t('pages.system.job.createJob')
        }}</ElButton>
      </div>

      <!-- 表格自由增长：包一层 flex:1 定高壳内部滚动，防矮视口裁切 -->
      <div class="job-table-wrap">
        <ElTable :data="tableData" border height="100%" v-loading="loading">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn prop="jobName" :label="$t('pages.system.job.jobName')" min-width="140" />
          <ElTableColumn
            :label="$t('pages.system.job.processor')"
            min-width="150"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ simpleName(row.processorInfo) }}</template>
          </ElTableColumn>
          <ElTableColumn
            prop="jobParams"
            :label="$t('pages.system.job.jobParams')"
            min-width="110"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.jobParams || '—' }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.job.triggerType')" min-width="150">
            <template #default="{ row }">
              {{
                row.timeExpression
                  ? `CRON ${row.timeExpression}`
                  : $t('pages.system.job.manualTrigger')
              }}
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.job.nextTrigger')" min-width="160">
            <template #default="{ row }">{{ fmt(row.nextTriggerTime) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.job.status')" width="100">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1 ? $t('pages.system.job.enable') : $t('pages.system.job.disable')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.job.colOperation')" width="280" fixed="right">
            <template #default="{ row }">
              <ElButton v-perm="'sys:job:run'" link type="success" @click="run(row)">{{
                $t('pages.system.job.runNow')
              }}</ElButton>
              <ElButton v-perm="'sys:job:save'" link type="primary" @click="showDialog(row)">{{
                $t('pages.system.job.edit')
              }}</ElButton>
              <ElButton v-perm="'sys:job:edit'" link type="warning" @click="toggle(row)">
                {{
                  row.status === 1 ? $t('pages.system.job.disable') : $t('pages.system.job.enable')
                }}
              </ElButton>
              <ElButton link type="primary" @click="showLogs(row)">{{
                $t('pages.system.job.logs')
              }}</ElButton>
              <ElButton v-perm="'sys:job:remove'" link type="danger" @click="remove(row)">{{
                $t('pages.system.job.remove')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 新建 / 编辑 -->
    <ElDialog
      v-model="dialogVisible"
      :title="form.id ? $t('pages.system.job.editJob') : $t('pages.system.job.createJob')"
      width="500px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.job.jobName')" prop="jobName">
          <ElInput
            v-model="form.jobName"
            :placeholder="$t('pages.system.job.jobNamePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.job.description')">
          <ElInput
            v-model="form.jobDescription"
            :placeholder="$t('pages.system.job.descriptionPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.job.processor')" prop="processorInfo">
          <ElSelect
            v-model="form.processorInfo"
            :placeholder="$t('pages.system.job.processorPlaceholder')"
            style="width: 100%"
          >
            <ElOption
              v-for="p in processorOptions"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.job.jobParams')">
          <ElInput
            v-model="form.jobParams"
            :placeholder="$t('pages.system.job.jobParamsPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.job.triggerType')" prop="timeExpressionType">
          <ElSelect v-model="form.timeExpressionType" style="width: 100%">
            <ElOption :label="$t('pages.system.job.manualTrigger')" value="API" />
            <ElOption :label="$t('pages.system.job.cronTrigger')" value="CRON" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="form.timeExpressionType === 'CRON'" label="CRON" prop="timeExpression">
          <ElInput
            v-model="form.timeExpression"
            :placeholder="$t('pages.system.job.cronPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">{{
          $t('table.form.submit')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 执行日志 -->
    <ElDialog
      v-model="logsVisible"
      :title="$t('pages.system.job.logsTitle')"
      width="680px"
      align-center
      destroy-on-close
    >
      <ElTable :data="logs" border size="small" max-height="420">
        <ElTableColumn
          prop="instanceId"
          :label="$t('pages.system.job.instanceId')"
          min-width="180"
        />
        <ElTableColumn :label="$t('pages.system.job.status')" width="100">
          <template #default="{ row }">
            <ElTag :type="instTagType(row.status)">{{ instStatus(row.status) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.job.triggerTime')" min-width="170">
          <template #default="{ row }">{{ fmt(row.actualTriggerTime) }}</template>
        </ElTableColumn>
        <ElTableColumn
          prop="result"
          :label="$t('pages.system.job.result')"
          min-width="140"
          show-overflow-tooltip
        />
      </ElTable>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onDeactivated } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    fetchJobList,
    fetchJobProcessors,
    fetchSaveJob,
    fetchRunJob,
    fetchEnableJob,
    fetchDisableJob,
    fetchDeleteJob,
    fetchJobInstances
  } from '@/api/system-manage'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Job' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const logsVisible = ref(false)
  const logs = ref<any[]>([])
  const formRef = ref<FormInstance>()
  const processorOptions = ref<Array<{ label: string; value: string }>>([])
  const saving = ref(false)

  const form = reactive<Record<string, any>>({
    id: undefined,
    jobName: '',
    jobDescription: '',
    processorInfo: '',
    jobParams: '',
    timeExpressionType: 'API',
    timeExpression: ''
  })

  const rules: FormRules = {
    jobName: [
      { required: true, message: t('pages.system.job.jobNamePlaceholder'), trigger: 'blur' }
    ],
    processorInfo: [
      { required: true, message: t('pages.system.job.processorPlaceholder'), trigger: 'change' }
    ],
    timeExpression: [
      {
        validator: (_rule, value, callback) => {
          if (form.timeExpressionType === 'CRON' && (!value || !String(value).trim())) {
            callback(new Error(t('pages.system.job.cronRequired')))
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }

  /** 全限定类名 → 简单类名展示 */
  const simpleName = (className: string): string =>
    className ? className.substring(className.lastIndexOf('.') + 1) : '—'

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      tableData.value = (await fetchJobList()) || []
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    await loadData()
    processorOptions.value = (await fetchJobProcessors()) || []
  })

  const closeDialogs = (): void => {
    dialogVisible.value = false
    logsVisible.value = false
  }

  const showDialog = (row?: any): void => {
    closeDialogs()
    formRef.value?.clearValidate()
    Object.assign(form, {
      id: undefined,
      jobName: '',
      jobDescription: '',
      processorInfo: '',
      jobParams: '',
      timeExpressionType: 'API',
      timeExpression: ''
    })
    if (row) {
      form.id = row.id
      form.jobName = row.jobName
      form.jobDescription = row.jobDescription
      form.processorInfo = row.processorInfo || ''
      form.jobParams = row.jobParams || ''
      form.timeExpressionType = row.timeExpression ? 'CRON' : 'API'
      form.timeExpression = row.timeExpression || ''
    }
    dialogVisible.value = true
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value || saving.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      saving.value = true
      try {
        await fetchSaveJob({ ...form })
        dialogVisible.value = false
        ElMessage.success(t('pages.system.job.saveSuccess'))
        loadData()
      } finally {
        saving.value = false
      }
    })
  }

  const run = async (row: any): Promise<void> => {
    const instanceId = await fetchRunJob(row.id)
    ElMessage.success(t('pages.system.job.triggered', { id: instanceId }))
  }

  const toggle = async (row: any): Promise<void> => {
    if (row.status === 1) {
      await ElMessageBox.confirm(
        t('pages.system.job.disableConfirm', { name: row.jobName }),
        t('pages.system.job.disableTitle'),
        { type: 'warning' }
      )
      await fetchDisableJob(row.id)
      ElMessage.success(t('pages.system.job.disabled'))
    } else {
      await fetchEnableJob(row.id)
      ElMessage.success(t('pages.system.job.enabled'))
    }
    loadData()
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.job.removeConfirm', { name: row.jobName }),
      t('pages.system.job.removeTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchDeleteJob(row.id)
      ElMessage.success(t('pages.system.job.removeSuccess'))
      loadData()
    })
  }

  const showLogs = async (row: any): Promise<void> => {
    dialogVisible.value = false
    logs.value = (await fetchJobInstances(row.id)) || []
    logsVisible.value = true
  }

  onDeactivated(closeDialogs)

  const instStatus = (s: number): string => {
    const map: Record<number, string> = {
      1: t('pages.system.job.instWaitingDispatch'),
      2: t('pages.system.job.instWaitingReceive'),
      3: t('pages.system.job.instRunning'),
      4: t('pages.system.job.instFailed'),
      5: t('pages.system.job.instSuccess'),
      9: t('pages.system.job.instCanceled'),
      10: t('pages.system.job.instStopped')
    }
    return map[s] || String(s)
  }

  const instTagType = (s: number): 'success' | 'danger' | 'warning' | 'info' => {
    if (s === 5) return 'success'
    if (s === 4) return 'danger'
    if (s === 3) return 'warning'
    return 'info'
  }

  const fmt = (ts: number): string => (ts ? new Date(ts).toLocaleString('zh-CN') : '-')
</script>

<style scoped>
  .job-toolbar {
    margin-bottom: 12px;
  }

  /* 表格自由增长：卡片体改 flex 列布局 + 表格壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .job-table-wrap {
    flex: 1;
    min-height: 0;
  }
</style>
