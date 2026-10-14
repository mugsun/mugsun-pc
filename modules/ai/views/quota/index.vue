<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar"
        ><ElButton type="primary" @click="openEdit()">{{ $t('aiQuota.configure') }}</ElButton></div
      >
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
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
    <ElDialog v-model="visible" :title="$t('aiForm.quotaConfig')" width="560px">
      <ElForm :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.scope')">
          <ElSelect v-model="form.scopeType" style="width: 100%">
            <ElOption :label="$t('aiForm.optTenant')" value="tenant" /><ElOption
              :label="$t('aiForm.optUser')"
              value="user"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.monthlyTokenLimit')"
          ><ElInputNumber v-model="form.tokenLimit" :min="0"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.monthlyCostLimit')"
          ><ElInputNumber v-model="form.amountLimit" :min="0" :precision="2"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.warnThreshold')"
          ><ElInputNumber v-model="form.warnPercent" :min="1" :max="100"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.overLimitAction')">
          <ElSelect v-model="form.overAction" style="width: 100%">
            <ElOption :label="$t('aiForm.optWarnOnly')" value="warn_only" /><ElOption
              :label="$t('aiForm.optReject')"
              value="reject"
            />
          </ElSelect>
        </ElFormItem>
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
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref } from 'vue'
  import { ElButton, ElMessage } from 'element-plus'
  import { fetchAiQuotaPage, fetchSaveAiQuota } from '../../api'
  defineOptions({ name: 'AiQuota' })
  const { t } = useI18n()
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
    { prop: 'scopeType', label: t('aiQuota.colScope'), width: 100 },
    { prop: 'tokenLimit', label: t('aiQuota.colTokenLimit'), width: 120 },
    { prop: 'usedTokens', label: t('aiQuota.colUsedTokens'), width: 120 },
    { prop: 'amountLimit', label: t('aiQuota.colAmountLimit'), width: 120 },
    { prop: 'usedAmount', label: t('aiQuota.colUsedAmount'), width: 120 },
    { prop: 'warnPercent', label: t('aiQuota.colWarnPercent'), width: 90 },
    { prop: 'overAction', label: t('aiQuota.colOverAction'), width: 110 },
    {
      prop: 'operation',
      label: t('aiQuota.colActions'),
      width: 100,
      fixed: 'right',
      formatter: (row: any) =>
        h(
          ElButton,
          { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
          () => t('aiQuota.edit')
        )
    }
  ])
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiQuotaPage({ pageNum: pageNum.value, pageSize: pageSize.value })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(
      form,
      row ? { ...row } : { scopeType: 'tenant', warnPercent: 80, overAction: 'reject' }
    )
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await fetchSaveAiQuota({ ...form })
      ElMessage.success(t('aiQuota.saved'))
      visible.value = false
      await reload()
    } catch {
      /* 失败提示由请求层展示，弹窗留着方便改完再存 */
    } finally {
      saving.value = false
    }
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    margin-bottom: 12px;
  }
</style>
