<!-- 用户导入弹窗：模板下载 + 覆盖开关 + 上传 + 结构化结果（成败计数/失败明细/明细下载） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.system.user.importDialog.title')"
    width="620px"
    align-center
    @closed="resetState"
  >
    <div class="import-tips">
      <span>{{ $t('pages.system.user.importDialog.tips') }}</span>
      <ElButton link type="primary" @click="downloadUserImportTemplate()">{{
        $t('pages.system.user.importDialog.downloadTemplate')
      }}</ElButton>
    </div>
    <ElCheckbox v-model="updateSupport">
      {{ $t('pages.system.user.importDialog.overwrite') }}
    </ElCheckbox>
    <ElUpload
      ref="uploadRef"
      drag
      :auto-upload="false"
      :limit="1"
      accept=".xlsx,.xls"
      :on-change="handleFileChange"
      :on-remove="handleFileRemove"
      :on-exceed="handleFileExceed"
      style="margin-top: 12px"
    >
      <ElIcon class="el-icon--upload"><UploadFilled /></ElIcon>
      <div class="el-upload__text">
        {{ $t('pages.system.user.importDialog.uploadText')
        }}<em>{{ $t('pages.system.user.importDialog.uploadLink') }}</em>
      </div>
    </ElUpload>

    <!-- 导入结果：成败计数 + 失败明细 -->
    <div v-if="result" class="import-result">
      <ElAlert
        :type="result.failCount > 0 ? 'warning' : 'success'"
        :closable="false"
        :title="
          $t('pages.system.user.importDialog.resultTitle', {
            success: result.successCount,
            fail: result.failCount
          })
        "
      />
      <template v-if="result.failList.length > 0">
        <div class="fail-header">
          <span>{{ $t('pages.system.user.importDialog.failDetail') }}</span>
          <ElButton link type="primary" @click="downloadFailList">{{
            $t('pages.system.user.importDialog.downloadFailList')
          }}</ElButton>
        </div>
        <ElTable :data="result.failList" border size="small" max-height="240">
          <ElTableColumn
            prop="rowIndex"
            :label="$t('pages.system.user.importDialog.rowIndex')"
            width="80"
          />
          <ElTableColumn
            prop="username"
            :label="$t('pages.system.user.fields.username')"
            min-width="120"
            show-overflow-tooltip
          />
          <ElTableColumn
            prop="reason"
            :label="$t('pages.system.user.importDialog.reason')"
            min-width="180"
            show-overflow-tooltip
          />
        </ElTable>
      </template>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{
          $t('pages.system.user.importDialog.close')
        }}</ElButton>
        <ElButton type="primary" :loading="importing" :disabled="!file" @click="handleImport">
          {{ $t('pages.system.user.importDialog.startImport') }}
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import FileSaver from 'file-saver'
  import { useI18n } from 'vue-i18n'
  import { UploadFilled } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import type { UploadFile, UploadInstance, UploadRawFile } from 'element-plus'
  import { downloadUserImportTemplate, importUser } from '@/api/user'
  import type { UserImportResult } from '@/api/user/type'

  interface Props {
    visible: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const uploadRef = ref<UploadInstance>()
  const updateSupport = ref(false)
  const file = ref<File | null>(null)
  const importing = ref(false)
  const result = ref<UserImportResult | null>(null)

  // 每次关闭后复位（文件/结果/开关），下次打开是干净表单
  const resetState = (): void => {
    uploadRef.value?.clearFiles()
    file.value = null
    result.value = null
    updateSupport.value = false
    importing.value = false
  }

  const handleFileChange = (uploadFile: UploadFile): void => {
    file.value = uploadFile.raw ?? null
    result.value = null
  }

  const handleFileRemove = (): void => {
    file.value = null
  }

  // 超出 limit 时替换为新选文件（避免「得先删再选」的两步操作）
  const handleFileExceed = (files: File[]): void => {
    uploadRef.value?.clearFiles()
    const raw = files[0] as UploadRawFile
    uploadRef.value?.handleStart(raw)
    file.value = raw
    result.value = null
  }

  const handleImport = async (): Promise<void> => {
    if (!file.value || importing.value) return
    importing.value = true
    try {
      const data = await importUser(file.value, updateSupport.value)
      result.value = data ?? { successCount: 0, failCount: 0, failList: [] }
      if (result.value.failCount === 0) {
        ElMessage.success(
          t('pages.system.user.importDialog.importSuccess', { count: result.value.successCount })
        )
      }
      // 有成功写入即刷新列表（含部分成功）
      if (result.value.successCount > 0) {
        emit('success')
      }
    } finally {
      importing.value = false
    }
  }

  // 失败明细前端生成 CSV（不引入已停更且有 CVE 的 xlsx）
  const downloadFailList = (): void => {
    if (!result.value?.failList.length) return
    const header = [
      t('pages.system.user.importDialog.rowIndex'),
      t('pages.system.user.fields.username'),
      t('pages.system.user.importDialog.reason')
    ]
    const lines = [
      header.join(','),
      ...result.value.failList.map((f) => [f.rowIndex, f.username, f.reason].map(csvCell).join(','))
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    FileSaver.saveAs(blob, '用户导入失败明细.csv')
  }

  const csvCell = (value: string | number | undefined): string => {
    const text = String(value ?? '')
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }
</script>

<style scoped>
  .import-tips {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    color: var(--el-text-color-secondary);
  }

  .import-result {
    margin-top: 16px;
  }

  .fail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 12px 0 8px;
  }
</style>
