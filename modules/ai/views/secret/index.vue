<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar"><ElButton type="primary" @click="openEdit()">新增密钥</ElButton></div>
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        empty-text="还没有密钥。点新增密钥开始发放"
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
    <ElDialog v-model="visible" :title="form.id ? '编辑密钥' : '新增密钥'" width="560px">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="说明" required><ElInput v-model="form.description" /></ElFormItem>
        <ElFormItem label="作用域">
          <ElSelect v-model="form.scopeType" style="width: 100%">
            <ElOption label="租户" value="tenant" /><ElOption label="用户" value="user" /><ElOption
              label="应用"
              value="app"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="限流/分钟"
          ><ElInputNumber v-model="form.rateLimit" :min="0"
        /></ElFormItem>
        <ElFormItem label="允许 IP"
          ><ElInput v-model="form.allowIps" placeholder="CIDR 逗号分隔"
        /></ElFormItem>
        <ElFormItem label="过期时间"
          ><ElDatePicker
            v-model="form.expireTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
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
  import { ElButton, ElMessageBox, ElSwitch } from 'element-plus'
  import {
    fetchAiSecretPage,
    fetchRemoveAiSecret,
    fetchSaveAiSecret,
    fetchStatusAiSecret
  } from '../../api'
  defineOptions({ name: 'AiSecret' })
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
    { prop: 'description', label: '说明', minWidth: 160 },
    {
      prop: 'apiKeyMask',
      label: '密钥',
      minWidth: 160,
      formatter: (r: any) => r.apiKeyMask || r.apiKey || '***'
    },
    {
      prop: 'scopeType',
      label: '作用域',
      width: 100,
      formatter: (row: any) =>
        row.scopeType === 'user' ? '用户' : row.scopeType === 'app' ? '应用' : '租户'
    },
    { prop: 'rateLimit', label: '限流', width: 90 },
    { prop: 'usedCount', label: '调用次数', width: 100 },
    {
      prop: 'status',
      label: '状态',
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
      label: '操作',
      width: 140,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => '编辑'
          ),
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
  }
  async function save() {
    saving.value = true
    try {
      const r = await fetchSaveAiSecret({ ...form })
      if (r?.apiKey) {
        await ElMessageBox.alert(String(r.apiKey), '请立刻复制。关掉后无法再查看')
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
      `删除「${row.description || '这把密钥'}」后，列表里不会再出现，也不能再调用`,
      '确认'
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
