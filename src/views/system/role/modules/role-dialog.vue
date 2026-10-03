<!-- 角色新增/编辑弹窗（对接后端 /system/role/submit） -->
<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? $t('pages.system.role.addRole') : $t('pages.system.role.editRole')"
    width="500px"
    align-center
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <ElFormItem :label="$t('pages.system.role.fields.roleName')" prop="roleName">
        <ElInput
          v-model="formData.roleName"
          :placeholder="$t('pages.system.role.placeholder.roleName')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.role.fields.roleCode')" prop="roleCode">
        <ElInput
          v-model="formData.roleCode"
          :placeholder="$t('pages.system.role.placeholder.roleCode')"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.role.fields.dataScope')" prop="dataScope">
        <ElSelect v-model="formData.dataScope" style="width: 100%">
          <ElOption :label="$t('pages.system.role.scope.all')" :value="1" />
          <ElOption :label="$t('pages.system.role.scope.dept')" :value="2" />
          <ElOption :label="$t('pages.system.role.scope.deptAndChildren')" :value="3" />
          <ElOption :label="$t('pages.system.role.scope.self')" :value="4" />
          <ElOption :label="$t('pages.system.role.scope.custom')" :value="5" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem
        v-if="formData.dataScope === 5"
        :label="$t('pages.system.role.fields.deptIds')"
        prop="deptIds"
      >
        <ElTreeSelect
          v-model="formData.deptIds"
          :data="deptTree"
          multiple
          show-checkbox
          check-strictly
          node-key="id"
          :props="{ label: 'deptName', children: 'children' }"
          :render-after-expand="false"
          :placeholder="$t('pages.system.role.placeholder.deptIds')"
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem :label="$t('pages.system.role.fields.sort')" prop="sort">
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
  import { fetchDeptOptions } from '@/api/system-manage'
  import { fetchRoleDeptIds } from '@/api/role'

  interface Props {
    visible: boolean
    type: string
    roleData?: Record<string, any>
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
  const deptTree = ref<any[]>([])

  const formData = reactive<Record<string, any>>({
    id: undefined,
    roleName: '',
    roleCode: '',
    dataScope: 1,
    deptIds: [],
    sort: 0
  })

  const rules = computed<FormRules>(() => ({
    roleName: [
      { required: true, message: t('pages.system.role.placeholder.roleName'), trigger: 'blur' }
    ],
    roleCode: [
      { required: true, message: t('pages.system.role.placeholder.roleCode'), trigger: 'blur' }
    ]
  }))

  const loadDeptTree = async () => {
    if (!deptTree.value.length) {
      deptTree.value = (await fetchDeptOptions()) || []
    }
  }

  watch(
    () => [props.visible, props.roleData],
    async ([visible]) => {
      if (visible) {
        Object.assign(
          formData,
          { id: undefined, roleName: '', roleCode: '', dataScope: 1, deptIds: [], sort: 0 },
          props.roleData || {}
        )
        loadDeptTree()
        // 编辑态且为自定义部门：回显已配置的可见部门
        if (formData.id && formData.dataScope === 5) {
          formData.deptIds = (await fetchRoleDeptIds(formData.id)) || []
        } else {
          formData.deptIds = []
        }
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    await formRef.value.validate((valid) => {
      if (valid) {
        // 非自定义部门不下发 deptIds（后端据 dataScope 清理）
        const payload = { ...formData }
        if (payload.dataScope !== 5) payload.deptIds = []
        emit('submit', payload)
      }
    })
  }
</script>
