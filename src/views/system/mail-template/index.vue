<!-- 邮件模板管理页面（对接后端 /system/mail-template） -->
<template>
  <div class="mail-template-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 列布局容器：工具栏/分页器固定，表格区 flex:1 + height:100% 内部滚动，
           防卡片体 overflow:hidden 裁掉分页器（同全局 .art-table-card 契约） -->
      <div class="mail-template-body">
        <div class="mt-toolbar">
          <ElButton
            v-perm="'sys:mail-template:save'"
            type="primary"
            @click="showDialog('add')"
            v-ripple
            >{{ $t('pages.system.mailTemplate.addBtn') }}</ElButton
          >
        </div>

        <div class="mt-table-wrap">
          <ElTable v-loading="loading" :data="tableData" border height="100%">
            <ElTableColumn
              type="index"
              :label="$t('pages.system.mailTemplate.colIndex')"
              width="60"
            />
            <ElTableColumn
              prop="code"
              :label="$t('pages.system.mailTemplate.colCode')"
              min-width="140"
            />
            <ElTableColumn
              prop="name"
              :label="$t('pages.system.mailTemplate.colName')"
              min-width="160"
            />
            <ElTableColumn
              prop="subject"
              :label="$t('pages.system.mailTemplate.colSubject')"
              min-width="180"
              show-overflow-tooltip
            />
            <ElTableColumn
              prop="status"
              :label="$t('pages.system.mailTemplate.colStatus')"
              width="90"
            >
              <template #default="{ row }">
                <ElTag :type="row.status === 1 ? 'success' : 'info'">
                  {{
                    row.status === 1
                      ? $t('pages.system.mailTemplate.statusEnabled')
                      : $t('pages.system.mailTemplate.statusDisabled')
                  }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.mailTemplate.colOperation')" width="220">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:mail-template:save'"
                  link
                  type="primary"
                  @click="showDialog('edit', row)"
                  >{{ $t('pages.system.mailTemplate.editBtn') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:mail-template:send'"
                  link
                  type="success"
                  @click="sendTest(row)"
                  >{{ $t('pages.system.mailTemplate.sendTestBtn') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:mail-template:remove'"
                  link
                  type="danger"
                  @click="deleteRow(row)"
                  >{{ $t('pages.system.mailTemplate.deleteBtn') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <div class="mt-pager">
          <ElPagination
            v-model:current-page="pageNum"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            background
            @current-change="loadData"
          />
        </div>
      </div>

      <MailTemplateDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :template-data="currentData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import {
    fetchMailTemplatePage,
    fetchSaveMailTemplate,
    fetchRemoveMailTemplate,
    fetchSendTestMail
  } from '@/api/system-manage'
  import MailTemplateDialog from './modules/mail-template-dialog.vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'MailTemplate' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const currentData = ref<Record<string, any>>({})

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const res = await fetchMailTemplatePage({
        pageNum: pageNum.value,
        pageSize: pageSize.value
      })
      tableData.value = res?.records || []
      total.value = res?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    dialogVisible.value = true
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.mailTemplate.deleteConfirm', { name: row.name }),
      t('pages.system.mailTemplate.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveMailTemplate(row.id)
      ElMessage.success(t('pages.system.mailTemplate.deleteSuccess'))
      loadData()
    })
  }

  const sendTest = async (row: any): Promise<void> => {
    const { value } = await ElMessageBox.prompt(
      t('pages.system.mailTemplate.sendTestPrompt'),
      t('pages.system.mailTemplate.sendTestBtn'),
      {
        confirmButtonText: t('pages.system.mailTemplate.sendBtn'),
        cancelButtonText: t('common.cancel'),
        inputValue: 'demo@mugsun.local',
        inputPattern: /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/,
        inputErrorMessage: t('pages.system.mailTemplate.emailInvalid')
      }
    )
    const content = await fetchSendTestMail({ code: row.code, to: value })
    ElMessageBox.alert(String(content), t('pages.system.mailTemplate.sentTitle'), {
      confirmButtonText: t('pages.system.mailTemplate.gotItBtn')
    })
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveMailTemplate(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.mailTemplate.saveSuccess'))
      loadData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>

<style lang="scss" scoped>
  .mail-template-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .mt-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .mt-toolbar {
    margin-bottom: 12px;
  }

  .mt-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
