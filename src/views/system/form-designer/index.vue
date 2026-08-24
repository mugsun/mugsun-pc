<!-- 低代码表单：设计（form-create 设计器）→ 保存 schema → 运行时渲染填报 → 数据落库 -->
<template>
  <div class="form-page art-full-height">
    <ElCard class="art-table-card">
      <div class="form-toolbar">
        <ElButton v-perm="'sys:form:save'" type="primary" @click="showCreate">{{
          $t('pages.system.formDesigner.createForm')
        }}</ElButton>
      </div>

      <!-- 表格自由增长（一页 50 条）：包一层 flex:1 定高壳内部滚动，防矮视口裁切 -->
      <div class="form-table-wrap">
        <ElTable :data="tableData" border height="100%" v-loading="loading">
          <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
          <ElTableColumn
            prop="name"
            :label="$t('pages.system.formDesigner.formName')"
            min-width="150"
          />
          <ElTableColumn
            prop="formKey"
            :label="$t('pages.system.formDesigner.formKey')"
            min-width="150"
          />
          <ElTableColumn :label="$t('pages.system.formDesigner.status')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.status === 1 ? 'success' : 'info'">
                {{
                  row.status === 1
                    ? $t('pages.system.formDesigner.enable')
                    : $t('pages.system.formDesigner.disable')
                }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="remark"
            :label="$t('pages.system.formDesigner.remark')"
            min-width="140"
            show-overflow-tooltip
          />
          <ElTableColumn
            :label="$t('pages.system.formDesigner.colOperation')"
            width="280"
            fixed="right"
          >
            <template #default="{ row }">
              <ElButton v-perm="'sys:form:save'" link type="primary" @click="openDesigner(row)">{{
                $t('pages.system.formDesigner.design')
              }}</ElButton>
              <ElButton link type="success" @click="openFill(row)">{{
                $t('pages.system.formDesigner.fill')
              }}</ElButton>
              <ElButton link type="warning" @click="openRecords(row)">{{
                $t('pages.system.formDesigner.records')
              }}</ElButton>
              <ElButton v-perm="'sys:form:remove'" link type="danger" @click="remove(row)">{{
                $t('pages.system.formDesigner.remove')
              }}</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </ElCard>

    <!-- 新建表单 -->
    <ElDialog
      v-model="createVisible"
      :title="$t('pages.system.formDesigner.createForm')"
      width="500px"
      align-center
    >
      <ElForm ref="createRef" :model="createForm" :rules="createRules" label-width="90px">
        <ElFormItem :label="$t('pages.system.formDesigner.formName')" prop="name">
          <ElInput
            v-model="createForm.name"
            :placeholder="$t('pages.system.formDesigner.formNamePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.formDesigner.formKey')" prop="formKey">
          <ElInput
            v-model="createForm.formKey"
            :placeholder="$t('pages.system.formDesigner.formKeyPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.formDesigner.remark')">
          <ElInput
            v-model="createForm.remark"
            type="textarea"
            :placeholder="$t('pages.system.formDesigner.remark')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="createVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="creating" @click="submitCreate">{{
          $t('pages.system.formDesigner.createAndDesign')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 设计器 -->
    <ElDialog
      v-model="designerVisible"
      :title="$t('pages.system.formDesigner.designerTitle', { name: current?.name || '' })"
      fullscreen
      :destroy-on-close="true"
    >
      <FcDesigner v-if="designerVisible" ref="designerRef" height="calc(100vh - 140px)" />
      <template #footer>
        <ElButton @click="designerVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="designSaving" @click="saveDesign">{{
          $t('pages.system.formDesigner.saveDesign')
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 填报（运行时渲染） -->
    <ElDialog
      v-model="fillVisible"
      :title="$t('pages.system.formDesigner.fillTitle', { name: current?.name || '' })"
      width="720px"
      align-center
      class="form-fill-dialog"
      :destroy-on-close="true"
    >
      <div v-if="fillEmpty" class="form-empty">{{ $t('pages.system.formDesigner.fillEmpty') }}</div>
      <FormCreate
        v-else-if="fillVisible"
        v-model:api="fApi"
        :rule="fillRule"
        :option="fillOption"
        @submit="onFillSubmit"
      />
    </ElDialog>

    <!-- 填报记录 -->
    <ElDialog
      v-model="recordsVisible"
      :title="$t('pages.system.formDesigner.recordsTitle', { name: current?.name || '' })"
      width="720px"
      align-center
    >
      <ElTable :data="records" border max-height="420">
        <ElTableColumn type="index" :label="$t('table.column.index')" width="60" />
        <ElTableColumn :label="$t('pages.system.formDesigner.recordData')" min-width="360">
          <template #default="{ row }">
            <pre class="form-data-cell">{{ prettyData(row.formData) }}</pre>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="submitter"
          :label="$t('pages.system.formDesigner.submitter')"
          width="170"
        />
        <ElTableColumn
          prop="createTime"
          :label="$t('pages.system.formDesigner.time')"
          min-width="170"
        />
      </ElTable>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, nextTick } from 'vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import formCreate from '@form-create/element-ui'
  import {
    fetchFormPage,
    fetchFormDetail,
    fetchSubmitForm,
    fetchRemoveForm,
    fetchSubmitFormData,
    fetchFormData
  } from '@/api/form'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'FormDesigner' })

  const { t } = useI18n()

  const tableData = ref<any[]>([])
  const loading = ref(false)
  const current = ref<any>(null)

  // 新建
  const createVisible = ref(false)
  const createRef = ref<FormInstance>()
  const createForm = reactive<Record<string, any>>({ name: '', formKey: '', remark: '' })
  const createRules: FormRules = {
    name: [
      {
        required: true,
        message: t('pages.system.formDesigner.formNamePlaceholder'),
        trigger: 'blur'
      }
    ],
    formKey: [
      { required: true, message: t('pages.system.formDesigner.formKeyRequired'), trigger: 'blur' },
      {
        pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
        message: t('pages.system.formDesigner.formKeyPattern'),
        trigger: 'blur'
      }
    ]
  }

  // 设计器
  const designerVisible = ref(false)
  const designerRef = ref<any>()

  // 填报
  const fillVisible = ref(false)
  const fillEmpty = ref(false)
  const fillRule = ref<any[]>([])
  const fillOption = ref<Record<string, any>>({})
  const fApi = ref<any>()

  // 记录
  const recordsVisible = ref(false)
  const records = ref<any[]>([])

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      const resp = await fetchFormPage({ pageNum: 1, pageSize: 50 })
      tableData.value = resp?.records ?? []
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)

  const showCreate = (): void => {
    Object.assign(createForm, { name: '', formKey: '', remark: '' })
    createVisible.value = true
  }

  const creating = ref(false)

  const submitCreate = async (): Promise<void> => {
    if (!createRef.value || creating.value) return
    await createRef.value.validate(async (valid) => {
      if (!valid) return
      creating.value = true
      try {
        await fetchSubmitForm({ ...createForm, status: 1 })
        ElMessage.success(t('pages.system.formDesigner.createSuccess'))
        createVisible.value = false
        await loadData()
        // 直接进入设计
        const row = tableData.value.find((f) => f.formKey === createForm.formKey)
        if (row) openDesigner(row)
      } finally {
        creating.value = false
      }
    })
  }

  const openDesigner = async (row: any): Promise<void> => {
    current.value = row
    designerVisible.value = true
    const detail = await fetchFormDetail(row.id)
    await nextTick()
    // 回显已有设计
    if (detail?.formSchema) {
      try {
        designerRef.value?.setRule(formCreate.parseJson(detail.formSchema))
        if (detail.formOption) designerRef.value?.setOption(JSON.parse(detail.formOption))
      } catch (e) {
        console.warn('表单设计回显失败', e)
      }
    }
  }

  const designSaving = ref(false)

  const saveDesign = async (): Promise<void> => {
    if (!current.value || !designerRef.value || designSaving.value) return
    designSaving.value = true
    try {
      const rule = designerRef.value.getJson() // 规则 JSON 字符串
      const option = JSON.stringify(designerRef.value.getOption())
      await fetchSubmitForm({
        id: current.value.id,
        name: current.value.name,
        formKey: current.value.formKey,
        formSchema: rule,
        formOption: option,
        status: current.value.status ?? 1,
        remark: current.value.remark
      })
      ElMessage.success(t('pages.system.formDesigner.designSaved'))
      designerVisible.value = false
      loadData()
    } finally {
      designSaving.value = false
    }
  }

  const openFill = async (row: any): Promise<void> => {
    current.value = row
    const detail = await fetchFormDetail(row.id)
    if (!detail?.formSchema) {
      fillEmpty.value = true
      fillVisible.value = true
      return
    }
    fillEmpty.value = false
    fillRule.value = formCreate.parseJson(detail.formSchema)
    const opt = detail.formOption ? JSON.parse(detail.formOption) : {}
    opt.submitBtn = opt.submitBtn ?? { show: true, innerText: t('table.form.submit') }
    fillOption.value = opt
    fillVisible.value = true
  }

  const onFillSubmit = async (formData: Record<string, any>): Promise<void> => {
    await fetchSubmitFormData(current.value.formKey, formData)
    ElMessage.success(t('pages.system.formDesigner.submitSuccess'))
    fillVisible.value = false
  }

  const openRecords = async (row: any): Promise<void> => {
    current.value = row
    const resp = await fetchFormData(row.formKey, { pageNum: 1, pageSize: 50 })
    records.value = resp?.records ?? []
    recordsVisible.value = true
  }

  const prettyData = (data: string): string => {
    try {
      return JSON.stringify(JSON.parse(data), null, 2)
    } catch {
      return data
    }
  }

  const remove = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.formDesigner.removeConfirm', { name: row.name }),
      t('pages.system.formDesigner.removeTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveForm(row.id)
      ElMessage.success(t('pages.system.formDesigner.removeSuccess'))
      loadData()
    })
  }
</script>

<style scoped>
  .form-toolbar {
    margin-bottom: 12px;
  }

  .form-empty {
    padding: 40px 0;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .form-data-cell {
    margin: 0;
    font-size: 12px;
    word-break: break-all;
    white-space: pre-wrap;
  }

  /* 表格自由增长：卡片体改 flex 列布局 + 表格壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .form-table-wrap {
    flex: 1;
    min-height: 0;
  }
</style>

<!-- 填报弹窗内容 teleport 到 body，表单字段数不定：非 scoped 类限定滚动（同 track-app-dialog 范式），防矮视口截断 -->
<style>
  .form-fill-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
