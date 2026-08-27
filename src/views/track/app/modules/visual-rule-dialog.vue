<!-- 圈选规则编辑弹窗（对接后端 /system/track/visual/rule/submit；
     eventName/routePath/matchText/status 可改，selector 只读——改 selector = 重新圈选） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.track.app.editRuleTitle')"
    width="520px"
    align-center
    destroy-on-close
    class="track-visual-rule-dialog"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElFormItem :label="$t('pages.track.shared.eventName')" prop="eventName">
        <ElInput
          v-model="formData.eventName"
          :placeholder="$t('pages.track.app.eventNamePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.selector')">
        <ElInput :model-value="formData.selector" disabled class="track-visual-selector" />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.routePathLabel')" prop="routePath">
        <ElInput
          v-model="formData.routePath"
          clearable
          :placeholder="$t('pages.track.app.routePathPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.matchText')" prop="matchText">
        <ElInput
          v-model="formData.matchText"
          clearable
          :placeholder="$t('pages.track.app.matchTextPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.shared.enabled')" prop="status">
        <ElSwitch v-model="formData.status" :active-value="1" :inactive-value="0" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" @click="handleSubmit">{{ $t('table.form.submit') }}</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  interface Props {
    visible: boolean
    ruleData?: Record<string, any>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'submit', form: Record<string, any>): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const { t } = useI18n()

  const formRef = ref<FormInstance>()

  const formData = reactive<Record<string, any>>({
    id: undefined,
    eventName: '',
    selector: '',
    routePath: '',
    matchText: '',
    status: 1
  })

  // 与后端 CUSTOM_EVENT_NAME 同正则（$ 前缀必拒，最长 64 位）
  const EVENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

  const rules: FormRules = {
    eventName: [
      { required: true, message: t('pages.track.app.ruleEventNameRequired'), trigger: 'blur' },
      {
        pattern: EVENT_NAME_PATTERN,
        message: t('pages.track.app.ruleEventNamePattern'),
        trigger: 'blur'
      }
    ]
  }

  watch(
    () => [props.visible, props.ruleData],
    ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          { id: undefined, eventName: '', selector: '', routePath: '', matchText: '', status: 1 },
          props.ruleData || {}
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

<style scoped>
  /* 选择器只读展示：等宽字体，输入框本体在 ElInput 子组件内需 :deep() */
  .track-visual-selector :deep(.el-input__inner) {
    font-family: monospace;
    font-size: 12px;
  }
</style>

<!-- 弹窗内容 teleport 到 body，非 scoped 类限定滚动（同 track-app-dialog 范式） -->
<style>
  .track-visual-rule-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
