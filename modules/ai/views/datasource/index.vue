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
          @clear="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">新增数据源</ElButton>
      </div>
      <ArtTable
        :loading="loading"
        :data="records"
        :columns="columns"
        :pagination="pager"
        :empty-text="emptyText"
        @pagination:size-change="onSize"
        @pagination:current-change="onPage"
      />
    </ElCard>
    <ElDialog
      v-model="visible"
      class="ai-datasource-dialog"
      :title="form.id ? '编辑数据源' : '新增数据源'"
      width="600px"
    >
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="名称" required>
          <ElInput v-model="form.name" maxlength="64" placeholder="用来在列表里区分" />
        </ElFormItem>
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
        <ElFormItem label="JDBC 地址" required>
          <ElInput v-model="form.jdbcUrl" placeholder="例如 jdbc:postgresql://主机:端口/库名" />
        </ElFormItem>
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
  import { ElButton, ElMessageBox } from 'element-plus'
  import {
    fetchAiDatasourcePage,
    fetchRemoveAiDatasource,
    fetchSaveAiDatasource,
    fetchTestAiDatasource
  } from '../../api'
  defineOptions({ name: 'AiDatasource' })
  const TYPE_LABEL: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    kingbase: '金仓',
    dm: '达梦',
    mariadb: 'MariaDB',
    starrocks: 'StarRocks'
  }
  const keyword = ref('')
  const searched = ref(false)
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
  const emptyText = computed(() =>
    searched.value ? '没有符合条件的数据源。换个名称再查' : '还没有数据源。点新增数据源开始配置'
  )
  const columns: ColumnOption[] = [
    { type: 'index', width: 60, label: '#' },
    { prop: 'name', label: '名称', minWidth: 140 },
    {
      prop: 'dbType',
      label: '类型',
      width: 120,
      formatter: (row: any) => TYPE_LABEL[row.dbType] || row.dbType || ''
    },
    { prop: 'jdbcUrl', label: 'JDBC', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 220,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', { class: 'ops' }, [
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
    const name = keyword.value.trim()
    searched.value = name.length > 0
    try {
      const res = await fetchAiDatasourcePage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: name || undefined
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
      visible.value = false
      await reload()
    } catch {
      /* 失败提示由请求层展示，弹窗留着方便改完再存 */
    } finally {
      saving.value = false
    }
  }
  async function test(row: any) {
    try {
      await fetchTestAiDatasource(row.id)
    } catch {
      /* 没连上时请求层会用服务器说明，不能再显示成成功 */
    }
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      `删除「${row.name || '这个数据源'}」后，列表里不会再出现，问数里也不能再选`,
      '确认'
    )
    await fetchRemoveAiDatasource(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
  }
</style>
