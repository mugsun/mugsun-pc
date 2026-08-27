<!-- 邮件模板新增/编辑弹窗（对接后端 /system/mail-template/submit） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="
      type === 'add'
        ? $t('pages.system.mailTemplate.addBtn')
        : $t('pages.system.mailTemplate.editTitle')
    "
    width="560px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem :label="$t('pages.system.mailTemplate.colCode')" prop="code">
        <ElInput
          v-model="formData.code"
          :disabled="type === 'edit'"
          :placeholder="$t('pages.system.mailTemplate.codePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.mailTemplate.colName')" prop="name">
        <ElInput
          v-model="formData.name"
          :placeholder="$t('pages.system.mailTemplate.namePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.mailTemplate.colSubject')" prop="subject">
        <ElInput
          v-model="formData.subject"
          :placeholder="$t('pages.system.mailTemplate.subjectPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.mailTemplate.contentLabel')" prop="content">
        <ElInput
          v-model="formData.content"
          type="textarea"
          :rows="4"
          :placeholder="
            $t('pages.system.mailTemplate.contentPlaceholder', {
              key: '{key}',
              code: '{code}'
            })
          "
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.mailTemplate.colStatus')">
        <ElSwitch v-model="formData.status" :active-value="1" :inactive-value="0" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton :disabled="saving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleSubmit">{{
          $t('pages.system.mailTemplate.submitBtn')
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
    templateData?: Record<string, any>
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

  const formData = reactive<Record<string, any>>({
    id: undefined,
    code: '',
    name: '',
    subject: '',
    content: '',
    status: 1
  })

  const rules: FormRules = {
    code: [{ required: true, message: t('pages.system.mailTemplate.ruleCode'), trigger: 'blur' }],
    name: [
      {
        required: true,
        message: t('pages.system.mailTemplate.namePlaceholder'),
        trigger: 'blur'
      }
    ],
    subject: [
      {
        required: true,
        message: t('pages.system.mailTemplate.subjectPlaceholder'),
        trigger: 'blur'
      }
    ],
    content: [
      { required: true, message: t('pages.system.mailTemplate.ruleContent'), trigger: 'blur' }
    ]
  }

  watch(
    () => [props.visible, props.templateData],
    ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          { id: undefined, code: '', name: '', subject: '', content: '', status: 1 },
          props.templateData || {}
        )
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (props.saving || !formRef.value) return
    await formRef.value.validate((valid) => {
      if (valid) {
        emit('submit', { ...formData })
      }
    })
  }
</script>
