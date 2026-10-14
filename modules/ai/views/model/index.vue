<template>
  <div class="ai-model-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <ElTabs v-model="modelType" @tab-change="onTabChange">
        <ElTabPane label="对话模型" name="chat" />
        <ElTabPane label="向量模型" name="embedding" />
        <ElTabPane label="图像模型" name="image" />
        <ElTabPane label="音频模型" name="audio" />
      </ElTabs>

      <div class="ai-model-toolbar">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="按名称搜索"
          style="width: 220px"
          @keyup.enter="reload"
          @clear="reload"
        />
        <ElButton @click="reload">搜索</ElButton>
        <ElButton type="primary" @click="openEdit()">添加新模型</ElButton>
      </div>

      <div v-loading="loading" class="ai-model-grid">
        <ElCard v-for="row in records" :key="row.id" class="ai-model-card" shadow="hover">
          <div class="ai-model-card__hd">
            <img v-if="row.icon" :src="row.icon" class="ai-model-card__icon" alt="" />
            <div class="ai-model-card__icon placeholder" v-else>{{ (row.provider || '?')[0] }}</div>
            <div class="ai-model-card__titles">
              <div class="name">
                {{ row.modelName }}
                <ElTag v-if="row.defaultFlag === 1" size="small" type="success">默认</ElTag>
                <ElTag v-if="row.builtinFlag === 1" size="small">内置</ElTag>
              </div>
              <div class="sub">
                <ElTag size="small" effect="plain">{{ row.provider }}</ElTag>
                <span>{{ row.modelCode }}</span>
              </div>
            </div>
            <ElTag :type="row.activateFlag === 1 ? 'success' : 'info'" size="small">
              {{ row.activateFlag === 1 ? '已激活' : '未激活' }}
            </ElTag>
          </div>
          <div class="ai-model-card__price">
            输入 {{ row.priceInput ?? '-' }} / 输出 {{ row.priceOutput ?? '-' }} 元/千token
          </div>
          <div class="ai-model-card__ops">
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
            <ElButton link @click="setDefault(row)">设为默认</ElButton>
            <ElButton link @click="testModel(row)">测试</ElButton>
            <ElButton link type="danger" :disabled="row.builtinFlag === 1" @click="remove(row)">
              删除
            </ElButton>
          </div>
        </ElCard>
        <ElEmpty v-if="!loading && !records.length" :description="emptyText" />
      </div>

      <div class="ai-model-pager">
        <ElPagination
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          layout="total, prev, pager, next"
          :total="total"
          @current-change="reload"
          @size-change="reload"
        />
      </div>
    </ElCard>

    <ElDialog
      v-model="dialogVisible"
      class="ai-model-dialog"
      :title="form.id ? $t('aiForm.editModel') : $t('aiForm.addModel')"
      width="640px"
      destroy-on-close
    >
      <ElForm ref="formRef" :model="form" label-width="auto">
        <ElFormItem
          :label="$t('aiForm.modelName')"
          prop="modelName"
          :rules="requiredRule($t('aiForm.modelName'))"
        >
          <ElInput v-model="form.modelName" :placeholder="$t('aiForm.phModelName')" />
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.modelType')"
          prop="modelType"
          :rules="requiredRule($t('aiForm.modelType'), true)"
        >
          <ElSelect v-model="form.modelType" style="width: 100%">
            <ElOption :label="$t('aiForm.optChat')" value="chat" />
            <ElOption :label="$t('aiForm.optEmbedding')" value="embedding" />
            <ElOption :label="$t('aiForm.optImage')" value="image" />
            <ElOption :label="$t('aiForm.optAudio')" value="audio" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.provider')"
          prop="provider"
          :rules="requiredRule($t('aiForm.provider'), true)"
        >
          <ElSelect v-model="form.provider" style="width: 100%" @change="onProvider">
            <ElOption v-for="p in providers" :key="p.value" :label="p.label" :value="p.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Base URL" prop="baseUrl" :rules="requiredRule('Base URL')">
          <ElInput v-model="form.baseUrl" />
        </ElFormItem>
        <ElFormItem
          :label="$t('aiForm.modelCode')"
          prop="modelCode"
          :rules="requiredRule($t('aiForm.modelCode'))"
        >
          <ElInput v-model="form.modelCode" :placeholder="$t('aiForm.phModelCode')" />
        </ElFormItem>
        <ElFormItem label="API Key" prop="apiKey" :rules="form.id ? [] : requiredRule('API Key')">
          <ElInput
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="$t('aiForm.phKeepUnchanged')"
          />
        </ElFormItem>
        <ElFormItem label="Secret Key">
          <ElInput v-model="form.secretKey" type="password" show-password />
        </ElFormItem>
        <ElFormItem
          v-if="form.modelType === 'embedding'"
          :label="$t('aiForm.dimensions')"
          prop="dimensions"
          :rules="requiredRule($t('aiForm.dimensions'))"
        >
          <ElInputNumber v-model="form.dimensions" :min="1" :max="8192" />
        </ElFormItem>
        <ElFormItem v-if="form.modelType === 'chat'" :label="$t('aiForm.vision')">
          <ElSwitch v-model="form.visionFlag" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.priceInput')">
          <ElInputNumber v-model="form.priceInput" :min="0" :step="0.001" :precision="6" />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.priceOutput')">
          <ElInputNumber v-model="form.priceOutput" :min="0" :step="0.001" :precision="6" />
        </ElFormItem>
        <ElFormItem :label="$t('aiForm.remark')">
          <ElInput v-model="form.remark" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">{{ $t('aiForm.cancel') }}</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">{{ $t('aiForm.save') }}</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance } from 'element-plus'
  import { requiredRule } from '../shared/formRules'
  import { computed, nextTick, onMounted, reactive, ref } from 'vue'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchAiModelPage,
    fetchDefaultAiModel,
    fetchRemoveAiModel,
    fetchSaveAiModel,
    fetchTestAiModel
  } from '../../api'

  defineOptions({ name: 'AiModel' })
  const formRef = ref<FormInstance>()

  const providers = [
    { label: 'OpenAI', value: 'openai', url: 'https://api.openai.com/v1' },
    { label: 'DeepSeek', value: 'deepseek', url: 'https://api.deepseek.com/v1' },
    { label: 'Anthropic', value: 'anthropic', url: 'https://api.anthropic.com/v1' },
    { label: 'SiliconFlow', value: 'siliconflow', url: 'https://api.siliconflow.cn/v1' },
    { label: 'Volcengine', value: 'volcengine', url: '' },
    { label: 'Ollama', value: 'ollama', url: 'http://localhost:11434/v1' },
    { label: 'Qianfan', value: 'qianfan', url: '' },
    { label: 'Zhipu', value: 'zhipu', url: '' },
    { label: 'Qwen', value: 'qwen', url: '' },
    { label: 'Custom', value: 'custom', url: '' }
  ]

  const modelType = ref('chat')
  const keyword = ref('')
  const loading = ref(false)
  const records = ref<any[]>([])
  const pageNum = ref(1)
  const pageSize = ref(12)
  const total = ref(0)
  const dialogVisible = ref(false)
  const saving = ref(false)
  const searching = ref(false)
  const form = reactive<Record<string, any>>({})
  const emptyText = computed(() =>
    searching.value ? '没有符合条件的模型。换个名称再查' : '还没有模型。点添加新模型开始配置'
  )

  async function reload() {
    loading.value = true
    searching.value = !!keyword.value.trim()
    try {
      const res = await fetchAiModelPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        modelType: modelType.value,
        name: keyword.value || undefined
      })
      records.value = res?.records ?? []
      total.value = res?.totalRow ?? res?.total ?? 0
    } finally {
      loading.value = false
    }
  }

  function onTabChange() {
    pageNum.value = 1
    void reload()
  }

  function openEdit(row?: any) {
    Object.keys(form).forEach((k) => delete form[k])
    Object.assign(
      form,
      row
        ? { ...row, apiKey: '', secretKey: '' }
        : {
            modelType: modelType.value,
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            visionFlag: 0,
            priceInput: 0,
            priceOutput: 0
          }
    )
    dialogVisible.value = true
    nextTick(() => formRef.value?.clearValidate())
  }

  function onProvider(v: string) {
    const p = providers.find((x) => x.value === v)
    if (p?.url) form.baseUrl = p.url
  }

  async function save() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      const payload = { ...form }
      if (!payload.apiKey) delete payload.apiKey
      if (!payload.secretKey) delete payload.secretKey
      await fetchSaveAiModel(payload)
      dialogVisible.value = false
      await reload()
    } catch {
      /* 失败文案由请求层弹出，弹窗留着方便改 */
    } finally {
      saving.value = false
    }
  }

  async function setDefault(row: any) {
    try {
      await fetchDefaultAiModel(row.id)
      await reload()
    } catch {
      /* 未激活时保留当前默认标记 */
    }
  }

  async function testModel(row: any) {
    try {
      await fetchTestAiModel(row.id)
      await reload()
    } catch {
      await reload()
    }
  }

  async function remove(row: any) {
    await ElMessageBox.confirm(
      `删除「${row.modelName}」后，列表里不会再出现。已设成默认的也会一起清掉`,
      '确认'
    )
    await fetchRemoveAiModel(row.id)
    await reload()
  }

  onMounted(reload)
</script>

<style scoped>
  .ai-model-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 16px;
  }

  :global(.ai-model-dialog) {
    margin: 16px auto 0 !important;
  }

  :global(.ai-model-dialog .el-dialog__body) {
    padding-top: 8px;
    padding-bottom: 4px;
  }

  :global(.ai-model-dialog .el-form-item) {
    margin-bottom: 8px;
  }

  .ai-model-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    min-height: 200px;
  }

  .ai-model-card__hd {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .ai-model-card__icon {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 8px;
  }

  .ai-model-card__icon.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #fff;
    text-transform: uppercase;
    background: var(--el-color-primary);
  }

  .ai-model-card__titles {
    flex: 1;
    min-width: 0;
  }

  .ai-model-card__titles .name {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }

  .ai-model-card__titles .sub {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-model-card__price {
    margin-top: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-model-card__ops {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
  }

  .ai-model-pager {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
