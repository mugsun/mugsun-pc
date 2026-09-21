<!-- sourcemap 上传弹窗（G101）：release + 手动选 .map 文件 → multipart 上传；同 release 同名重传覆盖 -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.track.app.uploadSourcemap')"
    width="520px"
    align-center
    destroy-on-close
    @closed="resetState"
  >
    <ElForm label-width="96px">
      <ElFormItem :label="$t('pages.track.app.belongApp')">
        <span>{{ appKey || '-' }}</span>
      </ElFormItem>
      <ElFormItem label="Release" required>
        <ElInput
          v-model="release"
          :placeholder="$t('pages.track.app.releasePlaceholder')"
          maxlength="128"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.fileLabel')" required>
        <ElUpload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".map"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :on-exceed="handleFileExceed"
        >
          <ElButton>{{ $t('pages.track.app.pickFile') }}</ElButton>
          <template #tip>
            <div class="el-upload__tip">{{ $t('pages.track.app.uploadTip') }}</div>
          </template>
        </ElUpload>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="uploading" :disabled="!file" @click="handleUpload">
          {{ $t('pages.track.app.upload') }}
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import type { UploadFile, UploadInstance, UploadRawFile } from 'element-plus'

  interface Props {
    visible: boolean
    appKey: string
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', payload: { release: string; file: File }): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const { t } = useI18n()

  const MAX_BYTES = 20 * 1024 * 1024

  const uploadRef = ref<UploadInstance>()
  const release = ref('')
  const file = ref<File | null>(null)
  const uploading = ref(false)

  // 每次关闭后复位（release/文件/加载态），下次打开是干净表单
  const resetState = (): void => {
    uploadRef.value?.clearFiles()
    release.value = ''
    file.value = null
    uploading.value = false
  }

  /** 前端预检（后缀/大小），服务端校验链仍是最终裁定 */
  const checkFile = (raw: File): boolean => {
    if (!raw.name.endsWith('.map')) {
      ElMessage.warning(t('pages.track.app.onlyMap'))
      return false
    }
    if (raw.size > MAX_BYTES) {
      ElMessage.warning(t('pages.track.app.fileTooLarge'))
      return false
    }
    return true
  }

  const handleFileChange = (uploadFile: UploadFile): void => {
    const raw = uploadFile.raw
    if (!raw || !checkFile(raw)) {
      uploadRef.value?.clearFiles()
      file.value = null
      return
    }
    file.value = raw
  }

  const handleFileRemove = (): void => {
    file.value = null
  }

  // 超出 limit 时替换为新选文件（避免「得先删再选」的两步操作）
  const handleFileExceed = (files: File[]): void => {
    uploadRef.value?.clearFiles()
    const raw = files[0] as UploadRawFile
    if (!checkFile(raw)) return
    uploadRef.value?.handleStart(raw)
    file.value = raw
  }

  const handleUpload = async (): Promise<void> => {
    if (!file.value || uploading.value) return
    if (!release.value.trim()) {
      ElMessage.warning(t('pages.track.app.releaseRequired'))
      return
    }
    uploading.value = true
    try {
      emit('submit', { release: release.value.trim(), file: file.value })
    } finally {
      // 父组件提交完成后负责关窗（复位由 @closed 兜底）；失败时仅解除加载态
      uploading.value = false
    }
  }
</script>
