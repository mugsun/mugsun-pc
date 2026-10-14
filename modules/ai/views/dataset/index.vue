<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiDatasetList.searchPh')"
          style="width: 220px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">{{ $t('aiDatasetList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiDatasetList.add') }}</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title">{{ row.name }}</div>
          <div class="meta">{{ $t('aiDatasetList.meta') }}</div>
          <div class="desc">{{ row.description || $t('aiDatasetList.noDesc') }}</div>
          <div class="ops">
            <ElButton link type="primary" @click="goConfig(row)">{{
              $t('aiDatasetList.config')
            }}</ElButton>
            <ElButton link @click="goRun(row)">{{ $t('aiDatasetList.run') }}</ElButton>
            <ElButton link @click="goDash(row)">{{ $t('aiDatasetList.dashboard') }}</ElButton>
            <ElButton link @click="openEdit(row)">{{ $t('aiDatasetList.edit') }}</ElButton>
            <ElButton link @click="copy(row)">{{ $t('aiDatasetList.copy') }}</ElButton>
            <ElButton link type="danger" @click="remove(row)">{{
              $t('aiDatasetList.remove')
            }}</ElButton>
          </div>
        </ElCard>
        <ElEmpty
          v-if="!loading && !records.length"
          :description="searched ? $t('aiDatasetList.emptySearched') : $t('aiDatasetList.empty')"
        />
      </div>
    </ElCard>
    <ElDialog
      v-model="visible"
      class="ai-dataset-dialog"
      :title="form.id ? $t('aiForm.editDataset') : $t('aiForm.newDataset')"
      width="560px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.name')" prop="name" :rules="requiredRule($t('aiForm.name'))">
          <ElInput
            v-model="form.name"
            maxlength="64"
            show-word-limit
            :placeholder="$t('aiForm.phListName')"
          />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.description')">
          <ElInput
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            :placeholder="$t('aiForm.phDatasetTables')"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import type { FormInstance } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { requiredRule } from '../shared/formRules'
  import { onMounted, reactive, ref, nextTick } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchAiDatasetPage,
    fetchCopyAiDataset,
    fetchRemoveAiDataset,
    fetchSaveAiDataset
  } from '../../api'
  defineOptions({ name: 'AiDataset' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const router = useRouter()
  const keyword = ref('')
  const searched = ref(false)
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  async function reload() {
    loading.value = true
    searched.value = !!keyword.value.trim()
    try {
      const res = await fetchAiDatasetPage({
        pageNum: 1,
        pageSize: 50,
        name: keyword.value || undefined
      })
      records.value = res?.records ?? []
    } finally {
      loading.value = false
    }
  }
  function goConfig(row: any) {
    router.push(`/ai/dataset/config/${row.id}`)
  }
  function goRun(row: any) {
    router.push(`/ai/dataset/run/${row.id}`)
  }
  function goDash(row: any) {
    router.push(`/ai/dashboard/design/${row.id}`)
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : {})
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      await fetchSaveAiDataset({ id: form.id, name: form.name, description: form.description })
      visible.value = false
      await reload()
    } catch {
      /* 失败时弹窗留着，方便改完再保存 */
    } finally {
      saving.value = false
    }
  }
  async function copy(row: any) {
    await fetchCopyAiDataset(row.id)
    await reload()
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      t('aiDatasetList.removeConfirm', { name: row.name }),
      t('aiDatasetList.confirm')
    )
    await fetchRemoveAiDataset(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .title {
    font-weight: 600;
  }

  .meta {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .desc {
    min-height: 36px;
    margin-top: 8px;
    font-size: 13px;
  }

  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
  }
</style>
