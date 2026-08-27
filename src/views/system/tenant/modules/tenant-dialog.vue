<!-- 租户新增/编辑弹窗（create 一键初始化默认数据；update 仅改信息与套餐分配） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? $t('pages.system.tenant.editTitle') : $t('pages.system.tenant.create')"
    width="500px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
      <ElFormItem :label="$t('pages.system.tenant.tenantName')" prop="tenantName">
        <ElInput
          v-model="formData.tenantName"
          :placeholder="$t('pages.system.tenant.namePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.contactUser')" prop="contactUser">
        <ElInput
          v-model="formData.contactUser"
          :placeholder="$t('pages.system.tenant.contactUserPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.contactPhone')" prop="contactPhone">
        <ElInput
          v-model="formData.contactPhone"
          :placeholder="$t('pages.system.tenant.contactPhonePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.package')" prop="packageId">
        <ElSelect
          v-model="formData.packageId"
          clearable
          :placeholder="$t('pages.system.tenant.noLimitFeature')"
          style="width: 100%"
        >
          <ElOption v-for="p in packages" :key="p.id" :label="p.name" :value="p.id" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.expireTime')" prop="expireTime">
        <ElDatePicker
          v-model="formData.expireTime"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :placeholder="$t('pages.system.tenant.expirePlaceholder')"
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.accountLimit')" prop="accountCount">
        <ElInputNumber v-model="formData.accountCount" :min="-1" :step="1" style="width: 100%" />
        <span class="form-tip">{{ $t('pages.system.tenant.accountTip') }}</span>
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.status')" prop="status">
        <ElRadioGroup v-model="formData.status">
          <ElRadio :value="1">{{ $t('pages.system.tenant.normal') }}</ElRadio>
          <ElRadio :value="0">{{ $t('pages.system.tenant.disabled') }}</ElRadio>
        </ElRadioGroup>
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="handleSubmit">{{
          $t('pages.system.tenant.submit')
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
    row?: Record<string, any> | null
    packages?: any[]
    /** 父级保存进行中（防重复提交） */
    saving?: boolean
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = withDefaults(defineProps<Props>(), { row: null, packages: () => [], saving: false })
  const emit = defineEmits<Emits>()

  const { t } = useI18n()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const isEdit = computed(() => !!props.row?.id)
  const formRef = ref<FormInstance>()

  const formData = reactive<Record<string, any>>({
    id: null,
    tenantName: '',
    contactUser: '',
    contactPhone: '',
    packageId: null,
    expireTime: '',
    accountCount: -1,
    status: 1
  })

  const rules: FormRules = {
    tenantName: [
      { required: true, message: t('pages.system.tenant.namePlaceholder'), trigger: 'blur' }
    ]
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        const r = props.row
        Object.assign(formData, {
          id: r?.id ?? null,
          tenantName: r?.tenantName ?? '',
          contactUser: r?.contactUser ?? '',
          contactPhone: r?.contactPhone ?? '',
          packageId: r?.packageId ?? null,
          expireTime: r?.expireTime ?? '',
          accountCount: r?.accountCount ?? -1,
          status: r?.status ?? 1
        })
        nextTick(() => formRef.value?.clearValidate())
      }
    }
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

<style scoped>
  .form-tip {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
</style>
