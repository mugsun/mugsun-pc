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
        <ElEmpty v-if="!loading && !records.length" description="暂无模型" />
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
      :title="form.id ? '编辑模型' : '添加模型'"
      width="640px"
      destroy-on-close
    >
      <ElForm :model="form" label-width="100px">
        <ElFormItem label="模型名称" required>
          <ElInput v-model="form.modelName" placeholder="如 DeepSeek-V3-Chat" />
        </ElFormItem>
        <ElFormItem label="模型类型" required>
          <ElSelect v-model="form.modelType" style="width: 100%">
            <ElOption label="对话" value="chat" />
            <ElOption label="向量" value="embedding" />
            <ElOption label="图像" value="image" />
            <ElOption label="音频" value="audio" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="提供商" required>
          <ElSelect v-model="form.provider" style="width: 100%" @change="onProvider">
            <ElOption v-for="p in providers" :key="p.value" :label="p.label" :value="p.value" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Base URL" required>
          <ElInput v-model="form.baseUrl" />
        </ElFormItem>
        <ElFormItem label="模型标识" required>
          <ElInput v-model="form.modelCode" placeholder="如 deepseek-chat" />
        </ElFormItem>
        <ElFormItem label="API Key" :required="!form.id">
          <ElInput
            v-model="form.apiKey"
            type="password"
            show-password
            placeholder="编辑留空表示不修改"
          />
        </ElFormItem>
        <ElFormItem label="Secret Key">
          <ElInput v-model="form.secretKey" type="password" show-password />
        </ElFormItem>
        <ElFormItem v-if="form.modelType === 'embedding'" label="向量维度" required>
          <ElInputNumber v-model="form.dimensions" :min="1" :max="8192" />
        </ElFormItem>
        <ElFormItem v-if="form.modelType === 'chat'" label="支持视觉">
          <ElSwitch v-model="form.visionFlag" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="输入单价">
          <ElInputNumber v-model="form.priceInput" :min="0" :step="0.001" :precision="6" />
        </ElFormItem>
        <ElFormItem label="输出单价">
          <ElInputNumber v-model="form.priceOutput" :min="0" :step="0.001" :precision="6" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchAiModelPage,
    fetchDefaultAiModel,
    fetchRemoveAiModel,
    fetchSaveAiModel,
    fetchTestAiModel
  } from '../../api'

  defineOptions({ name: 'AiModel' })

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
  const form = reactive<Record<string, any>>({})

  async function reload() {
    loading.value = true
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
  }

  function onProvider(v: string) {
    const p = providers.find((x) => x.value === v)
    if (p?.url) form.baseUrl = p.url
  }

  async function save() {
    if (!form.modelName || !form.baseUrl || !form.modelCode) {
      ElMessage.warning('请填写必填项')
      return
    }
    saving.value = true
    try {
      const payload = { ...form }
      if (!payload.apiKey) delete payload.apiKey
      if (!payload.secretKey) delete payload.secretKey
      await fetchSaveAiModel(payload)
      ElMessage.success('已保存')
      dialogVisible.value = false
      await reload()
    } finally {
      saving.value = false
    }
  }

  async function setDefault(row: any) {
    await fetchDefaultAiModel(row.id)
    ElMessage.success('已设为默认')
    await reload()
  }

  async function testModel(row: any) {
    const res = await fetchTestAiModel(row.id)
    ElMessage.success(res?.message || '测试通过')
    await reload()
  }

  async function remove(row: any) {
    await ElMessageBox.confirm(`确定删除模型「${row.modelName}」？`, '删除确认')
    await fetchRemoveAiModel(row.id)
    ElMessage.success('已删除')
    await reload()
  }

  onMounted(reload)
</script>

<style scoped>
  .ai-model-toolbar {
    display: flex;
    gap: 8px;
    margin: 8px 0 16px;
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
