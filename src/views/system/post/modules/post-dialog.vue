<!-- 岗位新增/编辑弹窗（对接后端 /system/post/submit） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? $t('pages.system.post.addPost') : $t('pages.system.post.editPost')"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem :label="$t('pages.system.post.fields.postName')" prop="postName">
        <ElInput
          v-model="formData.postName"
          :placeholder="$t('pages.system.post.placeholder.postName')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.post.fields.postCode')" prop="postCode">
        <ElInput
          v-model="formData.postCode"
          :placeholder="$t('pages.system.post.placeholder.postCode')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.post.fields.category')" prop="category">
        <ElSelect
          v-model="formData.category"
          :placeholder="$t('pages.system.post.placeholder.category')"
          style="width: 100%"
        >
          <ElOption :label="$t('pages.system.post.categoryManage')" value="manage" />
          <ElOption :label="$t('pages.system.post.categoryTech')" value="tech" />
          <ElOption :label="$t('pages.system.post.categoryBiz')" value="biz" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.post.fields.sort')" prop="sort">
        <ElInputNumber v-model="formData.sort" :min="0" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
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
    postData?: Record<string, any>
    /** 父级保存进行中（防重复提交） */
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
    postName: '',
    postCode: '',
    category: 'manage',
    sort: 0
  })

  const rules = computed<FormRules>(() => ({
    postName: [
      { required: true, message: t('pages.system.post.placeholder.postName'), trigger: 'blur' }
    ],
    postCode: [
      { required: true, message: t('pages.system.post.placeholder.postCode'), trigger: 'blur' }
    ],
    category: [
      { required: true, message: t('pages.system.post.placeholder.category'), trigger: 'change' }
    ]
  }))

  watch(
    () => [props.visible, props.postData],
    ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          { id: undefined, postName: '', postCode: '', category: 'manage', sort: 0 },
          props.postData || {}
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
