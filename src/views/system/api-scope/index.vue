<template>
  <div class="api-scope-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="load"
      @reset="resetSearch"
    />
    <ElCard class="art-table-card">
      <div class="toolbar">
        <ElButton v-perm="'sys:api-scope:save'" type="primary" @click="openEdit()">{{
          $t('pages.system.apiScope.add')
        }}</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" border>
        <ElTableColumn type="index" width="60" :label="$t('table.column.index')" />
        <ElTableColumn prop="scopeName" :label="$t('pages.system.apiScope.name')" min-width="140" />
        <ElTableColumn
          prop="resourceCode"
          :label="$t('pages.system.apiScope.code')"
          min-width="120"
        />
        <ElTableColumn prop="scopePath" :label="$t('pages.system.apiScope.path')" min-width="160" />
        <ElTableColumn :label="$t('pages.system.apiScope.scopeType')" width="110">
          <template #default="{ row }">{{
            row.scopeType === 2
              ? $t('pages.system.apiScope.typeBiz')
              : $t('pages.system.apiScope.typeSystem')
          }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.apiScope.status')" width="90">
          <template #default="{ row }">{{
            row.status === 1
              ? $t('pages.system.apiScope.enabled')
              : $t('pages.system.apiScope.disabled')
          }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('pages.system.apiScope.granted')" width="90">
          <template #default="{ row }">{{ row.grantCount || 0 }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('table.column.operation')" width="180" fixed="right">
          <template #default="{ row }">
            <ElButton v-perm="'sys:api-scope:grant'" link type="primary" @click="openGrant(row)">{{
              $t('pages.system.apiScope.grant')
            }}</ElButton>
            <ElButton v-perm="'sys:api-scope:save'" link type="primary" @click="openEdit(row)">{{
              $t('common.edit')
            }}</ElButton>
            <ElButton v-perm="'sys:api-scope:remove'" link type="danger" @click="removeRow(row)">{{
              $t('pages.system.apiScope.delete')
            }}</ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <span>{{ $t('pages.system.apiScope.empty') }}</span>
        </template>
      </ElTable>
    </ElCard>

    <ElDialog
      v-model="editVisible"
      :title="form.id ? $t('pages.system.apiScope.edit') : $t('pages.system.apiScope.add')"
      width="520px"
      align-center
      destroy-on-close
    >
      <p class="hint">{{ $t('pages.system.apiScope.hint') }}</p>
      <ElForm label-width="88px">
        <ElFormItem :label="$t('pages.system.apiScope.name')">
          <ElInput
            v-model="form.scopeName"
            maxlength="64"
            show-word-limit
            :placeholder="$t('pages.system.apiScope.namePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiScope.code')">
          <ElInput
            v-model="form.resourceCode"
            maxlength="64"
            :placeholder="$t('pages.system.apiScope.codePlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiScope.path')">
          <ElInput
            v-model="form.scopePath"
            :placeholder="$t('pages.system.apiScope.pathPlaceholder')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiScope.scopeType')">
          <ElSelect v-model="form.scopeType" class="full">
            <ElOption :value="1" :label="$t('pages.system.apiScope.typeSystem')" />
            <ElOption :value="2" :label="$t('pages.system.apiScope.typeBiz')" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiScope.status')">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem :label="$t('pages.system.apiScope.remark')">
          <ElInput
            v-model="form.remark"
            maxlength="255"
            :placeholder="$t('pages.system.apiScope.remarkPlaceholder')"
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

    <ElDialog
      v-model="grantVisible"
      :title="$t('pages.system.apiScope.grantTitle', { name: grantName })"
      width="480px"
      align-center
    >
      <p class="hint">{{ $t('pages.system.apiScope.grantHint') }}</p>
      <ElCheckboxGroup v-if="roleOptions.length" v-model="checkedRoles" class="roles">
        <ElCheckbox v-for="role in roleOptions" :key="role.id" :value="role.id">
          {{ role.roleName }}（{{ role.roleCode }}）
        </ElCheckbox>
      </ElCheckboxGroup>
      <p v-else class="hint">{{ $t('pages.system.apiScope.grantEmpty') }}</p>
      <template #footer>
        <ElButton @click="grantVisible = false">{{ $t('common.cancel') }}</ElButton>
        <ElButton type="primary" :loading="granting" @click="saveGrant">{{
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
    fetchApiScopePage,
    fetchApiScopeRoles,
    fetchGrantApiScope,
    fetchRemoveApiScope,
    fetchSaveApiScope
  } from '@/api/api-scope'

  const { t } = useI18n()
  const loading = ref(false)
  const saving = ref(false)
  const granting = ref(false)
  const rows = ref<any[]>([])
  const editVisible = ref(false)
  const grantVisible = ref(false)
  const grantId = ref('')
  const grantName = ref('')
  const roleOptions = ref<Array<{ id: string; roleName: string; roleCode: string }>>([])
  const checkedRoles = ref<string[]>([])
  const searchForm = reactive({ name: '' })
  const form = reactive({
    id: '' as string | number | '',
    scopeName: '',
    resourceCode: '',
    scopePath: '',
    scopeType: 1,
    status: 1,
    remark: ''
  })

  const searchItems = computed(() => [
    {
      key: 'name',
      label: t('pages.system.apiScope.searchName'),
      type: 'input',
      props: { placeholder: t('pages.system.apiScope.namePlaceholder'), clearable: true }
    }
  ])

  async function load() {
    loading.value = true
    try {
      const page = await fetchApiScopePage({
        pageNum: 1,
        pageSize: 50,
        name: searchForm.name || undefined
      })
      rows.value = page?.records || []
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
    form.scopePath = row?.scopePath ?? ''
    form.scopeType = row?.scopeType ?? 1
    form.status = row?.status ?? 1
    form.remark = row?.remark ?? ''
    editVisible.value = true
  }

  async function save() {
    if (!form.scopeName.trim()) {
      ElMessage.warning(t('pages.system.apiScope.nameRequired'))
      return
    }
    if (!form.resourceCode.trim()) {
      ElMessage.warning(t('pages.system.apiScope.codeRequired'))
      return
    }
    if (!form.scopePath.trim()) {
      ElMessage.warning(t('pages.system.apiScope.pathRequired'))
      return
    }
    if (saving.value) return
    saving.value = true
    try {
      await fetchSaveApiScope({
        id: form.id || undefined,
        scopeName: form.scopeName.trim(),
        resourceCode: form.resourceCode.trim(),
        scopePath: form.scopePath.trim(),
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

  async function openGrant(row: any) {
    grantId.value = String(row.id)
    grantName.value = row.scopeName
    const data = await fetchApiScopeRoles(row.id)
    roleOptions.value = data?.roles || []
    checkedRoles.value = data?.checked || []
    grantVisible.value = true
  }

  async function saveGrant() {
    if (granting.value) return
    granting.value = true
    try {
      await fetchGrantApiScope(grantId.value, checkedRoles.value)
      grantVisible.value = false
      await load()
    } finally {
      granting.value = false
    }
  }

  async function removeRow(row: any) {
    await ElMessageBox.confirm(t('pages.system.apiScope.deleteConfirm', { name: row.scopeName }), {
      type: 'warning'
    })
    await fetchRemoveApiScope([row.id])
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

  .hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .full {
    width: 100%;
  }

  .roles {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
    max-height: 280px;
    overflow: auto;
  }
</style>
