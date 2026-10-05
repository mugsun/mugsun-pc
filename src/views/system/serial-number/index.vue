<!-- 单号规则：维护格式并生成编号 -->
<template>
  <div class="serial-number-page art-full-height">
    <ElCard class="art-table-card">
      <div class="sn-body">
        <div class="sn-toolbar">
          <ElInput
            v-model="keyword"
            clearable
            class="sn-search"
            :placeholder="$t('pages.system.serialNumber.searchPlaceholder')"
            @keyup.enter="search"
          />
          <ElButton type="primary" @click="search">{{
            $t('pages.system.serialNumber.search')
          }}</ElButton>
          <ElButton @click="resetSearch">{{ $t('pages.system.serialNumber.reset') }}</ElButton>
          <ElButton v-perm="'sys:serial:save'" type="primary" @click="showDialog('add')">{{
            $t('pages.system.serialNumber.addBtn')
          }}</ElButton>
          <ElButton v-perm="'sys:serial:remove'" type="danger" plain @click="deleteSelected">{{
            $t('pages.system.serialNumber.deleteSelected')
          }}</ElButton>
        </div>

        <div class="sn-table-wrap">
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
              prop="code"
              :label="$t('pages.system.serialNumber.colCode')"
              width="120"
            />
            <ElTableColumn
              prop="businessName"
              :label="$t('pages.system.serialNumber.colName')"
              min-width="140"
              show-overflow-tooltip
            />
            <ElTableColumn
              prop="format"
              :label="$t('pages.system.serialNumber.colFormat')"
              min-width="180"
              show-overflow-tooltip
            />
            <ElTableColumn :label="$t('pages.system.serialNumber.colRule')" width="90">
              <template #default="{ row }">{{ ruleLabel(row.ruleType) }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.serialNumber.colLast')" width="110">
              <template #default="{ row }">{{ row.lastNumber ?? '—' }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('pages.system.serialNumber.colOperation')" width="230">
              <template #default="{ row }">
                <ElButton
                  v-perm="'sys:serial:save'"
                  link
                  type="primary"
                  @click="showDialog('edit', row)"
                  >{{ $t('pages.system.serialNumber.editBtn') }}</ElButton
                >
                <ElButton
                  v-perm="'sys:serial:generate'"
                  link
                  type="success"
                  @click="generate(row)"
                  >{{ $t('pages.system.serialNumber.generateBtn') }}</ElButton
                >
                <ElButton v-perm="'sys:serial:list'" link @click="openRecords(row)">{{
                  $t('pages.system.serialNumber.recordBtn')
                }}</ElButton>
                <ElButton v-perm="'sys:serial:remove'" link type="danger" @click="deleteRow(row)">{{
                  $t('pages.system.serialNumber.deleteBtn')
                }}</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>

        <div class="sn-pager">
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

      <SerialNumberDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :rule-data="currentData"
        :saving="dialogSaving"
        @submit="handleDialogSubmit"
      />
    </ElCard>

    <ElDrawer v-model="recordVisible" :title="recordTitle" size="420px">
      <ElTable :data="records" :empty-text="$t('pages.system.serialNumber.recordEmpty')">
        <ElTableColumn
          prop="recordDate"
          :label="$t('pages.system.serialNumber.colDate')"
          min-width="120"
        />
        <ElTableColumn
          prop="genCount"
          :label="$t('pages.system.serialNumber.colCount')"
          width="100"
        />
        <ElTableColumn
          prop="lastNumber"
          :label="$t('pages.system.serialNumber.colLast')"
          width="120"
        />
      </ElTable>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import {
    fetchGenerateSerialNumber,
    fetchRemoveSerialNumber,
    fetchSaveSerialNumber,
    fetchSerialNumberPage,
    fetchSerialNumberRecords
  } from '@/api/system-manage'
  import SerialNumberDialog from './modules/serial-number-dialog.vue'

  defineOptions({ name: 'SerialNumber' })

  const { t } = useI18n()
  const tableData = ref<any[]>([])
  const loading = ref(false)
  const keyword = ref('')
  const filtering = ref(false)
  const selectedRows = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(10)
  const total = ref(0)
  const dialogType = ref<'add' | 'edit'>('add')
  const dialogVisible = ref(false)
  const dialogSaving = ref(false)
  const currentData = ref<Record<string, any>>({})
  const recordVisible = ref(false)
  const recordTitle = ref('')
  const records = ref<any[]>([])

  const emptyText = computed(() =>
    filtering.value
      ? t('pages.system.serialNumber.emptySearch')
      : t('pages.system.serialNumber.emptyList')
  )

  const ruleLabel = (type: string) => {
    if (type === 'year') return t('pages.system.serialNumber.ruleYear')
    if (type === 'month') return t('pages.system.serialNumber.ruleMonth')
    if (type === 'day') return t('pages.system.serialNumber.ruleDay')
    return t('pages.system.serialNumber.ruleNone')
  }

  const loadData = async () => {
    loading.value = true
    try {
      const res = await fetchSerialNumberPage({
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
    dialogType.value = type
    currentData.value = row ? { ...row } : {}
    dialogVisible.value = true
  }

  const handleDialogSubmit = async (form: Record<string, any>) => {
    dialogSaving.value = true
    try {
      await fetchSaveSerialNumber(form)
      dialogVisible.value = false
      await loadData()
    } finally {
      dialogSaving.value = false
    }
  }

  const deleteRow = async (row: any) => {
    await ElMessageBox.confirm(
      t('pages.system.serialNumber.deleteConfirm', { name: row.businessName }),
      t('pages.system.serialNumber.deleteTitle'),
      { type: 'warning' }
    )
    await fetchRemoveSerialNumber(row.id)
    await loadData()
  }

  const deleteSelected = async () => {
    if (!selectedRows.value.length) {
      ElMessage.warning(t('pages.system.serialNumber.deleteEmpty'))
      return
    }
    await ElMessageBox.confirm(
      t('pages.system.serialNumber.deleteBatchConfirm', { count: selectedRows.value.length }),
      t('pages.system.serialNumber.deleteTitle'),
      { type: 'warning' }
    )
    await fetchRemoveSerialNumber(selectedRows.value.map((row) => row.id))
    await loadData()
  }

  const generate = async (row: any) => {
    const { value } = await ElMessageBox.prompt(
      t('pages.system.serialNumber.generatePrompt'),
      t('pages.system.serialNumber.generateTitle'),
      {
        inputValue: '1',
        inputPattern: /^([1-9]\d{0,2}|1000)$/,
        inputErrorMessage: t('pages.system.serialNumber.generateInvalid'),
        confirmButtonText: t('pages.system.serialNumber.generateBtn'),
        cancelButtonText: t('common.cancel')
      }
    )
    const numbers = await fetchGenerateSerialNumber(row.code, Number(value))
    await ElMessageBox.alert(
      (numbers || []).join('\n'),
      t('pages.system.serialNumber.generateTitle')
    )
    await loadData()
  }

  const openRecords = async (row: any) => {
    recordTitle.value = `${t('pages.system.serialNumber.recordTitle')} · ${row.code}`
    const res = await fetchSerialNumberRecords({ pageNum: 1, pageSize: 20, code: row.code })
    records.value = res?.records || []
    recordVisible.value = true
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .sn-body {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .sn-table-wrap {
    flex: 1;
    min-height: 0;
  }

  .sn-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .sn-search {
    width: 220px;
  }

  .sn-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
</style>
