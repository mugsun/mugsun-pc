<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar"
        ><ElButton type="primary" @click="openEdit()">{{ $t('aiSecret.add') }}</ElButton></div
      >
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        :empty-text="$t('aiSecret.empty')"
        @pagination:size-change="
          (s: number) => {
            pageSize = s
            reload()
          }
        "
        @pagination:current-change="
          (p: number) => {
            pageNum = p
            reload()
          }
        "
      />
    </ElCard>
    <ElDialog
      v-model="visible"
      :title="form.id ? $t('aiForm.editSecret') : $t('aiForm.newSecret')"
      width="560px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem
          :label="$t('aiForm.secretDesc')"
          prop="description"
          :rules="requiredRule($t('aiForm.secretDesc'))"
          ><ElInput v-model="form.description"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.scope')">
          <ElSelect v-model="form.scopeType" style="width: 100%">
            <ElOption :label="$t('aiForm.optTenant')" value="tenant" /><ElOption
              :label="$t('aiForm.optUser')"
              value="user"
            /><ElOption :label="$t('aiForm.optApp')" value="app" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.rateLimit')"
          ><ElInputNumber v-model="form.rateLimit" :min="0"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.allowIps')"
          ><ElInput v-model="form.allowIps" :placeholder="$t('aiForm.phCidr')"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.expireAt')"
          ><ElDatePicker
            v-model="form.expireTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance } from 'element-plus'
  import { requiredRule } from '../shared/formRules'
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref, nextTick } from 'vue'
  import { ElButton, ElMessageBox, ElSwitch } from 'element-plus'
  import {
    fetchAiSecretPage,
    fetchRemoveAiSecret,
    fetchSaveAiSecret,
    fetchStatusAiSecret
  } from '../../api'
  defineOptions({ name: 'AiSecret' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  const pager = computed(() => ({
    current: pageNum.value,
    size: pageSize.value,
    total: total.value
  }))
  const columns = computed<ColumnOption[]>(() => [
    { type: 'index', width: 60, label: '#' },
    { prop: 'description', label: t('aiSecret.colDescription'), minWidth: 160 },
    {
      prop: 'apiKeyMask',
      label: t('aiSecret.colKey'),
      minWidth: 160,
      formatter: (r: any) => r.apiKeyMask || r.apiKey || '***'
    },
    {
      prop: 'scopeType',
      label: t('aiSecret.colScope'),
      width: 100,
      formatter: (row: any) =>
        row.scopeType === 'user'
          ? t('aiSecret.scopeUser')
          : row.scopeType === 'app'
            ? t('aiSecret.scopeApp')
            : t('aiSecret.scopeTenant')
    },
    { prop: 'rateLimit', label: t('aiSecret.colRateLimit'), width: 90 },
    { prop: 'usedCount', label: t('aiSecret.colUsedCount'), width: 100 },
    {
      prop: 'status',
      label: t('aiSecret.colStatus'),
      width: 100,
      formatter: (row: any) =>
        h(ElSwitch, {
          modelValue: row.status === 1,
          'onUpdate:modelValue': async (v: string | number | boolean) => {
            try {
              await fetchStatusAiSecret({ id: row.id, status: v ? 1 : 0 })
              row.status = v ? 1 : 0
            } catch {
              /* 失败文案由请求层弹出，开关保持原状态 */
            }
          }
        })
    },
    {
      prop: 'operation',
      label: t('aiSecret.colActions'),
      width: 140,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => t('aiSecret.edit')
          ),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => remove(row) },
            () => t('aiSecret.delete')
          )
        ])
    }
  ])
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiSecretPage({ pageNum: pageNum.value, pageSize: pageSize.value })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { scopeType: 'tenant', rateLimit: 60, status: 1 })
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      const r = await fetchSaveAiSecret({ ...form })
      if (r?.apiKey) {
        await ElMessageBox.alert(String(r.apiKey), t('aiSecret.copyNow'))
      }
      visible.value = false
      await reload()
    } catch {
      /* 失败文案由请求层弹出，弹窗留着方便改 */
    } finally {
      saving.value = false
    }
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      t('aiSecret.removeConfirm', { name: row.description || t('aiSecret.thisKey') }),
      t('aiSecret.confirmTitle')
    )
    await fetchRemoveAiSecret(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
</style>
