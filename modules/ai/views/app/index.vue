<template>
  <div class="art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="appType" @tab-change="reload">
        <ElTabPane :label="$t('aiAppList.tabAll')" name="" />
        <ElTabPane :label="$t('aiAppList.typeWorkflow')" name="workflow" />
        <ElTabPane :label="$t('aiAppList.typeText')" name="text" />
        <ElTabPane :label="$t('aiAppList.typeChat')" name="chat" />
        <ElTabPane :label="$t('aiAppList.typeChatflow')" name="chatflow" />
      </ElTabs>
      <div class="toolbar">
        <ElInput
          v-model="keyword"
          clearable
          :placeholder="$t('aiAppList.searchPlaceholder')"
          style="width: 200px"
          @keyup.enter="reload"
        />
        <ElButton @click="reload">{{ $t('aiAppList.search') }}</ElButton>
        <ElButton type="primary" @click="openEdit()">{{ $t('aiAppList.add') }}</ElButton>
      </div>
      <div v-loading="loading" class="card-grid">
        <ElCard v-for="row in records" :key="row.id" shadow="hover">
          <div class="title"
            >{{ row.name }}
            <ElTag size="small">{{ typeLabel(row.appType) }}</ElTag>
          </div>
          <div class="desc">{{ row.description || $t('aiAppList.noDescription') }}</div>
          <div class="ops">
            <ElButton link type="primary" @click="design(row)">{{
              $t('aiAppList.design')
            }}</ElButton>
            <ElButton link @click="openEdit(row)">{{ $t('aiAppList.edit') }}</ElButton>
            <ElButton link @click="copy(row)">{{ $t('aiAppList.copy') }}</ElButton>
            <ElButton link @click="doExport(row)">{{ $t('aiAppList.export') }}</ElButton>
            <ElButton link type="danger" @click="remove(row)">{{
              $t('aiAppList.delete')
            }}</ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" :description="emptyText" />
      </div>
    </ElCard>
    <ElDialog
      v-model="visible"
      :title="form.id ? $t('aiForm.editApp') : $t('aiForm.newApp')"
      width="560px"
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem :label="$t('aiForm.name')" prop="name" :rules="requiredRule($t('aiForm.name'))"
          ><ElInput v-model="form.name"
        /></ElFormItem>
        <ElFormItem
          :label="$t('aiForm.type')"
          prop="appType"
          :rules="requiredRule($t('aiForm.type'), true)"
        >
          <ElSelect v-model="form.appType" style="width: 100%">
            <ElOption :label="$t('aiForm.optWorkflow')" value="workflow" /><ElOption
              :label="$t('aiForm.optTextGen')"
              value="text"
            />
            <ElOption :label="$t('aiForm.optChatAssistant')" value="chat" /><ElOption
              :label="$t('aiForm.optChatflow')"
              value="chatflow"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.description')"
          ><ElInput
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
        /></ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="visible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { FormInstance } from 'element-plus'
  import { requiredRule } from '../shared/formRules'
  import { computed, onMounted, reactive, ref, nextTick } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchAiAppPage,
    fetchCopyAiApp,
    fetchExportAiApp,
    fetchRemoveAiApp,
    fetchSaveAiApp
  } from '../../api'
  defineOptions({ name: 'AiApp' })
  const { t } = useI18n()
  const formRef = ref<FormInstance>()
  const router = useRouter()
  const appType = ref('')
  const keyword = ref('')
  const searching = ref(false)
  const loading = ref(false)
  const records = ref<any[]>([])
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<Record<string, any>>({})
  function typeLabel(type: string) {
    return (
      (
        {
          workflow: t('aiAppList.typeWorkflow'),
          text: t('aiAppList.typeText'),
          chat: t('aiAppList.typeChat'),
          chatflow: t('aiAppList.typeChatflow')
        } as any
      )[type] || type
    )
  }
  const emptyText = computed(() =>
    searching.value ? t('aiAppList.emptySearched') : t('aiAppList.empty')
  )
  async function reload() {
    loading.value = true
    searching.value = !!keyword.value.trim()
    try {
      const res = await fetchAiAppPage({
        pageNum: 1,
        pageSize: 50,
        appType: appType.value || undefined,
        name: keyword.value.trim() || undefined
      })
      records.value = res?.records ?? []
    } finally {
      loading.value = false
    }
  }
  function design(row: any) {
    router.push(`/ai/app/design/${row.id}`)
  }
  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(form, row ? { ...row } : { appType: appType.value || 'workflow' })
    visible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }
  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      await fetchSaveAiApp({ ...form })
      visible.value = false
      await reload()
    } catch {
      /* 失败提示由请求层展示，弹窗留着方便改完再存 */
    } finally {
      saving.value = false
    }
  }
  async function copy(row: any) {
    await fetchCopyAiApp(row.id)
    await reload()
  }
  async function doExport(row: any) {
    await fetchExportAiApp(row.id)
  }
  async function remove(row: any) {
    await ElMessageBox.confirm(
      t('aiAppList.removeConfirm', { name: row.name }),
      t('aiAppList.confirmTitle')
    )
    await fetchRemoveAiApp(row.id)
    await reload()
  }
  onMounted(reload)
</script>
<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 12px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .title {
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .desc {
    min-height: 40px;
    margin-top: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .ops {
    margin-top: 10px;
  }
</style>
