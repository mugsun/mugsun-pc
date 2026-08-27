<!-- 租户独立数据源配置（对接 /system/tenant-datasource）：配置后该租户业务数据落独立库 -->
<template>
  <div class="tds-page art-full-height">
    <ElCard class="art-table-card">
      <div class="tds-toolbar">
        <ElButton v-perm="'sys:tenant-datasource:save'" type="primary" @click="showCreate">{{
          $t('pages.system.tenantDatasource.create')
        }}</ElButton>
        <ElAlert
          type="info"
          :closable="false"
          :title="$t('pages.system.tenantDatasource.alertTip')"
        />
      </div>

      <!-- 表格为自由增长内容：art-table-card 卡片体是 height:100%+overflow:hidden 裁剪，
           内部须自备滚动，否则矮视口下底部行被切断且不可达（同 track/user 修法） -->
      <div v-loading="loading" class="tds-table-wrap">
        <ElTable :data="tableData" border>
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn
            prop="tenantCode"
            :label="$t('pages.system.tenantDatasource.tenantCode')"
            width="120"
          />
          <ElTableColumn
            prop="dsUrl"
            :label="$t('pages.system.tenantDatasource.dsUrl')"
            min-width="280"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="dsUsername"
            :label="$t('pages.system.tenantDatasource.username')"
            width="120"
          />
          <ElTableColumn :label="$t('pages.system.tenantDatasource.isolation')" width="160">
            <template #default="{ row }">
              <!-- schema 策略展示「Schema + schema 名」，列宽按内容预留，避免溢出被裁 -->
              <ElTag :type="row.isolationType === 2 ? 'warning' : 'primary'">
                {{
                  row.isolationType === 2
                    ? $t('pages.system.tenantDatasource.schemaTag', { name: row.schemaName || '' })
                    : $t('pages.system.tenantDatasource.isolatedDb')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.tenantDatasource.status')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.tenantDatasource.enabled')
                    : $t('pages.system.tenantDatasource.disabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="remark"
            :label="$t('pages.system.tenantDatasource.remark')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn
            :label="$t('pages.system.tenantDatasource.actions')"
            width="150"
            fixed="right"
          >
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:tenant-datasource:save'"
                link
                type="primary"
                @click="showEdit(row)"
                >{{ $t('pages.system.tenantDatasource.edit') }}</ElButton
              >
              <ElButton
                v-perm="'sys:tenant-datasource:remove'"
                link
                type="danger"
                @click="remove(row)"
                >{{ $t('pages.system.tenantDatasource.delete') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      :title="
        form.id
          ? $t('pages.system.tenantDatasource.editTitle')
          : $t('pages.system.tenantDatasource.create')
      "
      width="560px"
      align-center
      destroy-on-close
      class="tds-dialog"
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="100px">
        <ElFormItem :label="$t('pages.system.tenantDatasource.tenantCode')" prop="tenantCode">
          <ElInput
            v-model="form.tenantCode"
            :placeholder="$t('pages.system.tenantDatasource.tenantCodePlaceholder')"
            :disabled="!!form.id"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantDatasource.isolation')" prop="isolationType">
          <ElSelect v-model="form.isolationType" style="width: 100%">
            <ElOption :label="$t('pages.system.tenantDatasource.isolationDb')" :value="1" />
            <ElOption :label="$t('pages.system.tenantDatasource.isolationSchema')" :value="2" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          v-if="form.isolationType === 2"
          :label="$t('pages.system.tenantDatasource.schemaName')"
          prop="schemaName"
        >
          <ElInput
            v-model="form.schemaName"
            :placeholder="$t('pages.system.tenantDatasource.schemaNamePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantDatasource.dsUrl')" prop="dsUrl">
          <ElInput v-model="form.dsUrl" placeholder="jdbc:postgresql://host:5432/db" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantDatasource.username')" prop="dsUsername">
          <ElInput
            v-model="form.dsUsername"
            :placeholder="$t('pages.system.tenantDatasource.usernamePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantDatasource.password')" prop="dsPassword">
          <ElInput
            v-model="form.dsPassword"
            type="password"
            show-password
            :placeholder="$t('pages.system.tenantDatasource.passwordPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantDatasource.status')">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.tenantDatasource.remark')">
          <ElInput
            v-model="form.remark"
            type="textarea"
            :placeholder="$t('pages.system.tenantDatasource.remarkPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('pages.system.tenantDatasource.save')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onDeactivated, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { onBeforeRouteLeave } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchTenantDatasourcePage,
    fetchSubmitTenantDatasource,
    fetchRemoveTenantDatasource
  } from '@/api/datasource'

  defineOptions({ name: 'TenantDatasource' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const formRef = ref<FormInstance>()

  const form = reactive<Record<string, any>>({
    id: null,
    tenantCode: '',
    isolationType: 1,
    schemaName: '',
    dsUrl: '',
    dsUsername: '',
    dsPassword: '',
    status: 1,
    remark: ''
  })

  const rules: FormRules = {
    tenantCode: [
      {
        required: true,
        message: t('pages.system.tenantDatasource.tenantCodeRequired'),
        trigger: 'blur'
      }
    ],
    dsUrl: [
      { required: true, message: t('pages.system.tenantDatasource.dsUrlRequired'), trigger: 'blur' }
    ],
    dsUsername: [
      {
        required: true,
        message: t('pages.system.tenantDatasource.usernameRequired'),
        trigger: 'blur'
      }
    ]
  }

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchTenantDatasourcePage({ pageNum: 1, pageSize: 50 })
      tableData.value = resp?.records ?? []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  const showCreate = (): void => {
    Object.assign(form, {
      id: null,
      tenantCode: '',
      isolationType: 1,
      schemaName: '',
      dsUrl: '',
      dsUsername: '',
      dsPassword: '',
      status: 1,
      remark: ''
    })
    dialogVisible.value = true
  }

  const showEdit = (row: any): void => {
    Object.assign(form, {
      id: row.id,
      tenantCode: row.tenantCode,
      isolationType: row.isolationType ?? 1,
      schemaName: row.schemaName ?? '',
      dsUrl: row.dsUrl,
      dsUsername: row.dsUsername,
      dsPassword: '******',
      status: row.status,
      remark: row.remark
    })
    dialogVisible.value = true
  }

  const submit = async (): Promise<void> => {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      dialogSaving.value = true
      try {
        await fetchSubmitTenantDatasource({ ...form })
        ElMessage.success(t('pages.system.tenantDatasource.msgSaved'))
        dialogVisible.value = false
        loadData()
      } finally {
        dialogSaving.value = false
      }
    })
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.tenantDatasource.confirmDelete', { code: row.tenantCode }),
      t('pages.system.tenantDatasource.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchRemoveTenantDatasource(row.id)
        ElMessage.success(t('pages.system.tenantDatasource.msgDeleted'))
        loadData()
      })
      .catch(() => {
        /* cancel */
      })
  }

  const closeOverlays = (): void => {
    dialogVisible.value = false
    ElMessageBox.close()
  }

  onDeactivated(closeOverlays)
  onBeforeRouteLeave(() => {
    closeOverlays()
  })
  onBeforeUnmount(closeOverlays)
</script>

<style scoped>
  /* 卡片体改为纵向 flex，表格滚动区占满剩余高度（滚动区见模板注释） */
  .tds-page :deep(.art-table-card > .el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .tds-toolbar {
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
  }

  .tds-table-wrap {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>

<!-- 弹窗内容 teleport 到 body：选 schema 策略后表单项增多超高时需非 scoped 类限定内部滚动（同 notice-dialog 范式），防矮视口下保存按钮挤出视口 -->
<style>
  .tds-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
