<template>
  <div class="ai-crud-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiDatasourceList.searchPh')"
          style="width: 200px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">{{ $t('aiDatasourceList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiDatasourceList.add') }}</ElButton>
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
      :title="form.id ? $t('aiForm.editDatasource') : $t('aiForm.newDatasource')"
      width="600px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.name')" prop="name" :rules="requiredRule($t('aiForm.name'))">
          <ElInput v-model="form.name" maxlength="64" :placeholder="$t('aiForm.phListName')" />
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.type')"
          prop="dbType"
          :rules="requiredRule($t('aiForm.type'), true)"
        >
          <ElSelect v-model="form.dbType" style="width: 100%">
            <ElOption label="PostgreSQL" value="postgresql" />
            <ElOption label="MySQL" value="mysql" />
            <ElOption :label="$t('aiForm.optKingbase')" value="kingbase" />
            <ElOption :label="$t('aiForm.optDm')" value="dm" />
            <ElOption label="MariaDB" value="mariadb" />
            <ElOption label="StarRocks" value="starrocks" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.jdbcUrl')"
          prop="jdbcUrl"
          :rules="requiredRule($t('aiForm.jdbcUrl'))"
        >
          <ElInput v-model="form.jdbcUrl" :placeholder="$t('aiForm.phJdbcExample')" />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.username')"><ElInput v-model="form.username" /></ElFormItem>
        <ElFormItem :label="$t('aiForm.password')"
          ><ElInput
            v-model="form.password"
            type="password"
            show-password
            :placeholder="$t('aiForm.phKeepUnchanged')"
        /></ElFormItem>
        <ElFormItem :label="$t('aiForm.remark')"><ElInput v-model="form.remark" /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { FormInstance } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { requiredRule } from '../shared/formRules'
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref, nextTick } from 'vue'
  import { ElButton, ElMessageBox } from 'element-plus'
  import {
    fetchAiDatasourcePage,
    fetchRemoveAiDatasource,
    fetchSaveAiDatasource,
    fetchTestAiDatasource
  } from '../../api'
  defineOptions({ name: 'AiDatasource' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const TYPE_LABEL: Record<string, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    kingbase: 'Kingbase',
    dm: 'DM',
    mariadb: 'MariaDB',
    starrocks: 'StarRocks'
  }
  /** 国产库在中文界面显示中文名，英文界面显示 Kingbase / DM */
  const DB_LABEL_KEYS: Record<string, string> = {
    kingbase: 'aiDatasourceList.dbKingbase',
    dm: 'aiDatasourceList.dbDm'
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
    searched.value ? t('aiDatasourceList.emptySearched') : t('aiDatasourceList.empty')
  )
  const columns = computed<ColumnOption[]>(() => [
    { type: 'index', width: 60, label: '#' },
    { prop: 'name', label: t('aiDatasourceList.colName'), minWidth: 140 },
    {
      prop: 'dbType',
      label: t('aiDatasourceList.colType'),
      width: 120,
      formatter: (row: any) =>
        DB_LABEL_KEYS[row.dbType]
          ? t(DB_LABEL_KEYS[row.dbType])
          : TYPE_LABEL[row.dbType] || row.dbType || ''
    },
    { prop: 'jdbcUrl', label: 'JDBC', minWidth: 220, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: t('aiDatasourceList.colOps'),
      width: 220,
      fixed: 'right',
      formatter: (row: any) =>
        h('div', { class: 'ops' }, [
          h(
            ElButton,
            { link: true, type: 'primary', size: 'small', onClick: () => openEdit(row) },
            () => t('aiDatasourceList.edit')
          ),
          h(ElButton, { link: true, size: 'small', onClick: () => test(row) }, () =>
            t('aiDatasourceList.test')
          ),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => remove(row) },
            () => t('aiDatasourceList.remove')
          )
        ])
    }
  ])
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
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
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
      t('aiDatasourceList.removeConfirm', { name: row.name || t('aiDatasourceList.thisOne') }),
      t('aiDatasourceList.confirm')
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
