<!-- 对象存储配置页面（对接后端 /system/oss，启用渠道运行时切换） -->
<template>
  <div class="oss-page art-full-height">
    <ElCard class="art-table-card">
      <div class="oss-toolbar">
        <ElButton v-perm="'sys:oss:save'" @click="showDialog('add')" v-ripple>{{
          $t('pages.system.oss.addBtn')
        }}</ElButton>
      </div>

      <div class="oss-table-scroll">
        <ElTable :data="tableData" border v-loading="loading">
          <ElTableColumn type="index" :label="$t('pages.system.oss.colIndex')" width="60" />
          <ElTableColumn
            prop="name"
            :label="$t('pages.system.oss.colName')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="ossCode"
            :label="$t('pages.system.oss.colCode')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn prop="category" :label="$t('pages.system.oss.colCategory')" width="100" />
          <ElTableColumn
            prop="storagePath"
            :label="$t('pages.system.oss.colPath')"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">{{ row.storagePath || row.domain || '-' }}</template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.oss.colStatus')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.oss.statusEnabled')
                    : $t('pages.system.oss.statusDisabled')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('pages.system.oss.colOperation')" width="220">
            <template #default="{ row }">
              <!-- 启用互斥切换：已启用行提供「禁用」（走 submit 全量更新 status），未启用行提供「启用」 -->
              <ElButton
                v-if="row.status === 1"
                v-perm="'sys:oss:edit'"
                link
                type="warning"
                @click="disableRow(row)"
              >
                {{ $t('pages.system.oss.statusDisabled') }}
              </ElButton>
              <ElButton v-else v-perm="'sys:oss:edit'" link type="primary" @click="enableRow(row)">
                {{ $t('pages.system.oss.statusEnabled') }}
              </ElButton>
              <ElButton
                v-perm="'sys:oss:save'"
                link
                type="primary"
                @click="showDialog('edit', row)"
                >{{ $t('pages.system.oss.editBtn') }}</ElButton
              >
              <ElButton v-perm="'sys:oss:remove'" link type="danger" @click="deleteRow(row)">{{
                $t('pages.system.oss.deleteBtn')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>

      <OssDialog
        v-if="dialogVisible"
        v-model:visible="dialogVisible"
        :type="dialogType"
        :oss-data="currentData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onDeactivated } from 'vue'
  import { fetchOssPage, fetchSaveOss, fetchRemoveOss, fetchEnableOss } from '@/api/system-manage'
  import OssDialog from './modules/oss-dialog.vue'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Oss' })

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
      const resp = await fetchOssPage({ pageNum: 1, pageSize: 50 })
      tableData.value = resp?.records ?? []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  // KeepAlive 切走 Tab 时关闭弹窗，避免 ElDialog teleport 到 body 后遮挡其他页
  onDeactivated(() => {
    dialogVisible.value = false
  })

  const showDialog = (type: DialogType, row?: Record<string, any>): void => {
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    dialogVisible.value = true
  }

  const enableRow = async (row: any): Promise<void> => {
    await fetchEnableOss(row.id)
    ElMessage.success(t('pages.system.oss.enableSuccess'))
    loadData()
  }

  // 后端无独立禁用端点：submit 按 id 全量更新，置 status=0 即禁用
  // 禁用后新附件将无法写入该渠道，属危险操作，须二次确认（启用无风险直接执行）
  const disableRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.oss.disableConfirm', { name: row.name }),
      t('pages.system.oss.disableTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchSaveOss({ ...row, status: 0 })
      ElMessage.success(t('pages.system.oss.disableSuccess'))
      loadData()
    })
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.oss.deleteConfirm', { name: row.name }),
      t('pages.system.oss.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveOss(row.id)
      ElMessage.success(t('pages.system.oss.deleteSuccess'))
      loadData()
    })
  }

  const handleDialogSubmit = async (form: Record<string, any>): Promise<void> => {
    dialogSaving.value = true
    try {
      await fetchSaveOss(form)
      dialogVisible.value = false
      ElMessage.success(t('pages.system.oss.saveSuccess'))
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

  .oss-toolbar {
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  .oss-table-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
