<!-- 任务服务：登记多套调度地址，保存时尝试同步，口令不回显 -->
<template>
  <div class="job-server-page art-full-height">
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElInput
          v-model="name"
          clearable
          class="name-input"
          :placeholder="$t('pages.system.jobServer.namePlaceholder')"
          @keyup.enter="load"
        />
        <ElButton @click="load">{{ $t('pages.system.jobServer.search') }}</ElButton>
        <ElButton @click="reset">{{ $t('pages.system.jobServer.reset') }}</ElButton>
        <ElButton v-perm="'sys:job-server:save'" type="primary" @click="openCreate">{{
          $t('pages.system.jobServer.create')
        }}</ElButton>
        <ElButton v-perm="'sys:job-server:sync'" @click="syncAll">{{
          $t('pages.system.jobServer.syncAll')
        }}</ElButton>
        <ElButton v-perm="'sys:job-server:remove'" @click="removeSelected">{{
          $t('pages.system.jobServer.removeBatch')
        }}</ElButton>
      </div>
      <ElAlert
        v-if="!loading && rows.length === 0"
        type="info"
        :closable="false"
        :title="$t('pages.system.jobServer.empty')"
      />
      <ElTable v-loading="loading" :data="rows" border @selection-change="onSelect">
        <ElTableColumn type="selection" width="48" />
        <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
        <ElTableColumn
          prop="serverName"
          :label="$t('pages.system.jobServer.name')"
          min-width="120"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="serverUrl"
          :label="$t('pages.system.jobServer.url')"
          min-width="180"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="appName"
          :label="$t('pages.system.jobServer.appName')"
          min-width="100"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('pages.system.jobServer.syncStatus')" width="88">
          <template #default="{ row }">
            <ElTag
              :type="row.syncStatus === 1 ? 'success' : row.syncStatus === 0 ? 'danger' : 'info'"
            >
              {{ syncLabel(row.syncStatus) }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('table.column.operation')" width="220" fixed="right">
          <template #default="{ row }">
            <ElButton v-perm="'sys:job-server:sync'" link type="primary" @click="syncOne(row)">{{
              $t('pages.system.jobServer.sync')
            }}</ElButton>
            <ElButton link type="primary" @click="openUrl(row)">{{
              $t('pages.system.jobServer.open')
            }}</ElButton>
            <ElButton v-perm="'sys:job-server:save'" link type="primary" @click="openEdit(row)">{{
              $t('common.edit')
            }}</ElButton>
            <ElButton v-perm="'sys:job-server:remove'" link type="danger" @click="removeOne(row)">{{
              $t('pages.system.jobServer.remove')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="form.id ? $t('pages.system.jobServer.edit') : $t('pages.system.jobServer.create')"
      width="480px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="90px">
        <ElFormItem :label="$t('pages.system.jobServer.name')" prop="serverName">
          <ElInput
            v-model="form.serverName"
            :placeholder="$t('pages.system.jobServer.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.jobServer.url')" prop="serverUrl">
          <ElInput
            v-model="form.serverUrl"
            :placeholder="$t('pages.system.jobServer.urlPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.jobServer.appName')" prop="appName">
          <ElInput
            v-model="form.appName"
            :placeholder="$t('pages.system.jobServer.appPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.jobServer.password')" prop="password">
          <ElInput
            v-model="form.password"
            type="password"
            show-password
            :placeholder="
              form.id
                ? $t('pages.system.jobServer.passwordKeep')
                : $t('pages.system.jobServer.passwordPlaceholder')
            "
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.jobServer.remark')">
          <ElInput
            v-model="form.remark"
            :placeholder="$t('pages.system.jobServer.remarkPlaceholder')"
          />
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
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchJobServerPage,
    fetchRemoveJobServer,
    fetchSaveJobServer,
    fetchSyncJobServer
  } from '@/api/system-manage'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'JobServer' })

  const { t } = useI18n()
  const name = ref('')
  const rows = ref<any[]>([])
  const loading = ref(false)
  const selected = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive({
    id: '' as string,
    serverName: '',
    serverUrl: '',
    appName: '',
    password: '',
    remark: ''
  })

  const rules: FormRules = {
    serverName: [
      { required: true, message: t('pages.system.jobServer.namePlaceholder'), trigger: 'blur' }
    ],
    serverUrl: [
      { required: true, message: t('pages.system.jobServer.urlPlaceholder'), trigger: 'blur' }
    ],
    appName: [
      { required: true, message: t('pages.system.jobServer.appPlaceholder'), trigger: 'blur' }
    ],
    password: [
      {
        validator: (_rule, value, callback) => {
          if (!form.id && (!value || !String(value).trim())) {
            callback(new Error(t('pages.system.jobServer.passwordPlaceholder')))
          } else {
            callback()
          }
        },
        trigger: 'blur'
      }
    ]
  }

  function syncLabel(status?: number) {
    if (status === 1) return t('pages.system.jobServer.synced')
    if (status === 0) return t('pages.system.jobServer.failed')
    return t('pages.system.jobServer.pending')
  }

  async function load() {
    loading.value = true
    try {
      const page = await fetchJobServerPage({
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
    Object.assign(form, {
      id: '',
      serverName: '',
      serverUrl: '',
      appName: '',
      password: '',
      remark: ''
    })
    visible.value = true
  }

  function openEdit(row: any) {
    Object.assign(form, {
      id: String(row.id),
      serverName: row.serverName,
      serverUrl: row.serverUrl,
      appName: row.appName,
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
        const result = await fetchSaveJobServer({ ...form, id: form.id || undefined })
        visible.value = false
        if (result?.synced) ElMessage.success(t('pages.system.jobServer.savedSynced'))
        else ElMessage.warning(result?.message || t('pages.system.jobServer.failed'))
        await load()
      } finally {
        saving.value = false
      }
    })
  }

  function showSync(result?: { fail: number; message: string }) {
    if (result && result.fail > 0) ElMessage.warning(result.message)
    else ElMessage.success(result?.message || t('pages.system.jobServer.synced'))
  }

  async function syncOne(row: any) {
    const result = await fetchSyncJobServer(String(row.id))
    showSync(result)
    await load()
  }

  async function syncAll() {
    const result = await fetchSyncJobServer()
    showSync(result)
    await load()
  }

  function openUrl(row: any) {
    const url = String(row.serverUrl || '')
    if (url.startsWith('http://') || url.startsWith('https://'))
      window.open(url, '_blank', 'noopener')
  }

  async function removeIds(ids: string[]) {
    await ElMessageBox.confirm(
      t('pages.system.jobServer.removeConfirm', { count: ids.length }),
      t('pages.system.jobServer.removeTitle'),
      { type: 'warning' }
    )
    try {
      await fetchRemoveJobServer(ids)
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
      ElMessage.warning(t('pages.system.jobServer.selectDelete'))
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

  .art-table-card :deep(.el-alert) {
    margin-bottom: 12px;
  }
</style>
