<!-- 版本更新记录：按标题查找，版本号和类型不合法时停在表单里 -->
<template>
  <div class="changelog-page art-full-height">
    <ElCard class="art-table-card">
      <div class="cl-body">
        <div class="cl-toolbar">
          <ElInput
            v-model="keyword"
            clearable
            class="cl-search"
            :placeholder="$t('pages.system.changelog.searchPlaceholder')"
            @keyup.enter="search"
          />
          <ElButton type="primary" @click="search">{{
            $t('pages.system.changelog.search')
          }}</ElButton>
          <ElButton @click="resetSearch">{{ $t('pages.system.changelog.reset') }}</ElButton>
          <ElButton v-perm="'sys:changelog:manage'" type="primary" @click="showDialog('add')">{{
            $t('pages.system.changelog.addRecord')
          }}</ElButton>
          <ElButton v-perm="'sys:changelog:manage'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.changelog.deleteSelected')
          }}</ElButton>
        </div>

        <div class="cl-table-wrap">
          <ElTable
            v-loading="loading"
            :data="tableData"
            border
            height="100%"
            :empty-text="emptyText"
            @selection-change="onSelectionChange"
          >
            <ElTableColumn type="selection" width="48" />
            <ElTableColumn
              prop="version"
              :label="$t('pages.system.changelog.version')"
              width="110"
            />
            <ElTableColumn :label="$t('pages.system.changelog.type')" width="90">
              <template #default="{ row }">
                <ElTag :type="typeMeta(row.type).tag">{{ typeMeta(row.type).label }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="title"
              :label="$t('pages.system.changelog.title')"
              min-width="200"
              show-overflow-tooltip
            />
            <ElTableColumn :label="$t('pages.system.changelog.publishTime')" width="170">
              <template #default="{ row }">{{ formatTableTime(row.publishTime) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.changelog.colOperation')" width="140">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:changelog:manage'"
                  link
                  type="primary"
                  @click="showDialog('edit', row)"
                  >{{ $t('common.edit') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:changelog:manage'"
                  link
                  type="danger"
                  @click="deleteRow(row)"
                  >{{ $t('common.delete') }}</ElButton
                >
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <div class="cl-pager">
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
          ? $t('pages.system.changelog.editRecordTitle')
          : $t('pages.system.changelog.addRecordTitle')
      "
      width="640px"
      align-center
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="80px">
        <ElFormItem :label="$t('pages.system.changelog.version')" prop="version">
          <ElInput
            v-model="form.version"
            :placeholder="$t('pages.system.changelog.versionPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.type')" prop="type">
          <ElSelect v-model="form.type" class="cl-full">
            <ElOption
              v-for="item in TYPES"
              :key="item.value"
              :label="$t(item.label)"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.title')" prop="title">
          <ElInput
            v-model="form.title"
            maxlength="255"
            :placeholder="$t('pages.system.changelog.titlePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.publishTime')">
          <ElDatePicker
            v-model="form.publishTime"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="$t('pages.system.changelog.publishTimePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.changelog.content')">
          <ArtWangEditor v-model="form.content" height="120px" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="submitting" @click="dialogVisible = false">{{
          $t('common.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">{{
          $t('pages.system.changelog.submitBtn')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import ArtWangEditor from '@/components/core/forms/art-wang-editor/index.vue'
  import { formatTableTime } from '@/utils/date'
  import { fetchChangelogPage, fetchRemoveChangelog, fetchSaveChangelog } from '@/api/feedback'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'ChangeLog' })

  const { t } = useI18n()
  const TYPES = [
    { label: 'pages.system.changelog.typeFeature', value: 'feature', tag: 'primary' as const },
    { label: 'pages.system.changelog.typeOptimize', value: 'optimize', tag: 'warning' as const },
    { label: 'pages.system.changelog.typeFix', value: 'fix', tag: 'danger' as const }
  ]
  const typeMeta = (value: string) => {
    const hit = TYPES.find((item) => item.value === value)
    return hit ? { label: t(hit.label), tag: hit.tag } : { label: value, tag: 'info' as const }
  }

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const keyword = ref('')
  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const dialogVisible = ref(false)
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const form = reactive({
    id: undefined as string | undefined,
    version: '',
    type: 'feature',
    title: '',
    content: '',
    publishTime: ''
  })

  const emptyText = computed(() =>
    filtering.value
      ? t('pages.system.changelog.emptySearch')
      : t('pages.system.changelog.emptyList')
  )
  const rules = computed<FormRules>(() => ({
    version: [
      { required: true, message: t('pages.system.changelog.ruleVersion'), trigger: 'blur' },
      {
        pattern: /^v?\d{1,4}(\.\d{1,4}){0,3}$/,
        message: t('pages.system.changelog.ruleVersionFormat'),
        trigger: 'blur'
      }
    ],
    type: [{ required: true, message: t('pages.system.changelog.ruleType'), trigger: 'change' }],
    title: [{ required: true, message: t('pages.system.changelog.ruleTitle'), trigger: 'blur' }]
  }))

  const loadData = async () => {
    loading.value = true
    try {
      const res = await fetchChangelogPage({
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
      version: type === 'edit' ? row.version : '',
      type: type === 'edit' ? row.type : 'feature',
      title: type === 'edit' ? row.title : '',
      content: type === 'edit' ? row.content || '' : '',
      publishTime: type === 'edit' ? row.publishTime || '' : ''
    })
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const submit = async () => {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    submitting.value = true
    try {
      await fetchSaveChangelog({ ...form, publishTime: form.publishTime || null })
      dialogVisible.value = false
      await loadData()
    } finally {
      submitting.value = false
    }
  }

  const deleteRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.changelog.removeConfirm', { version: row.version, title: row.title }),
      t('pages.system.changelog.removeTitle'),
      { type: 'warning' }
    )
    await fetchRemoveChangelog([row.id])
    await loadData()
  }

  const deleteSelected = async () => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.changelog.deleteEmpty'))
      return
    }
    await ElMessageBox.confirm(
      t('pages.system.changelog.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.changelog.removeTitle'),
      { type: 'warning' }
    )
    await fetchRemoveChangelog(selectedRows.value.map((row) => row.id))
    await loadData()
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .cl-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .cl-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .cl-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .cl-search {
    width: 220px;
  }

  .cl-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .cl-full {
    width: 100%;
  }
</style>
