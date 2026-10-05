<!-- 代码生成数据源：登记多套库，口令不回显，连不上用警告说明下一步 -->
<template>
  <div class="gen-ds-page art-full-height">
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElInput
          v-model="name"
          clearable
          class="name-input"
          :placeholder="$t('pages.system.genDatasource.namePlaceholder')"
          @keyup.enter="load"
        />
        <ElButton @click="load">{{ $t('pages.system.genDatasource.search') }}</ElButton>
        <ElButton @click="reset">{{ $t('pages.system.genDatasource.reset') }}</ElButton>
        <ElButton v-perm="'sys:gen-ds:save'" type="primary" @click="openCreate">{{
          $t('pages.system.genDatasource.create')
        }}</ElButton>
        <ElButton v-perm="'sys:gen-ds:remove'" @click="removeSelected">{{
          $t('pages.system.genDatasource.removeBatch')
        }}</ElButton>
      </div>
      <ElAlert
        v-if="!loading && rows.length === 0"
        type="info"
        :closable="false"
        :title="$t('pages.system.genDatasource.empty')"
      />
      <ElTable v-loading="loading" :data="rows" border @selection-change="onSelect">
        <ElTableColumn type="selection" width="48" />
        <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
        <ElTableColumn
          prop="dsName"
          :label="$t('pages.system.genDatasource.name')"
          min-width="120"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="jdbcUrl"
          :label="$t('pages.system.genDatasource.url')"
          min-width="220"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="username"
          :label="$t('pages.system.genDatasource.username')"
          min-width="100"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('pages.system.genDatasource.status')" width="100">
          <template #default="{ row }">
            <ElTag :type="row.connectStatus === 1 ? 'success' : 'warning'">{{
              statusLabel(row.connectStatus)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="connectMsg"
          :label="$t('pages.system.genDatasource.message')"
          min-width="180"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('table.column.operation')" width="200" fixed="right">
          <template #default="{ row }">
            <ElButton v-perm="'sys:gen-ds:save'" link type="primary" @click="openEdit(row)">{{
              $t('common.edit')
            }}</ElButton>
            <ElButton v-perm="'sys:gen-ds:test'" link type="primary" @click="testOne(row)">{{
              $t('pages.system.genDatasource.test')
            }}</ElButton>
            <ElButton v-perm="'sys:gen-ds:remove'" link type="danger" @click="removeOne(row)">{{
              $t('pages.system.genDatasource.remove')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="
        form.id ? $t('pages.system.genDatasource.edit') : $t('pages.system.genDatasource.create')
      "
      width="520px"
      append-to-body
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
        <ElFormItem :label="$t('pages.system.genDatasource.name')" prop="dsName">
          <ElInput v-model="form.dsName" maxlength="64" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genDatasource.url')" prop="jdbcUrl">
          <ElInput
            v-model="form.jdbcUrl"
            maxlength="300"
            :placeholder="$t('pages.system.genDatasource.urlPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genDatasource.username')" prop="username">
          <ElInput v-model="form.username" maxlength="64" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genDatasource.password')" prop="password">
          <ElInput
            v-model="form.password"
            type="password"
            show-password
            maxlength="128"
            autocomplete="new-password"
            :placeholder="$t('pages.system.genDatasource.passwordPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genDatasource.remark')" prop="remark">
          <ElInput v-model="form.remark" maxlength="200" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import {
    fetchGenDatasourcePage,
    fetchRemoveGenDatasource,
    fetchSaveGenDatasource,
    fetchTestGenDatasource
  } from '@/api/system-manage'

  defineOptions({ name: 'GenDatasource' })

  const { t } = useI18n()
  const name = ref('')
  const loading = ref(false)
  const rows = ref<any[]>([])
  const selected = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive({
    id: '' as string,
    dsName: '',
    jdbcUrl: '',
    username: '',
    password: '',
    remark: ''
  })

  const rules: FormRules = {
    dsName: [
      { required: true, message: t('pages.system.genDatasource.nameRequired'), trigger: 'blur' }
    ],
    jdbcUrl: [
      { required: true, message: t('pages.system.genDatasource.urlRequired'), trigger: 'blur' }
    ],
    username: [
      { required: true, message: t('pages.system.genDatasource.usernameRequired'), trigger: 'blur' }
    ],
    password: [
      {
        validator: (_rule, value, callback) => {
          if (!form.id && (!value || !String(value).trim())) {
            callback(new Error(t('pages.system.genDatasource.passwordPlaceholder')))
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }

  function statusLabel(status?: number) {
    if (status === 1) return t('pages.system.genDatasource.connected')
    if (status === 0) return t('pages.system.genDatasource.disconnected')
    return t('pages.system.genDatasource.pending')
  }

  async function load() {
    loading.value = true
    try {
      const page = await fetchGenDatasourcePage({
        pageNum: 1,
        pageSize: 20,
        name: name.value || undefined
      })
      rows.value = page?.records || []
    } finally {
      loading.value = false
    }
  }

  function reset() {
    name.value = ''
    load()
  }

  function onSelect(list: any[]) {
    selected.value = list
  }

  function openCreate() {
    Object.assign(form, { id: '', dsName: '', jdbcUrl: '', username: '', password: '', remark: '' })
    visible.value = true
  }

  function openEdit(row: any) {
    Object.assign(form, {
      id: String(row.id),
      dsName: row.dsName,
      jdbcUrl: row.jdbcUrl,
      username: row.username,
      password: '',
      remark: row.remark || ''
    })
    visible.value = true
  }

  async function submit() {
    if (!formRef.value || saving.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      saving.value = true
      try {
        const result = await fetchSaveGenDatasource({ ...form, id: form.id || undefined })
        visible.value = false
        if (result?.connected) ElMessage.success(t('pages.system.genDatasource.savedConnected'))
        else ElMessage.warning(result?.message || t('pages.system.genDatasource.disconnected'))
        await load()
      } finally {
        saving.value = false
      }
    })
  }

  async function testOne(row: any) {
    const result = await fetchTestGenDatasource(String(row.id))
    if (result?.connected)
      ElMessage.success(result.message || t('pages.system.genDatasource.connected'))
    else ElMessage.warning(result?.message || t('pages.system.genDatasource.disconnected'))
    await load()
  }

  async function removeIds(ids: string[]) {
    await ElMessageBox.confirm(
      t('pages.system.genDatasource.removeConfirm', { count: ids.length }),
      t('pages.system.genDatasource.removeTitle'),
      { type: 'warning' }
    )
    try {
      await fetchRemoveGenDatasource(ids)
    } catch {
      return
    }
    await load()
  }

  function removeOne(row: any) {
    removeIds([String(row.id)])
  }

  function removeSelected() {
    if (!selected.value.length) {
      ElMessage.warning(t('pages.system.genDatasource.selectDelete'))
      return
    }
    removeIds(selected.value.map((row) => String(row.id)))
  }

  onMounted(load)
</script>

<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .name-input {
    width: 220px;
  }
</style>
