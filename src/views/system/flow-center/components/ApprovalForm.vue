<!-- 审批业务表单渲染：按字段权限只读/隐藏，支持取值/校验（发起、办理、查看三态复用） -->
<template>
  <FormCreate v-if="hasForm" v-model:api="fApi" :rule="rule" :option="option" />
  <ElEmpty v-else :description="$t('pages.system.flowCenter.noForm')" :image-size="60" />
</template>

<script setup lang="ts">
  import { ref, shallowRef, watch, nextTick } from 'vue'
  import formCreate from '@form-create/element-ui'
  import { useFormCreate } from '@/plugins/form-create'

  type Perm = 'READ' | 'WRITE' | 'NONE'

  const props = defineProps<{
    schema?: string // sys_form.form_schema
    optionJson?: string // sys_form.form_option
    data?: Record<string, any> // 已填数据（instance.variable）
    perms?: Record<string, Perm> // 字段级权限
    readonly?: boolean // 整表单只读（查看态）
  }>()

  // 按需注册 form-create 运行时（随本路由懒加载）
  useFormCreate()

  const fApi = shallowRef<any>()
  const rule = ref<any[]>([])
  const option = ref<Record<string, any>>({})
  const hasForm = ref(false)

  const build = (): void => {
    if (!props.schema) {
      hasForm.value = false
      return
    }
    hasForm.value = true
    rule.value = formCreate.parseJson(props.schema) // 字符串→rule数组，勿用 JSON.parse
    const opt = props.optionJson ? JSON.parse(props.optionJson) : {}
    opt.submitBtn = false // 提交走外层动作按钮
    opt.resetBtn = false
    if (props.readonly) opt.form = { ...(opt.form || {}), disabled: true }
    if (props.data) opt.formData = props.data
    option.value = opt
  }

  const applyPerms = (): void => {
    const api = fApi.value
    if (!api) return
    if (props.data) api.coverValue(props.data) // 只覆盖已有字段值
    Object.entries(props.perms || {}).forEach(([field, p]) => {
      if (p === 'NONE')
        api.hidden(true, field) // 隐藏：不校验不提交
      else if (p === 'READ') api.disabled(true, field) // 只读：值保留
      // WRITE 默认可写，不处理
    })
  }

  watch(fApi, applyPerms)
  watch(
    () => [props.schema, props.data, props.perms],
    async () => {
      build()
      await nextTick()
      applyPerms()
    },
    { immediate: true }
  )

  defineExpose({
    getFormData: (): Record<string, any> => fApi.value?.formData() ?? {},
    validate: (): Promise<any> => fApi.value?.validate()
  })
</script>
