<!-- 存储配置新增/编辑弹窗（对接后端 /system/oss/submit） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? $t('pages.system.oss.addBtn') : $t('pages.system.oss.editTitle')"
    width="520px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem :label="$t('pages.system.oss.colName')" prop="name">
        <ElInput v-model="formData.name" :placeholder="$t('pages.system.oss.namePlaceholder')" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.oss.colCode')" prop="ossCode">
        <ElInput v-model="formData.ossCode" :placeholder="$t('pages.system.oss.codePlaceholder')" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.oss.colCategory')" prop="category">
        <ElSelect v-model="formData.category" style="width: 100%">
          <ElOption :label="$t('pages.system.oss.categoryLocal')" value="local" />
          <ElOption label="MinIO" value="minio" />
          <ElOption :label="$t('pages.system.oss.categoryAliyun')" value="aliyun" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem
        v-if="formData.category === 'local'"
        :label="$t('pages.system.oss.pathLabel')"
        prop="storagePath"
      >
        <ElInput
          v-model="formData.storagePath"
          :placeholder="$t('pages.system.oss.pathPlaceholder')"
        />
      </ElFormItem>
      <template v-else>
        <ElFormItem label="Endpoint">
          <ElInput
            v-model="formData.endpoint"
            :placeholder="$t('pages.system.oss.endpointPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem label="Bucket">
          <ElInput
            v-model="formData.bucketName"
            :placeholder="$t('pages.system.oss.bucketPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem label="AccessKey">
          <ElInput
            v-model="formData.accessKey"
            :placeholder="$t('pages.system.oss.accessKeyPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem label="SecretKey">
          <ElInput
            v-model="formData.secretKey"
            :placeholder="
              type === 'edit'
                ? $t('pages.system.oss.secretEditPlaceholder')
                : $t('pages.system.oss.secretPlaceholder')
            "
            show-password
          />
        </ElFormItem>
      </template>
      <ElFormItem :label="$t('pages.system.oss.domainLabel')">
        <ElInput
          v-model="formData.domain"
          :placeholder="$t('pages.system.oss.domainPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.oss.remarkLabel')">
        <ElInput
          v-model="formData.remark"
          type="textarea"
          :placeholder="$t('pages.system.oss.remarkLabel')"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton :disabled="saving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleSubmit">{{
          $t('pages.system.oss.submitBtn')
        }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  interface Props {
    visible: boolean
    type: string
    ossData?: Record<string, any>
    saving?: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = withDefaults(defineProps<Props>(), { saving: false })
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const formRef = ref<FormInstance>()

  const defaults = (): Record<string, any> => ({
    id: undefined,
    name: '',
    ossCode: '',
    category: 'local',
    endpoint: '',
    accessKey: '',
    secretKey: '',
    bucketName: '',
    domain: '',
    storagePath: '',
    remark: ''
  })

  const formData = reactive<Record<string, any>>(defaults())

  const rules: FormRules = {
    name: [{ required: true, message: t('pages.system.oss.namePlaceholder'), trigger: 'blur' }],
    ossCode: [{ required: true, message: t('pages.system.oss.ruleCode'), trigger: 'blur' }],
    category: [{ required: true, message: t('pages.system.oss.ruleCategory'), trigger: 'change' }]
  }

  watch(
    () => [props.visible, props.ossData],
    ([visible]) => {
      if (visible) {
        Object.assign(formData, defaults(), props.ossData || {})
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value || props.saving) return
    const valid = await formRef.value.validate().catch(() => false)
    if (valid) {
      emit('submit', { ...formData })
    }
  }
</script>
