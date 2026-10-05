<!-- 全局意见反馈弹窗：任意页面经顶栏用户菜单触发，支持附件上传 -->
<template>
  <ElDialog v-model="visible" :title="$t('components.feedbackDialog.title')" width="520px">
    <ElForm :model="form" label-width="80px">
      <ElFormItem :label="$t('components.feedbackDialog.contentLabel')" required>
        <ElInput
          v-model="form.content"
          type="textarea"
          :rows="5"
          maxlength="2000"
          show-word-limit
          :placeholder="$t('components.feedbackDialog.contentPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('components.feedbackDialog.contactLabel')">
        <ElInput
          v-model="form.contact"
          maxlength="64"
          :placeholder="$t('components.feedbackDialog.contactPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('components.feedbackDialog.attachLabel')">
        <ElUpload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept="image/*"
          :on-change="handleFileChange"
          :on-remove="handleRemove"
          :on-exceed="handleExceed"
        >
          <ElButton :loading="uploading">{{
            $t('components.feedbackDialog.selectImage')
          }}</ElButton>
          <template #tip>
            <span class="upload-tip">{{ $t('components.feedbackDialog.uploadTip') }}</span>
          </template>
        </ElUpload>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="visible = false">{{ $t('common.cancel') }}</ElButton>
      <ElButton type="primary" :loading="submitting" @click="submit">{{
        $t('components.feedbackDialog.submit')
      }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { reactive } from 'vue'
  import { ElMessage, type UploadFile, type UploadInstance } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { mittBus } from '@/utils/sys'
  import { uploadFeedbackFile, submitFeedback } from '@/api/feedback'

  defineOptions({ name: 'ArtFeedbackDialog' })

  const { t } = useI18n()

  const visible = ref(false)
  const uploading = ref(false)
  const submitting = ref(false)
  const uploadRef = ref<UploadInstance>()
  const form = reactive<any>({
    content: '',
    contact: '',
    attachId: null,
    attachName: '',
    attachUrl: ''
  })

  const reset = () => {
    Object.assign(form, { content: '', contact: '', attachId: null, attachName: '', attachUrl: '' })
  }

  const open = () => {
    reset()
    visible.value = true
  }

  // 选择文件后立即上传，回填附件引用
  const handleFileChange = async (uploadFile: UploadFile) => {
    if (!uploadFile.raw) return
    // 类型与大小校验：仅图片、≤5MB
    if (!uploadFile.raw.type.startsWith('image/')) {
      ElMessage.warning(t('components.feedbackDialog.imageOnlyWarning'))
      uploadRef.value?.clearFiles()
      handleRemove()
      return
    }
    if (uploadFile.raw.size > 5 * 1024 * 1024) {
      ElMessage.warning(t('components.feedbackDialog.sizeExceededWarning'))
      uploadRef.value?.clearFiles()
      handleRemove()
      return
    }
    uploading.value = true
    try {
      const attach = await uploadFeedbackFile(uploadFile.raw)
      form.attachId = attach?.id
      form.attachName = attach?.name
      form.attachUrl = attach?.url
    } catch {
      ElMessage.error(t('components.feedbackDialog.uploadFailed'))
    } finally {
      uploading.value = false
    }
  }

  const handleRemove = () => {
    form.attachId = null
    form.attachName = ''
    form.attachUrl = ''
  }

  const handleExceed = () => {
    ElMessage.warning(t('components.feedbackDialog.singleAttachmentWarning'))
  }

  const submit = async () => {
    if (!form.content?.trim())
      return ElMessage.warning(t('components.feedbackDialog.contentRequired'))
    submitting.value = true
    try {
      await submitFeedback({ ...form })
      visible.value = false
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => mittBus.on('openFeedback', open))
  onUnmounted(() => mittBus.off('openFeedback', open))
</script>

<style lang="scss" scoped>
  .upload-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
