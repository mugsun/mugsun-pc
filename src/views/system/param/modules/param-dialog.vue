<!-- 参数新增/编辑弹窗（对接后端 /system/param/submit） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? $t('pages.system.param.addParam') : $t('pages.system.param.editParam')"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem :label="$t('pages.system.param.fields.paramName')" prop="paramName">
        <ElInput
          v-model="formData.paramName"
          :placeholder="$t('pages.system.param.placeholder.paramName')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.param.fields.paramKey')" prop="paramKey">
        <ElInput
          v-model="formData.paramKey"
          :placeholder="$t('pages.system.param.placeholder.paramKey')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.param.fields.paramValue')" prop="paramValue">
        <ElInput
          v-model="formData.paramValue"
          :placeholder="$t('pages.system.param.placeholder.paramValue')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.param.fields.remark')" prop="remark">
        <ElInput
          v-model="formData.remark"
          type="textarea"
          :placeholder="$t('pages.system.param.placeholder.remark')"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton :disabled="saving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleSubmit">{{
          $t('table.form.submit')
        }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
    type: string
    paramData?: Record<string, any>
    saving?: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const formRef = ref<FormInstance>()

  const formData = reactive<Record<string, any>>({
    id: undefined,
    paramName: '',
    paramKey: '',
    paramValue: '',
    remark: ''
  })

  const rules = computed<FormRules>(() => ({
    paramName: [
      { required: true, message: t('pages.system.param.placeholder.paramName'), trigger: 'blur' }
    ],
    paramKey: [
      { required: true, message: t('pages.system.param.placeholder.paramKey'), trigger: 'blur' }
    ]
  }))

  watch(
    () => [props.visible, props.paramData],
    ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          { id: undefined, paramName: '', paramKey: '', paramValue: '', remark: '' },
          props.paramData || {}
        )
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    await formRef.value.validate((valid) => {
      if (valid) {
        emit('submit', { ...formData })
      }
    })
  }
</script>
