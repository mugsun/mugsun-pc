<!-- 登录客户端差异化策略：验证码开关 / 并发在线数 / 令牌有效期，一 client 一套 -->
<template>
  <div class="client-page art-full-height">
    <ElCard class="art-table-card">
      <div class="client-toolbar">
        <span class="client-title">{{ $t('pages.system.client.pageTitle') }}</span>
        <ElButton v-perm="'sys:client:save'" type="primary" @click="openCreate">{{
          $t('pages.system.client.addBtn')
        }}</ElButton>
      </div>

      <div class="client-table-scroll">
        <ElTable :data="tableData" border v-loading="loading">
          <ElTableColumn
            prop="clientId"
            :label="$t('pages.system.client.colClientId')"
            min-width="120"
          />
          <ElTableColumn
            prop="clientName"
            :label="$t('pages.system.client.colName')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.client.colCaptcha')" width="110">
            <template #default="{ row }">
              <ElTag :type="row.captchaEnabled === 1 ? 'success' : 'info'" size="small">
                {{
                  row.captchaEnabled === 1
                    ? $t('pages.system.client.captchaOn')
                    : $t('pages.system.client.captchaOff')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="maxOnline"
            :label="$t('pages.system.client.colMaxOnline')"
            width="130"
          />
          <ElTableColumn :label="$t('pages.system.client.colTokenTimeout')" width="120">
            <template #default="{ row }">{{ formatSecondsDuration(row.tokenTimeout) }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.client.colStatus')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'danger'" size="small">
                {{
                  row.status === 1
                    ? $t('pages.system.client.statusEnabled')
                    : $t('pages.system.client.statusDisabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.client.colOperation')" width="220" fixed="right">
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:client:save'"
                link
                type="primary"
                size="small"
                @click="openEdit(row)"
                >{{ $t('pages.system.client.editBtn') }}</ElButton
              >
              <ElButton
                v-perm="'sys:client:edit'"
                link
                :type="row.status === 1 ? 'warning' : 'success'"
                size="small"
                @click="toggleStatus(row)"
              >
                {{
                  row.status === 1
                    ? $t('pages.system.client.statusDisabled')
                    : $t('pages.system.client.statusEnabled')
                }}
              </ElButton>
              <ElButton
                v-perm="'sys:client:remove'"
                link
                type="danger"
                size="small"
                @click="remove(row)"
                >{{ $t('pages.system.client.deleteBtn') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <div class="client-pager">
        <ElPagination
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="pageNum"
          @current-change="onPage"
        />
      </div>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="
        dialogType === 'add'
          ? $t('pages.system.client.addBtn')
          : $t('pages.system.client.editTitle')
      "
      width="480px"
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="120px">
        <ElFormItem :label="$t('pages.system.client.colClientId')" prop="clientId">
          <ElInput
            v-model="form.clientId"
            :disabled="dialogType === 'edit'"
            :placeholder="$t('pages.system.client.clientIdPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.client.colName')" prop="clientName">
          <ElInput v-model="form.clientName" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.client.colCaptcha')">
          <ElSwitch v-model="form.captchaEnabled" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.client.colMaxOnline')">
          <ElInputNumber v-model="form.maxOnline" :min="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.client.formTokenTimeout')">
          <ElInputNumber v-model="form.tokenTimeout" :min="60" :step="600" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="submitLoading" @click="submit">{{
          $t('pages.system.client.saveBtn')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onDeactivated, onMounted, reactive, ref } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchClientPage,
    fetchSaveClient,
    fetchRemoveClient,
    fetchEnableClient,
    fetchDisableClient
  } from '@/api/client'
  import { formatSecondsDuration } from '@/utils/date'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Client' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const total = ref(0)
  const pageNum = ref(1)
  const pageSize = 10

  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const submitLoading = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive<any>({
    id: undefined,
    clientId: '',
    clientName: '',
    captchaEnabled: 1,
    maxOnline: 0,
    tokenTimeout: 2592000
  })

  const rules: FormRules = {
    clientId: [{ required: true, message: t('pages.system.client.ruleClientId'), trigger: 'blur' }],
    clientName: [{ required: true, message: t('pages.system.client.ruleName'), trigger: 'blur' }]
  }

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const res: any = await fetchClientPage({ pageNum: pageNum.value, pageSize })
      tableData.value = res?.records ?? []
      total.value = res?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  const onPage = (p: number): void => {
    pageNum.value = p
    loadData()
  }

  const closeDialog = (): void => {
    dialogVisible.value = false
  }

  const openCreate = (): void => {
    dialogType.value = 'add'
    Object.assign(form, {
      id: undefined,
      clientId: '',
      clientName: '',
      captchaEnabled: 1,
      maxOnline: 0,
      tokenTimeout: 2592000
    })
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const openEdit = (row: any): void => {
    dialogType.value = 'edit'
    Object.assign(form, row)
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value || submitLoading.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      submitLoading.value = true
      try {
        await fetchSaveClient(form)
        ElMessage.success(t('pages.system.client.saveSuccess'))
        dialogVisible.value = false
        loadData()
      } finally {
        submitLoading.value = false
      }
    })
  }

  const toggleStatus = async (row: any): Promise<void> => {
    // 启用无风险直接执行；停用后该客户端将无法登录，属危险操作须二次确认
    if (row.status !== 1) {
      await fetchEnableClient(row.id)
      ElMessage.success(t('pages.system.client.operateSuccess'))
      loadData()
      return
    }
    ElMessageBox.confirm(
      t('pages.system.client.disableConfirm', { name: row.clientName }),
      t('pages.system.client.disableTitle'),
      {
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchDisableClient(row.id)
        ElMessage.success(t('pages.system.client.operateSuccess'))
        loadData()
      })
      .catch(() => {})
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.client.deleteConfirm', { name: row.clientName }),
      t('pages.system.client.deleteTitle'),
      {
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveClient([row.id])
        ElMessage.success(t('pages.system.client.deleteSuccess'))
        loadData()
      })
      .catch(() => {})
  }

  onDeactivated(() => {
    ElMessageBox.close()
    closeDialog()
  })

  onMounted(loadData)
</script>

<style scoped>
  /* 表格为自由增长内容：.art-table-card 定高 + .el-card__body 裁剪，
     须自备内部滚动，否则矮视口多行时底部行被切断不可达（范式同 monitor/track-user） */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .client-toolbar {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .client-title {
    font-size: 15px;
    font-weight: 500;
  }

  .client-table-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .client-pager {
    display: flex;
    flex-shrink: 0;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
