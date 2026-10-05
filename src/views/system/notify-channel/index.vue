<!-- 通知渠道：按名称查找，内置站内信、邮件、短信不能删 -->
<template>
  <div class="notify-channel-page art-full-height">
    <ElCard class="art-table-card">
      <div class="nc-body">
        <div class="nc-toolbar">
          <ElInput
            v-model="keyword"
            clearable
            class="nc-search"
            :placeholder="$t('pages.system.notifyChannel.searchPlaceholder')"
            @keyup.enter="search"
          />
          <ElButton type="primary" @click="search">{{
            $t('pages.system.notifyChannel.search')
          }}</ElButton>
          <ElButton @click="resetSearch">{{ $t('pages.system.notifyChannel.reset') }}</ElButton>
          <ElButton v-perm="'sys:notify-channel:save'" type="primary" @click="showDialog('add')">{{
            $t('pages.system.notifyChannel.addBtn')
          }}</ElButton>
          <ElButton
            v-perm="'sys:notify-channel:remove'"
            type="danger"
            plain
            @click="deleteSelected"
            >{{ $t('pages.system.notifyChannel.deleteSelected') }}</ElButton
          >
        </div>
        <div class="nc-table-wrap">
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
              prop="channel"
              :label="$t('pages.system.notifyChannel.colChannel')"
              width="120"
            />
            <ElTableColumn
              prop="name"
              :label="$t('pages.system.notifyChannel.colName')"
              min-width="160"
            />
            <ElTableColumn :label="$t('pages.system.notifyChannel.colStatus')" width="100">
              <template #default="{ row }">
                <ElTag :type="row.status === 1 ? 'success' : 'info'">
                  {{
                    row.status === 1
                      ? $t('pages.system.notifyChannel.statusOn')
                      : $t('pages.system.notifyChannel.statusOff')
                  }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.notifyChannel.colOperation')" width="120">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:notify-channel:save'"
                  link
                  type="primary"
                  @click="showDialog('edit', row)"
                  >{{ $t('common.edit') }}</ElButton
                >
                <ElButton
                  v-if="canSelect(row)"
                  v-perm="'sys:notify-channel:remove'"
                  link
                  type="danger"
                  @click="deleteRow(row)"
                  >{{ $t('common.delete') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
        <div class="nc-pager">
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
          ? $t('pages.system.notifyChannel.editTitle')
          : $t('pages.system.notifyChannel.addBtn')
      "
      width="560px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="80px">
        <ElFormItem :label="$t('pages.system.notifyChannel.colChannel')" prop="channel">
          <ElSelect v-model="form.channel" :disabled="!!form.id" class="nc-full">
            <ElOption value="in_app" :label="$t('pages.system.notifyChannel.inApp')" />
            <ElOption value="mail" :label="$t('pages.system.notifyChannel.mail')" />
            <ElOption value="sms" :label="$t('pages.system.notifyChannel.sms')" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyChannel.colName')" prop="name">
          <ElInput v-model="form.name" maxlength="64" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyChannel.colStatus')" prop="status">
          <ElSelect v-model="form.status" class="nc-full">
            <ElOption :value="1" :label="$t('pages.system.notifyChannel.statusOn')" />
            <ElOption :value="0" :label="$t('pages.system.notifyChannel.statusOff')" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyChannel.configLabel')">
          <ElInput
            v-model="form.config"
            type="textarea"
            :rows="3"
            :placeholder="$t('pages.system.notifyChannel.configPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyChannel.secretLabel')">
          <ElInput
            v-model="form.secret"
            type="password"
            show-password
            :placeholder="$t('pages.system.notifyChannel.secretPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.notifyChannel.remarkLabel')">
          <ElInput v-model="form.remark" maxlength="255" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('pages.system.notifyChannel.submitBtn')
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
    fetchNotifyChannelPage,
    fetchRemoveNotifyChannel,
    fetchSaveNotifyChannel
  } from '@/api/notify'

  defineOptions({ name: 'NotifyChannel' })

  const { t } = useI18n()
  const BUILTIN = new Set(['in_app', 'mail', 'sms'])
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
    channel: 'in_app',
    name: '',
    status: 1,
    config: '',
    secret: '',
    remark: ''
  })
  const emptyText = computed(() =>
    filtering.value
      ? t('pages.system.notifyChannel.emptySearch')
      : t('pages.system.notifyChannel.emptyList')
  )
  const canSelect = (row: { channel?: string }) => !BUILTIN.has(row.channel || '')
  const rules = computed<FormRules>(() => ({
    channel: [
      { required: true, message: t('pages.system.notifyChannel.ruleChannel'), trigger: 'change' }
    ],
    name: [{ required: true, message: t('pages.system.notifyChannel.ruleName'), trigger: 'blur' }],
    status: [
      { required: true, message: t('pages.system.notifyChannel.ruleStatus'), trigger: 'change' }
    ]
  }))

  const loadData = async () => {
    loading.value = true
    try {
      const res = await fetchNotifyChannelPage({
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
      channel: type === 'edit' ? row.channel : 'mail',
      name: type === 'edit' ? row.name : '',
      status: type === 'edit' ? row.status : 0,
      config: type === 'edit' ? row.config || '' : '',
      secret: '',
      remark: type === 'edit' ? row.remark || '' : ''
    })
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  const submit = async () => {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    dialogSaving.value = true
    try {
      await fetchSaveNotifyChannel({ ...form, secret: form.secret || undefined })
      dialogVisible.value = false
      await loadData()
    } finally {
      dialogSaving.value = false
    }
  }
  const deleteRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.notifyChannel.deleteConfirm', { name: row.name }),
      t('pages.system.notifyChannel.deleteTitle'),
      { type: 'warning' }
    )
    await fetchRemoveNotifyChannel([row.id])
    await loadData()
  }
  const deleteSelected = async () => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.notifyChannel.deleteEmpty'))
      return
    }
    try {
      await ElMessageBox.confirm(
        t('pages.system.notifyChannel.deleteBatchConfirm', { count: selectedRows.value.length }),
        t('pages.system.notifyChannel.deleteTitle'),
        { type: 'warning' }
      )
    } catch {
      return
    }
    await fetchRemoveNotifyChannel(selectedRows.value.map((row) => row.id))
    await loadData()
  }
  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .nc-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .nc-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .nc-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .nc-search {
    width: 220px;
  }

  .nc-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .nc-full {
    width: 100%;
  }
</style>
