<!-- 在线（低代码）运行时表单：元数据驱动渲染，改配置即时生效、不生成代码 -->
<template>
  <div class="art-full-height">
    <ElCard class="art-table-card">
      <div class="online-toolbar">
        <span class="online-label">{{ $t('pages.system.onlineForm.formLabel') }}</span>
        <ElSelect
          v-model="tableId"
          filterable
          :placeholder="$t('pages.system.onlineForm.formPlaceholder')"
          style="width: 220px"
          @change="onSelect"
        >
          <ElOption
            v-for="f in forms"
            :key="f.id"
            :label="f.functionName || f.tableName"
            :value="f.id"
          />
        </ElSelect>
        <template v-for="col in queryColumns" :key="col.columnName">
          <span class="online-label">{{ col.columnComment || col.javaField }}</span>
          <!-- 查询控件按列类型渲染：数值/日期时间/字典下拉/文本 -->
          <ElInputNumber
            v-if="col.htmlType === 'number'"
            v-model="query[col.columnName]"
            :controls="false"
            :placeholder="col.columnComment || col.javaField"
            style="width: 150px"
          />
          <ElDatePicker
            v-else-if="col.htmlType === 'datetime'"
            v-model="query[col.columnName]"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="col.columnComment || col.javaField"
            style="width: 190px"
          />
          <ElSelect
            v-else-if="col.htmlType === 'select' && col.dictType"
            v-model="query[col.columnName]"
            :placeholder="col.columnComment || col.javaField"
            style="width: 150px"
            clearable
          >
            <ElOption
              v-for="opt in dictOptions(col.dictType)"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>
          <ElInput
            v-else
            v-model="query[col.columnName]"
            :placeholder="col.columnComment || col.javaField"
            style="width: 150px"
            clearable
          />
        </template>
        <ElButton v-if="tableId" type="primary" @click="reload">{{
          $t('table.searchBar.search')
        }}</ElButton>
        <ElButton v-if="tableId" v-perm="'sys:online:edit'" @click="openAdd">{{
          $t('pages.system.onlineForm.add')
        }}</ElButton>
      </div>

      <!-- 未选表单时无列可渲（只剩孤立「#」表头），以空态替代表格 -->
      <ElEmpty
        v-if="!tableId"
        :description="$t('pages.system.onlineForm.emptyDesc')"
        style="margin-top: 12px"
      />
      <!-- 表格自由增长：包一层 flex:1 定高壳内部滚动，分页器固定在壳外，防矮视口裁切 -->
      <div v-else class="online-table-wrap">
        <ElTable :data="rows" border height="100%" v-loading="loading">
          <ElTableColumn type="index" label="#" width="50" />
          <ElTableColumn
            v-for="col in listColumns"
            :key="col.columnName"
            :prop="col.columnName"
            :label="col.columnComment || col.javaField"
            min-width="140"
          >
            <template #default="{ row }">{{ formatCell(row, col) }}</template>
          </ElTableColumn>
          <ElTableColumn
            v-if="tableId"
            :label="$t('pages.system.onlineForm.colOperation')"
            width="150"
            fixed="right"
          >
            <template #default="{ row }">
              <ElButton
                v-perm="'sys:online:edit'"
                link
                type="primary"
                size="small"
                @click="openEdit(row)"
                >{{ $t('pages.system.onlineForm.edit') }}</ElButton
              >
              <ElButton
                v-perm="'sys:online:edit'"
                link
                type="danger"
                size="small"
                @click="remove(row)"
                >{{ $t('pages.system.onlineForm.remove') }}</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
      <div v-if="pagination.total > pagination.size" class="online-pager">
        <ElPagination
          background
          layout="prev, pager, next, total"
          :total="pagination.total"
          :page-size="pagination.size"
          :current-page="pagination.current"
          @current-change="onPage"
        />
      </div>

      <ElDialog
        v-if="dialogVisible"
        v-model="dialogVisible"
        :title="form.id ? $t('pages.system.onlineForm.edit') : $t('pages.system.onlineForm.add')"
        width="560px"
        align-center
        destroy-on-close
        class="online-form-dialog"
        @closed="dialogVisible = false"
      >
        <ElForm :model="form" label-width="110px">
          <ElFormItem
            v-for="col in formColumns"
            :key="col.columnName"
            :label="col.columnComment || col.javaField"
          >
            <ElInput
              v-if="col.htmlType === 'textarea'"
              v-model="form[col.columnName]"
              type="textarea"
              :rows="3"
            />
            <ElInputNumber
              v-else-if="col.htmlType === 'number'"
              v-model="form[col.columnName]"
              :controls="false"
              style="width: 100%"
            />
            <ElDatePicker
              v-else-if="col.htmlType === 'datetime'"
              v-model="form[col.columnName]"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%"
            />
            <ElSwitch
              v-else-if="col.htmlType === 'switch'"
              v-model="form[col.columnName]"
              :active-value="1"
              :inactive-value="0"
            />
            <ElSelect
              v-else-if="col.htmlType === 'select' && col.dictType"
              v-model="form[col.columnName]"
              style="width: 100%"
            >
              <ElOption
                v-for="opt in dictOptions(col.dictType)"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
            <ElInput
              v-else-if="col.htmlType === 'select'"
              v-model="form[col.columnName]"
              :placeholder="
                $t('pages.system.onlineForm.noDictPlaceholder', {
                  name: col.columnComment || col.javaField
                })
              "
            />
            <ElInput v-else v-model="form[col.columnName]" />
          </ElFormItem>
        </ElForm>
        <template #footer>
          <ElButton @click="dialogVisible = false">{{ $t('common.cancel') }}</ElButton>
          <ElButton type="primary" :loading="submitting" @click="submit">{{
            $t('table.form.submit')
          }}</ElButton>
        </template>
      </ElDialog>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onDeactivated } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchOnlineForms,
    fetchOnlineMeta,
    fetchOnlineData,
    fetchOnlineDetail,
    fetchOnlineSave,
    fetchOnlineRemove
  } from '@/api/system-manage'
  import { useDictStore } from '@/store/modules/dict'
  import { useI18n } from 'vue-i18n'
  import { formatTableTime } from '@/utils/date'

  defineOptions({ name: 'OnlineForm' })

  const { t } = useI18n()

  const dictStore = useDictStore()

  const forms = ref<any[]>([])
  const tableId = ref<any>(null)
  const columns = ref<any[]>([])
  const rows = ref<any[]>([])
  const loading = ref(false)
  const query = reactive<Record<string, any>>({})
  const pagination = reactive({ current: 1, size: 10, total: 0 })
  const dialogVisible = ref(false)
  const form = ref<Record<string, any>>({})

  const isOne = (v: any): boolean => v === 1
  const queryColumns = computed(() => columns.value.filter((c) => isOne(c.isQuery)))
  const listColumns = computed(() => columns.value.filter((c) => isOne(c.isList)))
  const formColumns = computed(() => columns.value.filter((c) => isOne(c.isEdit)))
  // select 控件字典项（无 dictType 时为空数组，select 无可选项）
  const dictOptions = (dictType?: string): Array<{ label: string; value: any }> =>
    dictType
      ? dictStore.getItems(dictType).map((it: any) => ({ label: it.dictValue, value: it.dictKey }))
      : []

  const formatCell = (row: Record<string, any>, col: any): string => {
    const v = row[col.columnName]
    if (v == null || v === '') return ''
    if (col.htmlType === 'datetime' || /time$/i.test(col.columnName)) {
      return formatTableTime(v) || String(v)
    }
    return String(v)
  }

  const closeDialogs = (): void => {
    dialogVisible.value = false
    ElMessageBox.close()
  }

  // 切换表单：重取元数据（改配置即时生效、零发布）
  const onSelect = async (): Promise<void> => {
    const meta = await fetchOnlineMeta(tableId.value)
    columns.value = meta?.columns || []
    // select 控件按元数据 dictType 拉取字典项（按需加载，store 并发去重）
    const dictCodes = columns.value
      .filter((c) => c.htmlType === 'select' && c.dictType)
      .map((c) => c.dictType)
    if (dictCodes.length) dictStore.ensure(dictCodes)
    Object.keys(query).forEach((k) => delete query[k])
    pagination.current = 1
    await load()
  }

  const load = async (): Promise<void> => {
    if (!tableId.value) return
    loading.value = true
    try {
      const res: any = await fetchOnlineData(tableId.value, {
        pageNum: pagination.current,
        pageSize: pagination.size,
        ...query
      })
      rows.value = res?.records || []
      pagination.total = res?.totalRow || 0
    } finally {
      loading.value = false
    }
  }

  const reload = (): void => {
    pagination.current = 1
    load()
  }
  const onPage = (p: number): void => {
    pagination.current = p
    load()
  }

  const openAdd = (): void => {
    form.value = {}
    dialogVisible.value = true
  }

  const openEdit = async (row: any): Promise<void> => {
    const d: any = await fetchOnlineDetail(tableId.value, row.id)
    form.value = { ...d }
    dialogVisible.value = true
  }

  const submitting = ref(false)

  const submit = async (): Promise<void> => {
    submitting.value = true
    try {
      await fetchOnlineSave(tableId.value, form.value)
      ElMessage.success(t('pages.system.onlineForm.opSuccess'))
      dialogVisible.value = false
      await load()
    } finally {
      submitting.value = false
    }
  }

  const remove = async (row: any): Promise<void> => {
    await ElMessageBox.confirm(t('pages.system.onlineForm.removeConfirm'), t('common.tips'), {
      type: 'warning'
    })
    await fetchOnlineRemove(tableId.value, [row.id])
    ElMessage.success(t('pages.system.onlineForm.removeSuccess'))
    await load()
  }

  onMounted(async () => {
    forms.value = (await fetchOnlineForms()) || []
  })
  onDeactivated(closeDialogs)
</script>

<style scoped>
  .online-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  .online-label {
    font-size: 13px;
    color: var(--art-text-gray-600);
  }

  /* 表格自由增长：卡片体改 flex 列布局 + 表格壳 flex:1 定高，
     表格 height="100%" 内部滚动，防矮视口下行与分页器被 .el-card__body 裁切不可达 */
  .art-table-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }

  .online-table-wrap {
    flex: 1;
    min-height: 0;
    margin-top: 12px;
  }

  .online-pager {
    flex-shrink: 0;
    margin-top: 12px;
    text-align: right;
  }
</style>

<!-- 编辑弹窗内容 teleport 到 body，字段数不定：非 scoped 类限定滚动（同 track-app-dialog 范式），防矮视口截断 -->
<style>
  .online-form-dialog .el-dialog__body {
    max-height: 72vh;
    overflow-y: auto;
  }
</style>
