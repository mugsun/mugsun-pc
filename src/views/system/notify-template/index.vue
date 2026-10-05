<!-- 通知模板：按名称查找，内置欢迎模板不能删、不能停用 -->
<template>
  <div class="notify-template-page art-full-height">
    <ElCard class="art-table-card">
      <div class="nt-body">
        <div class="nt-toolbar">
          <ElInput
            v-model="keyword"
            clearable
            class="nt-search"
            :placeholder="$t('pages.system.notifyTemplate.searchPlaceholder')"
            @keyup.enter="search"
          />
          <ElButton type="primary" @click="search">{{
            $t('pages.system.notifyTemplate.search')
          }}</ElButton>
          <ElButton @click="resetSearch">{{ $t('pages.system.notifyTemplate.reset') }}</ElButton>
          <ElButton v-perm="'sys:notify:save'" type="primary" @click="showDialog('add')">{{
            $t('pages.system.notifyTemplate.addBtn')
          }}</ElButton>
          <ElButton v-perm="'sys:notify:remove'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.notifyTemplate.deleteSelected')
          }}</ElButton>
        </div>
        <div class="nt-table-wrap">
          <ElTable
            v-loading="loading"
            :data="tableData"
            border
            height="100%"
            :empty-text="emptyText"
            @selection-change="onSelectionChange"
          >
            <ElTableColumn type="selection" width="48" :selectable="canSelect" />
            <ElTableColumn
              prop="code"
              :label="$t('pages.system.notifyTemplate.colCode')"
              width="140"
            />
            <ElTableColumn
              prop="name"
              :label="$t('pages.system.notifyTemplate.colName')"
              min-width="160"
              show-overflow-tooltip
            />
            <ElTableColumn
              prop="subject"
              :label="$t('pages.system.notifyTemplate.colSubject')"
              min-width="180"
              show-overflow-tooltip
            />
            <ElTableColumn
              prop="channels"
              :label="$t('pages.system.notifyTemplate.colChannels')"
              width="140"
            />
            <ElTableColumn :label="$t('pages.system.notifyTemplate.colStatus')" width="90">
              <template #default="{ row }">
                <ElTag :type="row.status === 1 ? 'success' : 'info'">
                  {{
                    row.status === 1
                      ? $t('pages.system.notifyTemplate.statusOn')
                      : $t('pages.system.notifyTemplate.statusOff')
                  }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.notifyTemplate.colOperation')" width="120">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:notify:save'"
                  link
                  type="primary"
                  @click="showDialog('edit', row)"
                  >{{ $t('common.edit') }}</ElButton
                >
                <ElButton
                  v-if="canSelect(row)"
                  v-perm="'sys:notify:remove'"
                  link
                  type="danger"
                  @click="deleteRow(row)"
                  >{{ $t('common.delete') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="nt-pager">
          <ElPagination
            v-model:current-page="pageNum"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            background
            @current-change="loadData"
          />
        </div>
      </div>
    </ElCard>
    <ElDialog
      v-model="dialogVisible"
      :title="
        form.id
          ? $t('pages.system.notifyTemplate.editTitle')
          : $t('pages.system.notifyTemplate.addBtn')
      "
      width="640px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="80px">
        <ElFormItem :label="$t('pages.system.notifyTemplate.colCode')" prop="code">
          <ElInput
            v-model="form.code"
            :disabled="!!form.id"
            maxlength="64"
            :placeholder="$t('pages.system.notifyTemplate.codePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyTemplate.colName')" prop="name">
          <ElInput
            v-model="form.name"
            maxlength="128"
            :placeholder="$t('pages.system.notifyTemplate.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyTemplate.colSubject')" prop="subject">
          <ElInput
            v-model="form.subject"
            maxlength="255"
            :placeholder="$t('pages.system.notifyTemplate.subjectPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyTemplate.contentLabel')" prop="content">
          <ElInput
            v-model="form.content"
            type="textarea"
            :rows="4"
            maxlength="20000"
            :placeholder="$t('pages.system.notifyTemplate.contentPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyTemplate.colChannels')" prop="channels">
          <ElInput
            v-model="form.channels"
            :placeholder="$t('pages.system.notifyTemplate.channelsPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyTemplate.colStatus')" prop="status">
          <ElSelect v-model="form.status" class="nt-full">
            <ElOption :value="1" :label="$t('pages.system.notifyTemplate.statusOn')" />
            <ElOption :value="0" :label="$t('pages.system.notifyTemplate.statusOff')" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('pages.system.notifyTemplate.submitBtn')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import {
    fetchNotifyTemplatePage,
    fetchRemoveNotifyTemplate,
    fetchSaveNotifyTemplate
  } from '@/api/notify'

  defineOptions({ name: 'NotifyTemplate' })

  const { t } = useI18n()
  const tableData = ref<any[]>([])
  const loading = ref(false)
  const keyword = ref('')
  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive({
    id: undefined as string | undefined,
    code: '',
    name: '',
    subject: '',
    content: '',
    channels: 'in_app',
    status: 1
  })
  const emptyText = computed(() =>
    filtering.value
      ? t('pages.system.notifyTemplate.emptySearch')
      : t('pages.system.notifyTemplate.emptyList')
  )
  const canSelect = (row: { code?: string }) => row.code !== 'welcome'
  const rules = computed<FormRules>(() => ({
    code: [
      { required: true, message: t('pages.system.notifyTemplate.ruleCode'), trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{0,63}$/,
        message: t('pages.system.notifyTemplate.ruleCodeFormat'),
        trigger: 'blur'
      }
    ],
    name: [{ required: true, message: t('pages.system.notifyTemplate.ruleName'), trigger: 'blur' }],
    subject: [
      { required: true, message: t('pages.system.notifyTemplate.ruleSubject'), trigger: 'blur' }
    ],
    content: [
      { required: true, message: t('pages.system.notifyTemplate.ruleContent'), trigger: 'blur' }
    ],
    channels: [
      { required: true, message: t('pages.system.notifyTemplate.ruleChannels'), trigger: 'blur' }
    ],
    status: [
      { required: true, message: t('pages.system.notifyTemplate.ruleStatus'), trigger: 'change' }
    ]
  }))
  const loadData = async () => {
    loading.value = true
    try {
      const res = await fetchNotifyTemplatePage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        name: filtering.value ? keyword.value.trim() : undefined
      })
      tableData.value = res?.records || []
      total.value = res?.totalRow ?? 0
    } finally {
      loading.value = false
    }
  }
  const search = () => {
    filtering.value = !!keyword.value.trim()
    pageNum.value = 1
    loadData()
  }
  const resetSearch = () => {
    keyword.value = ''
    filtering.value = false
    pageNum.value = 1
    loadData()
  }
  const onSelectionChange = (rows: any[]) => {
    selectedRows.value = rows
  }
  const showDialog = (type: 'add' | 'edit', row?: any) => {
    Object.assign(form, {
      id: type === 'edit' ? row.id : undefined,
      code: type === 'edit' ? row.code : '',
      name: type === 'edit' ? row.name : '',
      subject: type === 'edit' ? row.subject : '',
      content: type === 'edit' ? row.content || '' : '',
      channels: type === 'edit' ? row.channels : 'in_app',
      status: type === 'edit' ? row.status : 1
    })
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  const submit = async () => {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    dialogSaving.value = true
    try {
      await fetchSaveNotifyTemplate({ ...form })
      dialogVisible.value = false
      await loadData()
    } finally {
      dialogSaving.value = false
    }
  }
  const deleteRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.notifyTemplate.deleteConfirm', { name: row.name }),
      t('pages.system.notifyTemplate.deleteTitle'),
      { type: 'warning' }
    )
    await fetchRemoveNotifyTemplate([row.id])
    await loadData()
  }
  const deleteSelected = async () => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.notifyTemplate.deleteEmpty'))
      return
    }
    try {
      await ElMessageBox.confirm(
        t('pages.system.notifyTemplate.deleteBatchConfirm', { count: selectedRows.value.length }),
        t('pages.system.notifyTemplate.deleteTitle'),
        { type: 'warning' }
      )
    } catch {
      return
    }
    await fetchRemoveNotifyTemplate(selectedRows.value.map((row) => row.id))
    await loadData()
  }
  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .nt-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .nt-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .nt-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .nt-search {
    width: 220px;
  }

  .nt-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .nt-full {
    width: 100%;
  }
</style>
