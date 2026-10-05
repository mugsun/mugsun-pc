<template>
  <div class="data-scope-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="load"
      @reset="resetSearch"
    />
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElButton v-perm="'sys:data-scope:save'" type="primary" @click="openEdit()">{{
          $t('pages.system.dataScope.add')
        }}</ElButton>
        <span class="effective">
          {{ $t('pages.system.dataScope.effective') }}：
          <template v-if="effective.length">
            <ElTag v-for="item in effective" :key="item.table" class="tag">
              {{ item.table }} · {{ scopeLabel(item.scopeType) }}
            </ElTag>
          </template>
          <span v-else>{{ $t('pages.system.dataScope.effectiveEmpty') }}</span>
        </span>
      </div>
      <ElTable v-loading="loading" :data="rows" border>
        <ElTableColumn type="index" width="60" :label="$t('table.column.index')" />
        <ElTableColumn
          prop="scopeName"
          :label="$t('pages.system.dataScope.name')"
          min-width="140"
        />
        <ElTableColumn
          prop="resourceCode"
          :label="$t('pages.system.dataScope.code')"
          min-width="120"
        />
        <ElTableColumn prop="tableName" :label="$t('pages.system.dataScope.table')" width="120" />
        <ElTableColumn
          prop="deptColumn"
          :label="$t('pages.system.dataScope.deptColumn')"
          width="110"
        />
        <ElTableColumn
          prop="userColumn"
          :label="$t('pages.system.dataScope.userColumn')"
          width="110"
        />
        <ElTableColumn :label="$t('pages.system.dataScope.scopeType')" width="150">
          <template #default="{ row }">{{ scopeLabel(row.scopeType) }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.dataScope.status')" width="90">
          <template #default="{ row }">{{
            row.status === 1
              ? $t('pages.system.dataScope.enabled')
              : $t('pages.system.dataScope.disabled')
          }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('table.column.operation')" width="140" fixed="right">
          <template #default="{ row }">
            <ElButton v-perm="'sys:data-scope:save'" link type="primary" @click="openEdit(row)">{{
              $t('common.edit')
            }}</ElButton>
            <ElButton v-perm="'sys:data-scope:remove'" link type="danger" @click="removeRow(row)">{{
              $t('pages.system.dataScope.delete')
            }}</ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <span>{{ $t('pages.system.dataScope.empty') }}</span>
        </template>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="editVisible"
      :title="form.id ? $t('pages.system.dataScope.edit') : $t('pages.system.dataScope.add')"
      width="520px"
      align-center
      destroy-on-close
    >
      <p class="hint">{{ $t('pages.system.dataScope.hint') }}</p>
      <ElForm label-width="88px">
        <ElFormItem :label="$t('pages.system.dataScope.name')">
          <ElInput
            v-model="form.scopeName"
            maxlength="64"
            show-word-limit
            :placeholder="$t('pages.system.dataScope.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.code')">
          <ElInput
            v-model="form.resourceCode"
            maxlength="64"
            :placeholder="$t('pages.system.dataScope.codePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.table')">
          <ElInput
            v-model="form.tableName"
            :placeholder="$t('pages.system.dataScope.tablePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.deptColumn')">
          <ElInput
            v-model="form.deptColumn"
            :placeholder="$t('pages.system.dataScope.deptPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.userColumn')">
          <ElInput
            v-model="form.userColumn"
            :placeholder="$t('pages.system.dataScope.userPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.scopeType')">
          <ElSelect v-model="form.scopeType" class="full">
            <ElOption :value="1" :label="$t('pages.system.dataScope.scopeAll')" />
            <ElOption :value="2" :label="$t('pages.system.dataScope.scopeDept')" />
            <ElOption :value="3" :label="$t('pages.system.dataScope.scopeDeptChild')" />
            <ElOption :value="4" :label="$t('pages.system.dataScope.scopeSelf')" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.status')">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.dataScope.remark')">
          <ElInput
            v-model="form.remark"
            maxlength="255"
            :placeholder="$t('pages.system.dataScope.remarkPlaceholder')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{
          $t('common.confirm')
        }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchDataScopeEffective,
    fetchDataScopePage,
    fetchRemoveDataScope,
    fetchSaveDataScope
  } from '@/api/data-scope'

  const { t } = useI18n()
  const loading = ref(false)
  const saving = ref(false)
  const rows = ref<any[]>([])
  const effective = ref<
    Array<{ table: string; deptColumn: string; userColumn: string; scopeType: number }>
  >([])
  const editVisible = ref(false)
  const searchForm = reactive({ name: '' })
  const form = reactive({
    id: '' as string | number | '',
    scopeName: '',
    resourceCode: '',
    tableName: '',
    deptColumn: '',
    userColumn: '',
    scopeType: 1,
    status: 1,
    remark: ''
  })

  const searchItems = computed(() => [
    {
      key: 'name',
      label: t('pages.system.dataScope.searchName'),
      type: 'input',
      props: { placeholder: t('pages.system.dataScope.namePlaceholder'), clearable: true }
    }
  ])

  function scopeLabel(type: number) {
    if (type === 2) return t('pages.system.dataScope.scopeDept')
    if (type === 3) return t('pages.system.dataScope.scopeDeptChild')
    if (type === 4) return t('pages.system.dataScope.scopeSelf')
    return t('pages.system.dataScope.scopeAll')
  }

  async function load() {
    loading.value = true
    try {
      const page = await fetchDataScopePage({
        pageNum: 1,
        pageSize: 50,
        name: searchForm.name || undefined
      })
      rows.value = page?.records || page?.data?.records || []
      const active = await fetchDataScopeEffective()
      effective.value = Array.isArray(active) ? active : ((active as any)?.data ?? [])
    } finally {
      loading.value = false
    }
  }

  function resetSearch() {
    searchForm.name = ''
    load()
  }

  function openEdit(row?: any) {
    form.id = row?.id ?? ''
    form.scopeName = row?.scopeName ?? ''
    form.resourceCode = row?.resourceCode ?? ''
    form.tableName = row?.tableName ?? ''
    form.deptColumn = row?.deptColumn ?? ''
    form.userColumn = row?.userColumn ?? ''
    form.scopeType = row?.scopeType ?? 1
    form.status = row?.status ?? 1
    form.remark = row?.remark ?? ''
    editVisible.value = true
  }

  async function save() {
    if (!form.scopeName.trim()) {
      ElMessage.warning(t('pages.system.dataScope.nameRequired'))
      return
    }
    if (!form.resourceCode.trim()) {
      ElMessage.warning(t('pages.system.dataScope.codeRequired'))
      return
    }
    if (!form.tableName.trim() || !form.deptColumn.trim() || !form.userColumn.trim()) {
      ElMessage.warning(t('pages.system.dataScope.tableRequired'))
      return
    }
    if (saving.value) return
    saving.value = true
    try {
      await fetchSaveDataScope({
        id: form.id || undefined,
        scopeName: form.scopeName.trim(),
        resourceCode: form.resourceCode.trim(),
        tableName: form.tableName.trim(),
        deptColumn: form.deptColumn.trim(),
        userColumn: form.userColumn.trim(),
        scopeType: form.scopeType,
        status: form.status,
        remark: form.remark.trim()
      })
      editVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function removeRow(row: any) {
    await ElMessageBox.confirm(t('pages.system.dataScope.deleteConfirm', { name: row.scopeName }), {
      type: 'warning'
    })
    await fetchRemoveDataScope([row.id])
    await load()
  }

  onMounted(load)
</script>

<style scoped>
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }

  .effective {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .tag {
    margin-left: 6px;
  }

  .hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .full {
    width: 100%;
  }
</style>
