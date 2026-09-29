<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElButton type="primary" @click="openEdit()">新增渠道绑定</ElButton>
      </div>
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
    <ElDialog v-model="visible" :title="form.id ? '编辑渠道' : '新增渠道'" width="560px">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="名称" required><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="渠道类型" required>
          <ElSelect v-model="form.channelType" style="width: 100%">
            <ElOption label="企微" value="wecom" /><ElOption label="钉钉" value="dingtalk" />
            <ElOption label="飞书" value="feishu" /><ElOption label="Webhook" value="webhook" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Webhook"><ElInput v-model="form.webhookUrl" /></ElFormItem>
        <ElFormItem label="绑定应用"
          ><ElInput v-model="form.appId" placeholder="应用 ID"
        /></ElFormItem>
        <ElFormItem label="状态"
          ><ElSwitch v-model="form.status" :active-value="1" :inactive-value="0"
        /></ElFormItem>
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
  import { ElButton, ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiChannelPage,
    fetchDebugAiChannel,
    fetchRemoveAiChannel,
    fetchSaveAiChannel
  } from '../../api'
  defineOptions({ name: 'AiChannel' })
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
    { prop: 'name', label: '名称', minWidth: 140 },
    { prop: 'channelType', label: '类型', width: 120 },
    { prop: 'webhookUrl', label: 'Webhook', minWidth: 200, showOverflowTooltip: true },
    {
      prop: 'status',
      label: '状态',
      width: 80,
      formatter: (r: any) => (r.status === 1 ? '启用' : '停用')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 200,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => '编辑'
          ),
          h(ElButton, { link: true, size: 'small', onClick: () => debug(row) }, () => '调试'),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => remove(row) },
            () => '删除'
          )
        ])
    }
  ]
  async function reload() {
    loading.value = true
    try {
      const res = await fetchAiChannelPage({ pageNum: pageNum.value, pageSize: pageSize.value })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { channelType: 'webhook', status: 1 })
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      await fetchSaveAiChannel({ ...form })
      ElMessage.success('已保存')
      visible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }
  async function debug(row: any) {
    const r = await fetchDebugAiChannel(row.id)
    ElMessage.success(r?.message || '调试成功')
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除「${row.name}」？`, '确认')
    await fetchRemoveAiChannel(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    margin-bottom: 12px;
  }
</style>
