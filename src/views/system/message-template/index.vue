<!-- 站内信模板：按标题查找，内置欢迎模板不能删 -->
<template>
  <div class="msg-template-page art-full-height">
    <ElCard class="art-table-card">
      <div class="mt-body">
        <div class="mt-toolbar">
          <ElInput
            v-model="keyword"
            clearable
            class="mt-search"
            :placeholder="$t('pages.system.messageTemplate.searchPlaceholder')"
            @keyup.enter="search"
          />
          <ElButton type="primary" @click="search">{{
            $t('pages.system.messageTemplate.search')
          }}</ElButton>
          <ElButton @click="resetSearch">{{ $t('pages.system.messageTemplate.reset') }}</ElButton>
          <ElButton v-perm="'sys:message:manage'" type="primary" @click="showDialog('add')">{{
            $t('pages.system.messageTemplate.addBtn')
          }}</ElButton>
          <ElButton v-perm="'sys:message:manage'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.messageTemplate.deleteSelected')
          }}</ElButton>
        </div>

        <div class="mt-table-wrap">
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
              :label="$t('pages.system.messageTemplate.colCode')"
              width="140"
            />
            <ElTableColumn
              prop="title"
              :label="$t('pages.system.messageTemplate.titleLabel')"
              min-width="220"
              show-overflow-tooltip
            />
            <ElTableColumn :label="$t('pages.system.messageTemplate.colOperation')" width="140">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:message:manage'"
                  link
                  type="primary"
                  @click="showDialog('edit', row)"
                  >{{ $t('common.edit') }}</ElButton
                >
                <ElButton
                  v-if="canSelect(row)"
                  v-perm="'sys:message:manage'"
                  link
                  type="danger"
                  @click="deleteRow(row)"
                  >{{ $t('common.delete') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <div class="mt-pager">
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
          ? $t('pages.system.messageTemplate.editTitle')
          : $t('pages.system.messageTemplate.addBtn')
      "
      width="560px"
      align-center
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="80px">
        <ElFormItem :label="$t('pages.system.messageTemplate.codeLabel')" prop="code">
          <ElInput
            v-model="form.code"
            :disabled="!!form.id"
            :placeholder="$t('pages.system.messageTemplate.codePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.messageTemplate.titleLabel')" prop="title">
          <ElInput
            v-model="form.title"
            maxlength="255"
            :placeholder="$t('pages.system.messageTemplate.titlePlaceholder', { name: '{name}' })"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.messageTemplate.contentLabel')" prop="content">
          <ElInput
            v-model="form.content"
            type="textarea"
            :rows="4"
            maxlength="20000"
            :placeholder="
              $t('pages.system.messageTemplate.contentPlaceholder', {
                name: '{name}',
                role: '{role}'
              })
            "
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="dialogSaving" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="dialogSaving" @click="submit">{{
          $t('pages.system.messageTemplate.submitBtn')
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
  import { fetchMsgTemplatePage, fetchRemoveMsgTemplate, fetchSaveMsgTemplate } from '@/api/message'

  defineOptions({ name: 'MessageTemplate' })

  const { t } = useI18n()
  const BUILTIN = new Set(['welcome'])
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
  const form = reactive({ id: undefined as string | undefined, code: '', title: '', content: '' })

  const emptyText = computed(() =>
    filtering.value
      ? t('pages.system.messageTemplate.emptySearch')
      : t('pages.system.messageTemplate.emptyList')
  )
  const canSelect = (row: { code?: string }) => !BUILTIN.has(row.code || '')
  const rules = computed<FormRules>(() => ({
    code: [
      { required: true, message: t('pages.system.messageTemplate.ruleCode'), trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]{0,63}$/,
        message: t('pages.system.messageTemplate.ruleCodeFormat'),
        trigger: 'blur'
      }
    ],
    title: [
      { required: true, message: t('pages.system.messageTemplate.ruleTitle'), trigger: 'blur' }
    ]
  }))

  const loadData = async () => {
    loading.value = true
    try {
      const res = await fetchMsgTemplatePage({
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
      title: type === 'edit' ? row.title : '',
      content: type === 'edit' ? row.content || '' : ''
    })
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const submit = async () => {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    dialogSaving.value = true
    try {
      await fetchSaveMsgTemplate({ ...form })
      dialogVisible.value = false
      await loadData()
    } finally {
      dialogSaving.value = false
    }
  }

  const deleteRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.messageTemplate.deleteConfirm', { name: row.title }),
      t('pages.system.messageTemplate.deleteTitle'),
      { type: 'warning' }
    )
    await fetchRemoveMsgTemplate([row.id])
    await loadData()
  }

  const deleteSelected = async () => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.messageTemplate.deleteEmpty'))
      return
    }
    await ElMessageBox.confirm(
      t('pages.system.messageTemplate.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.messageTemplate.deleteTitle'),
      { type: 'warning' }
    )
    await fetchRemoveMsgTemplate(selectedRows.value.map((row) => row.id))
    await loadData()
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .mt-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .mt-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .mt-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .mt-search {
    width: 220px;
  }

  .mt-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
