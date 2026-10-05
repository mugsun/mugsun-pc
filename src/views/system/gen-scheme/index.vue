<!-- 生成方案：保存一套模块、包名和作者，启用后导入表会自动带上 -->
<template>
  <div class="gen-scheme-page art-full-height">
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElInput
          v-model="name"
          clearable
          class="name-input"
          :placeholder="$t('pages.system.genScheme.namePlaceholder')"
          @keyup.enter="load"
        />
        <ElButton @click="load">{{ $t('pages.system.genScheme.search') }}</ElButton>
        <ElButton @click="reset">{{ $t('pages.system.genScheme.reset') }}</ElButton>
        <ElButton v-perm="'sys:gen-scheme:save'" type="primary" @click="openCreate">{{
          $t('pages.system.genScheme.create')
        }}</ElButton>
        <ElButton v-perm="'sys:gen-scheme:remove'" @click="removeSelected">{{
          $t('pages.system.genScheme.removeBatch')
        }}</ElButton>
      </div>
      <ElAlert
        v-if="!loading && rows.length === 0"
        type="info"
        :closable="false"
        :title="$t('pages.system.genScheme.empty')"
      />
      <ElTable v-loading="loading" :data="rows" border @selection-change="onSelect">
        <ElTableColumn type="selection" width="48" />
        <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
        <ElTableColumn
          prop="schemeName"
          :label="$t('pages.system.genScheme.name')"
          min-width="120"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="schemeCode"
          :label="$t('pages.system.genScheme.code')"
          min-width="110"
        />
        <ElTableColumn prop="moduleName" :label="$t('pages.system.genScheme.module')" width="100" />
        <ElTableColumn
          prop="basePackage"
          :label="$t('pages.system.genScheme.basePackage')"
          min-width="160"
          show-overflow-tooltip
        />
        <ElTableColumn prop="author" :label="$t('pages.system.genScheme.author')" width="100" />
        <ElTableColumn :label="$t('pages.system.genScheme.status')" width="90">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'">{{
              row.status === 1
                ? $t('pages.system.genScheme.enabled')
                : $t('pages.system.genScheme.disabled')
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('table.column.operation')" width="180" fixed="right">
          <template #default="{ row }">
            <ElButton v-perm="'sys:gen-scheme:save'" link type="primary" @click="openEdit(row)">{{
              $t('common.edit')
            }}</ElButton>
            <ElButton
              v-if="row.status !== 1"
              v-perm="'sys:gen-scheme:enable'"
              link
              type="primary"
              @click="enableOne(row)"
            >
              {{ $t('pages.system.genScheme.enable') }}
            </ElButton>
            <ElButton v-perm="'sys:gen-scheme:remove'" link type="danger" @click="removeOne(row)">{{
              $t('pages.system.genScheme.remove')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="visible"
      :title="form.id ? $t('pages.system.genScheme.edit') : $t('pages.system.genScheme.create')"
      width="520px"
      append-to-body
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
        <ElFormItem :label="$t('pages.system.genScheme.name')" prop="schemeName">
          <ElInput v-model="form.schemeName" maxlength="64" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.code')" prop="schemeCode">
          <ElInput v-model="form.schemeCode" maxlength="40" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.module')" prop="moduleName">
          <ElInput v-model="form.moduleName" maxlength="32" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.basePackage')" prop="basePackage">
          <ElInput v-model="form.basePackage" maxlength="120" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.prefix')" prop="tablePrefix">
          <ElInput v-model="form.tablePrefix" maxlength="20" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.author')" prop="author">
          <ElInput v-model="form.author" maxlength="32" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.menu')" prop="parentMenuId">
          <ElInput
            v-model="form.parentMenuId"
            :placeholder="$t('pages.system.genScheme.menuPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.genScheme.remark')" prop="remark">
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
    fetchEnableGenScheme,
    fetchGenSchemePage,
    fetchRemoveGenScheme,
    fetchSaveGenScheme
  } from '@/api/system-manage'

  defineOptions({ name: 'GenScheme' })

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
    schemeName: '',
    schemeCode: '',
    moduleName: 'system',
    basePackage: 'com.mugsun.boot',
    tablePrefix: '',
    author: '',
    parentMenuId: '',
    remark: ''
  })

  const rules: FormRules = {
    schemeName: [
      { required: true, message: t('pages.system.genScheme.nameRequired'), trigger: 'blur' }
    ],
    schemeCode: [
      { required: true, message: t('pages.system.genScheme.codeRequired'), trigger: 'blur' }
    ],
    moduleName: [
      { required: true, message: t('pages.system.genScheme.moduleRequired'), trigger: 'blur' }
    ],
    basePackage: [
      { required: true, message: t('pages.system.genScheme.packageRequired'), trigger: 'blur' }
    ],
    author: [
      { required: true, message: t('pages.system.genScheme.authorRequired'), trigger: 'blur' }
    ]
  }

  async function load() {
    loading.value = true
    try {
      const page = await fetchGenSchemePage({
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
      schemeName: '',
      schemeCode: '',
      moduleName: 'system',
      basePackage: 'com.mugsun.boot',
      tablePrefix: '',
      author: '',
      parentMenuId: '',
      remark: ''
    })
    visible.value = true
  }

  function openEdit(row: any) {
    Object.assign(form, {
      id: String(row.id),
      schemeName: row.schemeName,
      schemeCode: row.schemeCode,
      moduleName: row.moduleName,
      basePackage: row.basePackage,
      tablePrefix: row.tablePrefix || '',
      author: row.author,
      parentMenuId: row.parentMenuId ? String(row.parentMenuId) : '',
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
        await fetchSaveGenScheme({ ...form, id: form.id || undefined })
        visible.value = false
        ElMessage.success(t('pages.system.genScheme.saved'))
        await load()
      } finally {
        saving.value = false
      }
    })
  }

  async function enableOne(row: any) {
    await fetchEnableGenScheme(String(row.id))
    ElMessage.success(t('pages.system.genScheme.enabledDone', { name: row.schemeName }))
    await load()
  }

  async function removeIds(ids: string[]) {
    await ElMessageBox.confirm(
      t('pages.system.genScheme.removeConfirm', { count: ids.length }),
      t('pages.system.genScheme.removeTitle'),
      { type: 'warning' }
    )
    await fetchRemoveGenScheme(ids)
    ElMessage.success(t('pages.system.genScheme.removed'))
    await load()
  }

  function removeOne(row: any) {
    removeIds([String(row.id)])
  }

  function removeSelected() {
    if (!selected.value.length) {
      ElMessage.warning(t('pages.system.genScheme.selectDelete'))
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
