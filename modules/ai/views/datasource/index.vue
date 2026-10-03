<template>
  <div class="ai-crud-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="按名称搜索"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">新增数据源</ElButton>
      </div>
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        @pagination:size-change="onSize"
        @pagination:current-change="onPage"
      />
    </ElCard>
    <ElDialog v-model="visible" :title="form.id ? '编辑数据源' : '新增数据源'" width="600px">
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="名称" required><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="类型" required>
          <ElSelect v-model="form.dbType" style="width: 100%">
            <ElOption label="PostgreSQL" value="postgresql" />
            <ElOption label="MySQL" value="mysql" />
            <ElOption label="金仓" value="kingbase" />
            <ElOption label="达梦" value="dm" />
            <ElOption label="MariaDB" value="mariadb" />
            <ElOption label="StarRocks" value="starrocks" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="JDBC URL" required><ElInput v-model="form.jdbcUrl" /></ElFormItem>
        <ElFormItem label="用户名"><ElInput v-model="form.username" /></ElFormItem>
        <ElFormItem label="密码"
          ><ElInput
            v-model="form.password"
            type="password"
            show-password
            placeholder="编辑留空不修改"
        /></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" /></ElFormItem>
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
    fetchAiDatasourcePage,
    fetchRemoveAiDatasource,
    fetchSaveAiDatasource,
    fetchTestAiDatasource
  } from '../../api'
  defineOptions({ name: 'AiDatasource' })
  const keyword = ref('')
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
    { prop: 'dbType', label: '类型', width: 120 },
    { prop: 'jdbcUrl', label: 'JDBC', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'activateFlag',
      label: '状态',
      width: 90,
      formatter: (r: any) => (r.activateFlag === 1 ? '已激活' : '未激活')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 220,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => '编辑'
          ),
          h(ElButton, { link: true, size: 'small', onClick: () => test(row) }, () => '测试连接'),
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
      const res = await fetchAiDatasourcePage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: keyword.value || undefined
      })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }
  function onSize(s: number) {
    pageSize.value = s
    reload()
  }
  function onPage(p: number) {
    pageNum.value = p
    reload()
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row, password: '' } : { dbType: 'postgresql' })
    visible.value = true
  }
  async function save() {
    saving.value = true
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      await fetchSaveAiDatasource(payload)
      ElMessage.success('已保存')
      visible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }
  async function test(row: any) {
    const r = await fetchTestAiDatasource(row.id)
    if (r?.ok === false) {
      ElMessage.warning(r?.message || '连接失败')
      return
    }
    ElMessage.success(r?.message || '连接成功')
    await reload()
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(`删除数据源「${row.name}」？`, '确认')
    await fetchRemoveAiDatasource(row.id)
    ElMessage.success('已删除')
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
</style>
