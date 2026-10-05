<!-- 单号规则新增/编辑 -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="
      type === 'add'
        ? $t('pages.system.serialNumber.addBtn')
        : $t('pages.system.serialNumber.editTitle')
    "
    width="560px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElFormItem :label="$t('pages.system.serialNumber.colCode')" prop="code">
        <ElInput
          v-model="formData.code"
          :disabled="type === 'edit'"
          :placeholder="$t('pages.system.serialNumber.codePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.serialNumber.colName')" prop="businessName">
        <ElInput
          v-model="formData.businessName"
          maxlength="64"
          :placeholder="$t('pages.system.serialNumber.namePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.serialNumber.colFormat')" prop="format">
        <ElInput
          v-model="formData.format"
          maxlength="64"
          :placeholder="$t('pages.system.serialNumber.formatPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.serialNumber.colRule')" prop="ruleType">
        <ElSelect v-model="formData.ruleType" class="sn-full">
          <ElOption value="none" :label="$t('pages.system.serialNumber.ruleNone')" />
          <ElOption value="year" :label="$t('pages.system.serialNumber.ruleYear')" />
          <ElOption value="month" :label="$t('pages.system.serialNumber.ruleMonth')" />
          <ElOption value="day" :label="$t('pages.system.serialNumber.ruleDay')" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.serialNumber.initLabel')" prop="initNumber">
        <ElInputNumber v-model="formData.initNumber" :min="0" :max="1000000000000" :step="1" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.serialNumber.stepLabel')" prop="stepRandomRange">
        <ElInputNumber v-model="formData.stepRandomRange" :min="1" :max="100" :step="1" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.serialNumber.remarkLabel')">
        <ElInput
          v-model="formData.remark"
          maxlength="255"
          :placeholder="$t('pages.system.serialNumber.remarkPlaceholder')"
        />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton :disabled="saving" @click="dialogVisible = false">{{
        $t('common.cancel')
      }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="handleSubmit">{{
        $t('pages.system.serialNumber.submitBtn')
      }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  interface Props {
    visible: boolean
    type: string
    ruleData?: Record<string, any>
    saving?: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = withDefaults(defineProps<Props>(), { saving: false })
  const emit = defineEmits<Emits>()
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const formData = reactive({
    id: undefined as string | undefined,
    code: '',
    businessName: '',
    format: '',
    ruleType: 'none',
    initNumber: 0,
    stepRandomRange: 1,
    remark: ''
  })

  const rules = computed<FormRules>(() => ({
    code: [
      { required: true, message: t('pages.system.serialNumber.ruleCode'), trigger: 'blur' },
      {
        pattern: /^[A-Za-z][A-Za-z0-9_]{0,63}$/,
        message: t('pages.system.serialNumber.ruleCodeFormat'),
        trigger: 'blur'
      }
    ],
    businessName: [
      { required: true, message: t('pages.system.serialNumber.ruleName'), trigger: 'blur' }
    ],
    format: [
      { required: true, message: t('pages.system.serialNumber.ruleFormat'), trigger: 'blur' }
    ],
    ruleType: [
      { required: true, message: t('pages.system.serialNumber.ruleType'), trigger: 'change' }
    ]
  }))

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  watch(
    () => props.visible,
    (open) => {
      if (!open) return
      const row = props.ruleData || {}
      Object.assign(formData, {
        id: props.type === 'edit' ? row.id : undefined,
        code: row.code || '',
        businessName: row.businessName || '',
        format: row.format || '',
        ruleType: row.ruleType || 'none',
        initNumber: row.initNumber ?? 0,
        stepRandomRange: row.stepRandomRange ?? 1,
        remark: row.remark || ''
      })
      nextTick(() => formRef.value?.clearValidate())
    }
  )

  const handleSubmit = async () => {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    emit('submit', { ...formData })
  }
</script>

<style scoped>
  .sn-full {
    width: 100%;
  }
</style>
