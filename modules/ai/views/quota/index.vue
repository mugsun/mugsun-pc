<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar"><ElButton type="primary" @click="openEdit()">配置配额</ElButton></div>
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
    <ElDialog v-model="visible" title="配额配置" width="560px">
      <ElForm :model="form" label-width="120px">
        <ElFormItem label="作用域">
          <ElSelect v-model="form.scopeType" style="width: 100%">
            <ElOption label="租户" value="tenant" /><ElOption label="用户" value="user" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="月 Token 上限"
          ><ElInputNumber v-model="form.tokenLimit" :min="0"
        /></ElFormItem>
        <ElFormItem label="月费用上限"
          ><ElInputNumber v-model="form.amountLimit" :min="0" :precision="2"
        /></ElFormItem>
        <ElFormItem label="预警阈值(%)"
          ><ElInputNumber v-model="form.warnPercent" :min="1" :max="100"
        /></ElFormItem>
        <ElFormItem label="超额动作">
          <ElSelect v-model="form.overAction" style="width: 100%">
            <ElOption label="仅告警" value="warn_only" /><ElOption
              label="拒绝调用"
              value="reject"
            />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref } from 'vue'
  import { ElButton, ElMessage } from 'element-plus'
  import { fetchAiQuotaPage, fetchSaveAiQuota } from '../../api'
  defineOptions({ name: 'AiQuota' })
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
  const columns: ColumnOption[] = [
    { type: 'index', width: 60, label: '#' },
    { prop: 'scopeType', label: '作用域', width: 100 },
    { prop: 'tokenLimit', label: 'Token 上限', width: 120 },
    { prop: 'usedTokens', label: '已用 Token', width: 120 },
    { prop: 'amountLimit', label: '费用上限', width: 120 },
    { prop: 'usedAmount', label: '已用费用', width: 120 },
    { prop: 'warnPercent', label: '预警%', width: 90 },
    { prop: 'overAction', label: '超额动作', width: 110 },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      fixed: 'right',
      formatter: (row: any) =>
        h(
          ElButton,
          { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
          () => '编辑'
        )
    }
  ]
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
      ElMessage.success('已保存')
      visible.value = false
      await reload()
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
