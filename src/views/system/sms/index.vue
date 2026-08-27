<!-- 短信平台配置页面（对接后端 /system/sms，启用渠道运行时切换） -->
<template>
  <div class="sms-page art-full-height">
    <ElCard class="art-table-card">
      <div class="sms-toolbar">
        <ElButton v-perm="'sys:sms:save'" @click="showDialog('add')" v-ripple>{{
          $t('pages.system.sms.addBtn')
        }}</ElButton>
      </div>

      <div class="sms-table-scroll">
        <ElTable :data="tableData" border v-loading="loading">
          <ElTableColumn type="index" :label="$t('pages.system.sms.colIndex')" width="60" />
          <ElTableColumn
            prop="name"
            :label="$t('pages.system.sms.colName')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="smsCode"
            :label="$t('pages.system.sms.colCode')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn prop="category" :label="$t('pages.system.sms.colCategory')" width="110" />
          <ElTableColumn
            prop="signature"
            :label="$t('pages.system.sms.colSignature')"
            min-width="120"
          />
          <ElTableColumn
            prop="templateId"
            :label="$t('pages.system.sms.colTemplate')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn :label="$t('pages.system.sms.colStatus')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.sms.statusEnabled')
                    : $t('pages.system.sms.statusDisabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.sms.colOperation')" width="220">
            <template #default="{ row }">
              <!-- 启用互斥切换：已启用行提供「禁用」（走 submit 全量更新 status），未启用行提供「启用」 -->
              <ElButton
                v-if="row.status === 1"
                v-perm="'sys:sms:edit'"
                link
                type="warning"
                @click="disableRow(row)"
              >
                {{ $t('pages.system.sms.statusDisabled') }}
              </ElButton>
              <ElButton v-else v-perm="'sys:sms:edit'" link type="primary" @click="enableRow(row)">
                {{ $t('pages.system.sms.statusEnabled') }}
              </ElButton>
              <ElButton
                v-perm="'sys:sms:save'"
                link
                type="primary"
                @click="showDialog('edit', row)"
                >{{ $t('pages.system.sms.editBtn') }}</ElButton
              >
              <ElButton v-perm="'sys:sms:remove'" link type="danger" @click="deleteRow(row)">{{
                $t('pages.system.sms.deleteBtn')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <SmsDialog
        v-if="dialogVisible"
        v-model:visible="dialogVisible"
        :type="dialogType"
        :sms-data="currentData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onDeactivated } from 'vue'
  import { fetchSmsPage, fetchSaveSms, fetchRemoveSms, fetchEnableSms } from '@/api/system-manage'
  import SmsDialog from './modules/sms-dialog.vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Sms' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const currentData = ref<Record<string, any>>({})

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchSmsPage({ pageNum: 1, pageSize: 50 })
      tableData.value = resp?.records ?? []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  onDeactivated(() => {
    dialogVisible.value = false
  })

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    dialogVisible.value = true
  }

  const enableRow = async (row: any): Promise<void> => {
    await fetchEnableSms(row.id)
    ElMessage.success(t('pages.system.sms.enableSuccess'))
    loadData()
  }

  // 后端无独立禁用端点：submit 按 id 全量更新，置 status=0 即禁用
  // 禁用后短信发送将不可用，属危险操作，须二次确认（启用无风险直接执行）
  const disableRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.sms.disableConfirm', { name: row.name }),
      t('pages.system.sms.disableTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchSaveSms({ ...row, status: 0 })
      ElMessage.success(t('pages.system.sms.disableSuccess'))
      loadData()
    })
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.sms.deleteConfirm', { name: row.name }),
      t('pages.system.sms.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveSms(row.id)
      ElMessage.success(t('pages.system.sms.deleteSuccess'))
      loadData()
    })
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveSms(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.sms.saveSuccess'))
      loadData()
    } finally {
      dialogSaving.value = false
    }
  }
</script>

<style scoped>
  /* 表格为自由增长内容：.art-table-card 定高 + .el-card__body 裁剪，
     须自备内部滚动，否则矮视口多行时底部行被切断不可达（范式同 monitor/track-user） */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .sms-toolbar {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .sms-table-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
