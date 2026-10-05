<!-- 字典树 CRUD 通用视图（系统字典 / 业务字典共用，通过 api 注入） -->
<template>
  <div class="dict-page art-full-height">
    <!-- 查询栏：条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <div class="dict-toolbar">
        <ElButton v-perm="permPrefix + ':save'" @click="showDialog('add')" v-ripple>{{
          $t('pages.system.dict.addDict')
        }}</ElButton>
        <ElButton v-perm="permPrefix + ':remove'" type="danger" plain @click="deleteSelected">{{
          $t('pages.system.dict.deleteSelectedBtn')
        }}</ElButton>
      </div>

      <ElTable
        ref="tableRef"
        v-loading="loading"
        :data="treeData"
        row-key="id"
        default-expand-all
        border
      >
        <template #empty>
          <span>{{ emptyText }}</span>
        </template>
        <ElTableColumn type="selection" width="48" />
        <ElTableColumn
          prop="dictValue"
          :label="$t('pages.system.dict.fields.dictValue')"
          min-width="140"
        />
        <ElTableColumn prop="code" :label="$t('pages.system.dict.fields.code')" min-width="120" />
        <ElTableColumn
          prop="dictKey"
          :label="$t('pages.system.dict.fields.dictKey')"
          min-width="100"
        />
        <ElTableColumn prop="sort" :label="$t('pages.system.dict.fields.sort')" width="72" />
        <ElTableColumn :label="$t('pages.system.dict.fields.sealed')" width="88">
          <template #default="{ row }">
            <ElTag v-if="row.isSealed === 1" type="info">{{
              $t('pages.system.dict.sealedYes')
            }}</ElTag>
            <span v-else>{{ $t('pages.system.dict.sealedNo') }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.dict.fields.tag')" width="88">
          <template #default="{ row }">
            <ElTag v-if="row.color" :color="row.color" effect="dark" disable-transitions>
              {{ row.dictValue }}
            </ElTag>
            <span v-else>—</span>
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="remark"
          :label="$t('pages.system.dict.fields.remark')"
          min-width="100"
          show-overflow-tooltip
        />
        <ElTableColumn :label="$t('pages.system.dict.fields.operation')" width="196">
          <template #default="{ row }">
            <ElButton
              v-perm="permPrefix + ':save'"
              link
              type="primary"
              @click="showDialog('add', row)"
              >{{ $t('pages.system.dict.addChild') }}</ElButton
            >
            <ElButton
              v-perm="permPrefix + ':save'"
              link
              type="primary"
              @click="showDialog('edit', row)"
              >{{ $t('pages.system.dict.edit') }}</ElButton
            >
            <ElButton v-perm="permPrefix + ':remove'" link type="danger" @click="deleteRow(row)">{{
              $t('pages.system.dict.delete')
            }}</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElDialog
        v-model="dialogVisible"
        :title="
          dialogType === 'add' ? $t('pages.system.dict.addDict') : $t('pages.system.dict.editDict')
        "
        width="500px"
        align-center
      >
        <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
          <ElFormItem :label="$t('pages.system.dict.fields.parent')" prop="parentId">
            <ElSelect v-model="formData.parentId" style="width: 100%">
              <ElOption :label="$t('pages.system.dict.topDict')" :value="0" />
              <ElOption
                v-for="opt in topOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.code')" prop="code">
            <ElInput
              v-model="formData.code"
              :disabled="dialogType === 'edit'"
              :placeholder="$t('pages.system.dict.placeholder.codeExample')"
            />
            <div v-if="dialogType === 'edit'" class="field-hint">{{
              $t('pages.system.dict.codeLocked')
            }}</div>
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.dictValue')" prop="dictValue">
            <ElInput
              v-model="formData.dictValue"
              :placeholder="$t('pages.system.dict.placeholder.valueExample')"
            />
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.dictKey')" prop="dictKey">
            <ElInput
              v-model="formData.dictKey"
              :disabled="dialogType === 'edit'"
              :placeholder="$t('pages.system.dict.placeholder.keyExample')"
            />
            <div v-if="dialogType === 'edit'" class="field-hint">{{
              $t('pages.system.dict.keyLocked')
            }}</div>
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.sealed')">
            <ElSwitch v-model="formData.isSealed" :active-value="1" :inactive-value="0" />
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.sort')" prop="sort">
            <ElInputNumber v-model="formData.sort" :min="0" />
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.color')" prop="color">
            <ElColorPicker
              v-model="formData.color"
              :predefine="['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399']"
            />
          </ElFormItem>
          <ElFormItem :label="$t('pages.system.dict.fields.remark')" prop="remark">
            <ElInput
              v-model="formData.remark"
              :placeholder="$t('pages.system.dict.placeholder.remark')"
            />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <div class="dialog-footer">
            <ElButton :disabled="dialogSaving" @click="dialogVisible = false">{{
              $t('common.cancel')
            }}</ElButton>
            <ElButton type="primary" :loading="dialogSaving" @click="handleSubmit">{{
              $t('table.form.submit')
            }}</ElButton>
          </div>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessageBox, ElMessage } from 'element-plus'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useDictStore } from '@/store/modules/dict'
  import type { ElTable } from 'element-plus'

  interface Props {
    treeApi: (params?: Record<string, any>) => Promise<any[]>
    saveApi: (data: Record<string, any>) => Promise<any>
    removeApi: (id: any) => Promise<any>
    /** 权限码前缀（sys:dict / sys:dict-biz），按钮门控拼接 :save/:remove */
    permPrefix?: string
  }

  const props = withDefaults(defineProps<Props>(), { permPrefix: 'sys:dict' })

  const { t } = useI18n()

  const dictStore = useDictStore()

  // ===== 查询栏 =====
  const searchForm = ref({
    dictValue: '',
    code: ''
  })
  const searchItems = [
    {
      key: 'dictValue',
      label: t('pages.system.dict.fields.dictValue'),
      type: 'input',
      props: { placeholder: t('pages.system.dict.placeholder.dictValue'), clearable: true }
    },
    {
      key: 'code',
      label: t('pages.system.dict.fields.code'),
      type: 'input',
      props: { placeholder: t('pages.system.dict.placeholder.code'), clearable: true }
    }
  ]
  // 当前生效的查询条件（保存/删除后重载保持过滤态，与用户页 refreshData 口径一致）
  const searchParams = ref<Record<string, any>>({})

  const treeData = ref<any[]>([])
  const loading = ref(false)
  const tableRef = ref<InstanceType<typeof ElTable>>()
  const emptyText = computed(() => {
    const filtering = !!(searchParams.value.code || searchParams.value.dictValue)
    return filtering ? t('pages.system.dict.emptySearch') : t('pages.system.dict.emptyList')
  })
  const topOptions = ref<Array<{ label: string; value: any }>>([])
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const dialogSaving = ref(false)
  const formRef = ref<FormInstance>()

  const defaultForm = () => ({
    id: undefined,
    parentId: 0 as number | string,
    code: '',
    dictValue: '',
    dictKey: '',
    sort: 0,
    remark: '',
    color: '',
    isSealed: 0
  })

  const formData = reactive<Record<string, any>>(defaultForm())

  const rules = computed<FormRules>(() => ({
    dictValue: [
      { required: true, message: t('pages.system.dict.placeholder.dictValue'), trigger: 'blur' }
    ],
    code: [{ required: true, message: t('pages.system.dict.placeholder.code'), trigger: 'blur' }],
    dictKey: [
      {
        validator: (_rule, value, callback) => {
          const parent = formData.parentId
          const top = parent === 0 || parent === '0' || parent === '' || parent == null
          if (!top && (value == null || String(value).trim() === '')) {
            callback(new Error(t('pages.system.dict.keyRequired')))
            return
          }
          callback()
        },
        trigger: 'blur'
      }
    ]
  }))

  const loadData = async (): Promise<void> => {
    loading.value = true
    try {
      treeData.value = (await props.treeApi(searchParams.value)) || []
    } finally {
      loading.value = false
    }
  }

  // 上级候选恒取全量顶级类型（不受查询过滤影响）
  const loadTopOptions = async (): Promise<void> => {
    const full = (await props.treeApi()) || []
    topOptions.value = full.map((node: any) => ({
      label: node.dictValue || node.code,
      value: node.id
    }))
  }

  onMounted(() => {
    loadData()
    loadTopOptions()
  })

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    searchParams.value = { ...params }
    await loadData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      dictValue: '',
      code: ''
    }
    searchParams.value = {}
    await loadData()
  }

  const showDialog = (type: 'add' | 'edit', row?: Record<string, any>): void => {
    dialogType.value = type
    const next =
      type === 'add' ? { parentId: row?.id ?? 0, code: row?.code ?? '' } : { ...(row || {}) }
    if (next.parentId === '0' || next.parentId === 0) next.parentId = 0
    if (next.isSealed == null) next.isSealed = 0
    Object.assign(formData, defaultForm(), next)
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  const handleSubmit = async (): Promise<void> => {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      dialogSaving.value = true
      try {
        await props.saveApi({ ...formData, color: formData.color || '' })
        dialogVisible.value = false
        ElMessage.success(t('pages.system.dict.saveSuccess'))
        // 字典维护变更后重载运行时缓存，业务页即时生效
        if (formData.code) dictStore.reload(formData.code)
        loadTopOptions()
        loadData()
      } finally {
        dialogSaving.value = false
      }
    })
  }

  const afterRemove = (codes: string[]): void => {
    ElMessage.success(t('pages.system.dict.deleteSuccess'))
    codes.forEach((code) => {
      if (code) dictStore.reload(code)
    })
    loadTopOptions()
    loadData()
  }

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.dict.deleteConfirm', { name: row.dictValue }),
      t('pages.system.dict.deleteDict'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await props.removeApi(row.id)
        afterRemove([row.code])
      })
      .catch(() => {})
  }

  const deleteSelected = (): void => {
    const rows = tableRef.value?.getSelectionRows?.() || []
    if (!rows.length) {
      ElMessage.warning(t('pages.system.dict.deleteEmpty'))
      return
    }
    ElMessageBox.confirm(
      t('pages.system.dict.deleteBatchConfirm', { count: rows.length }),
      t('pages.system.dict.deleteDict'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
      .then(async () => {
        await props.removeApi(rows.map((row: any) => row.id))
        afterRemove(rows.map((row: any) => row.code))
      })
      .catch(() => {})
  }
</script>

<style scoped>
  /* 树表为自由增长内容：art-full-height 定高 + art-table-card 卡体 overflow:hidden 裁剪，
     卡片取消 flex 拉伸随内容增高、页面自备纵向滚动（track/funnel 同款范式），矮视口下行不被切断 */
  .dict-page {
    overflow-y: auto;
  }

  .dict-page .art-table-card {
    flex: none;
  }

  .dict-toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .field-hint {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
  }
</style>
