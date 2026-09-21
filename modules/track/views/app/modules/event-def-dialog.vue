<!-- 事件定义编辑弹窗（对接后端 /system/track/event-def/submit；仅显示名/描述/负责人/状态可改） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('pages.track.app.editDefTitle')"
    width="520px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" label-width="96px">
      <ElFormItem :label="$t('pages.track.shared.eventName')">
        <ElInput :model-value="formData.eventName" disabled />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.displayName')" prop="displayName">
        <ElInput
          v-model="formData.displayName"
          :placeholder="$t('pages.track.app.displayNamePlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.description')" prop="description">
        <ElInput
          v-model="formData.description"
          type="textarea"
          :rows="3"
          :placeholder="$t('pages.track.app.descriptionPlaceholder')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.track.app.owner')" prop="owner">
        <ElInput v-model="formData.owner" :placeholder="$t('pages.track.app.ownerPlaceholder')" />
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
  interface Props {
    visible: boolean
    defData?: Record<string, any>
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

  const formData = reactive<Record<string, any>>({
    id: undefined,
    eventName: '',
    displayName: '',
    description: '',
    owner: '',
    status: 1
  })

  watch(
    () => [props.visible, props.defData],
    ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          { id: undefined, eventName: '', displayName: '', description: '', owner: '', status: 1 },
          props.defData || {}
        )
      }
    },
    { immediate: true }
  )

  const handleSubmit = () => {
    emit('submit', { ...formData })
  }
</script>
