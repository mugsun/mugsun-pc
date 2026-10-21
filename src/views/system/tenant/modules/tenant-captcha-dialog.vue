<!-- 租户验证码设置：开关 + 启用题型（仅平台超管，后端鉴权）；保存响应 data.warning 原样展示 -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.system.tenant.captchaTitle', { name: row?.tenantName || '' })"
    :width="narrow ? '92%' : '560px'"
    align-center
    destroy-on-close
  >
    <ElForm label-width="auto" :label-position="narrow ? 'top' : 'right'">
      <ElFormItem :label="$t('pages.system.tenant.captchaEnabled')">
        <ElSwitch v-model="enabled" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.tenant.captchaTypes')">
        <div class="flex flex-col gap-1">
          <ElCheckboxGroup v-model="types" :disabled="!enabled">
            <ElCheckbox v-for="tp in TENANT_CAPTCHA_TYPES" :key="tp" :value="tp">
              {{ $t(`pages.system.tenant.captchaType${tp}`) }}
            </ElCheckbox>
          </ElCheckboxGroup>
          <span class="text-xs text-g-500">{{ $t('pages.system.tenant.captchaTypesHint') }}</span>
          <span class="text-xs text-g-500" data-testid="captcha-rotate-note">{{
            $t('pages.system.tenant.captchaRotateNote')
          }}</span>
          <span class="text-xs text-g-500">{{ $t('pages.system.tenant.captchaLangNote') }}</span>
        </div>
      </ElFormItem>
    </ElForm>
    <ElAlert
      v-if="warning"
      data-testid="captcha-warning"
      type="warning"
      :title="$t('pages.system.tenant.captchaWarningTitle')"
      :description="warning"
      :closable="false"
      show-icon
    />
    <template #footer>
      <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
      <ElButton type="primary" :loading="saving" @click="save">{{
        $t('pages.system.tenant.submit')
      }}</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useWindowSize } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { fetchTenantCaptcha } from '@/api/system-manage'
  import {
    TENANT_CAPTCHA_TYPES,
    parseTenantCaptchaTypes,
    tenantCaptchaWarning
  } from '@/utils/captcha/tenantTypes'

  defineOptions({ name: 'TenantCaptchaDialog' })

  const props = defineProps<{ visible: boolean; row: Record<string, any> | null }>()
  const emit = defineEmits<{ 'update:visible': [boolean]; saved: [] }>()
  const { t } = useI18n()
  // 窄屏（≤768px，同 utils/form/responsive 的 xs 断点）标签放到上方
  const { width: winWidth } = useWindowSize()
  const narrow = computed(() => winWidth.value <= 768)

  const dialogVisible = computed({
    get: () => props.visible,
    set: (v) => emit('update:visible', v)
  })
  const enabled = ref(true)
  const types = ref<string[]>([])
  const warning = ref('')
  const saving = ref(false)

  watch(
    () => [props.visible, props.row] as const,
    ([v, row]) => {
      if (!v || !row) return
      enabled.value = row.captchaEnabled !== 0
      types.value = parseTenantCaptchaTypes(row.captchaTypes)
      warning.value = ''
    },
    { immediate: true }
  )

  async function save() {
    if (!props.row) return
    saving.value = true
    try {
      const data = await fetchTenantCaptcha({
        id: props.row.id,
        enabled: enabled.value,
        types: TENANT_CAPTCHA_TYPES.filter((tp) => types.value.includes(tp))
      })
      emit('saved')
      warning.value = tenantCaptchaWarning(data)
      if (warning.value) return // 留在弹窗里让管理员看到后端提示
      ElMessage.success(t('pages.system.tenant.captchaSaved'))
      dialogVisible.value = false
    } finally {
      saving.value = false
    }
  }
</script>
