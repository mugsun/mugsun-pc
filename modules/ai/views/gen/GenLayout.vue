<template>
  <div class="ai-gen-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="ai-gen-toolbar">
        <h3>{{ title }}</h3>
        <ElSelect
          v-model="modelId"
          placeholder="选择模型"
          clearable
          filterable
          style="width: 220px"
        >
          <ElOption v-for="m in models" :key="m.id" :label="m.modelName" :value="m.id" />
        </ElSelect>
        <ElButton @click="fillDemo">生成测试数据</ElButton>
        <ElButton @click="reset">重置</ElButton>
        <ElButton type="primary" :loading="streaming" @click="generate">生成</ElButton>
        <ElButton :disabled="!output" @click="doExport">导出</ElButton>
      </div>
      <div class="ai-gen-body" :class="{ stacked: type === 'layout' }">
        <div class="ai-gen-settings">
          <ElForm label-width="96px">
            <ElFormItem v-if="type === 'poster'" label="标题" required>
              <ElInput
                v-model="form.title"
                maxlength="15"
                show-word-limit
                placeholder="建议 15 字内"
              />
            </ElFormItem>
            <ElFormItem v-else label="主题" required>
              <ElInput v-model="form.topic" placeholder="输入主题或需求" />
            </ElFormItem>
            <ElFormItem v-if="type === 'poster'" label="副标题">
              <ElInput v-model="form.subtitle" />
            </ElFormItem>
            <ElFormItem v-if="type === 'product'" label="产品类别">
              <ElSelect v-model="form.category" style="width: 100%">
                <ElOption v-for="c in productCategories" :key="c" :label="c" :value="c" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem label="风格">
              <ElSelect
                v-if="type === 'poster'"
                v-model="form.style"
                filterable
                style="width: 100%"
              >
                <ElOption v-for="s in posterStyles" :key="s" :label="s" :value="s" />
              </ElSelect>
              <ElInput v-else v-model="form.style" placeholder="可选风格描述" />
            </ElFormItem>
            <ElFormItem v-if="type === 'layout'" label="预设尺寸">
              <ElSelect v-model="form.preset" style="width: 100%" @change="onPreset">
                <ElOption label="A4 794×1123" value="a4" />
                <ElOption label="社交媒体 756×567" value="social" />
                <ElOption label="宣传横幅 1134×302" value="banner" />
                <ElOption label="手机屏幕 378×680" value="phone" />
                <ElOption label="方形 945×945" value="square" />
                <ElOption label="海报 1890×945" value="poster" />
                <ElOption label="自定义" value="custom" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem v-if="type === 'layout'" label="宽×高">
              <div style="display: flex; gap: 8px; width: 100%">
                <ElInputNumber v-model="form.width" :min="100" :max="2000" />
                <ElInputNumber v-model="form.height" :min="100" :max="2000" />
              </div>
            </ElFormItem>
            <ElFormItem label="补充">
              <ElInput
                v-model="form.extra"
                type="textarea"
                :rows="4"
                placeholder="补充约束 / 正文 / 参数"
              />
            </ElFormItem>
          </ElForm>
        </div>
        <div class="ai-gen-preview">
          <div class="ai-gen-preview__label">预览</div>
          <div v-if="type === 'svg' && svgSafe" class="ai-gen-preview__svg" v-html="svgSafe" />
          <pre v-else class="ai-gen-preview__body">{{ output || '生成结果将显示在这里' }}</pre>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import DOMPurify from 'dompurify'
  import { fetchAiGenExport, fetchAiGenStream, fetchAiModelPage } from '../../api'

  const props = defineProps<{ type: string; title: string }>()

  const posterStyles = [
    '红色党政风',
    '淡雅政务风',
    '新表现主义',
    '波普艺术',
    '超现实主义数字拼贴',
    '极简主义',
    '大胆现代',
    '瑞士国际主义解构',
    '日式极简',
    '斯堪的纳维亚',
    '优雅复古',
    '赛博朋克',
    '新未来主义',
    '未来科技',
    '国潮东方'
  ]
  const productCategories = [
    '电子产品',
    '家居用品',
    '服装鞋帽',
    '美妆护肤',
    '食品饮料',
    '母婴用品',
    '运动户外',
    '数码配件',
    '办公用品',
    '健康保健',
    '汽车用品',
    '图书音像',
    '宠物用品',
    '玩具游戏',
    '软件服务'
  ]

  const modelId = ref<string | number | null>(null)
  const models = ref<any[]>([])
  const form = reactive({
    topic: '',
    title: '',
    subtitle: '',
    style: '',
    category: '',
    extra: '',
    preset: 'a4',
    width: 794,
    height: 1123
  })
  const output = ref('')
  const streaming = ref(false)
  let abort: AbortController | null = null

  const svgSafe = computed(() => {
    if (props.type !== 'svg' || !output.value.includes('<svg')) return ''
    const m = output.value.match(/<svg[\s\S]*?<\/svg>/i)
    if (!m) return ''
    return DOMPurify.sanitize(m[0], {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
    })
  })

  function onPreset(v: string) {
    const map: Record<string, [number, number]> = {
      a4: [794, 1123],
      social: [756, 567],
      banner: [1134, 302],
      phone: [378, 680],
      square: [945, 945],
      poster: [1890, 945]
    }
    if (map[v]) {
      form.width = map[v][0]
      form.height = map[v][1]
    }
  }

  async function loadModels() {
    const res = await fetchAiModelPage({ pageNum: 1, pageSize: 50, modelType: 'chat' })
    models.value = res?.records ?? []
    const def = models.value.find((m) => m.defaultFlag === 1)
    if (def) modelId.value = def.id
  }

  function fillDemo() {
    form.topic = props.title + '示例主题'
    form.title = '示例海报标题'
    form.subtitle = '副标题示意'
    form.style = props.type === 'poster' ? posterStyles[0] : '专业、简洁'
    form.category = productCategories[0]
    form.extra = '面向企业内部场景'
  }

  function reset() {
    form.topic = ''
    form.title = ''
    form.subtitle = ''
    form.style = ''
    form.category = ''
    form.extra = ''
    output.value = ''
    abort?.abort()
    streaming.value = false
  }

  async function generate() {
    const topic = props.type === 'poster' ? form.title : form.topic
    if (!topic.trim()) {
      ElMessage.warning(props.type === 'poster' ? '请填写标题' : '请填写主题')
      return
    }
    output.value = ''
    streaming.value = true
    const promptParts = [
      props.type === 'poster' ? `标题: ${form.title}` : `主题: ${form.topic}`,
      form.subtitle ? `副标题: ${form.subtitle}` : '',
      form.style ? `风格: ${form.style}` : '',
      form.category ? `类目: ${form.category}` : '',
      form.extra ? `补充: ${form.extra}` : '',
      form.width || form.height ? `尺寸: ${form.width}x${form.height}` : '',
      `请按 ${props.type} 类型输出可用结果。`
    ].filter(Boolean)
    abort = await fetchAiGenStream(
      props.type,
      {
        modelId: modelId.value,
        prompt: promptParts.join('\n'),
        topic,
        title: form.title,
        subtitle: form.subtitle,
        style: form.style,
        category: form.category,
        extra: form.extra,
        width: form.width,
        height: form.height
      },
      {
        onChunk: (t) => {
          output.value += t
        },
        onError: (m) => {
          ElMessage.error(m)
          streaming.value = false
        },
        onDone: () => {
          streaming.value = false
        }
      }
    )
  }

  async function doExport() {
    await fetchAiGenExport(props.type, { content: output.value, ...form })
    ElMessage.success('已导出')
  }

  onMounted(loadModels)
</script>

<style scoped>
  .ai-gen-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .ai-gen-toolbar h3 {
    margin: 0;
    margin-right: auto;
    font-size: 16px;
  }

  .ai-gen-page :deep(.el-card) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .ai-gen-settings {
    min-height: 0;
    overflow: auto;
  }

  .ai-gen-page :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .ai-gen-body {
    display: grid;
    flex: 1;
    grid-template-columns: 360px 1fr;
    gap: 16px;
    min-height: 0;
    overflow: hidden;
  }

  .ai-gen-body.stacked {
    grid-template-columns: 1fr;
  }

  .ai-gen-preview {
    height: 100%;
    min-height: 0;
    padding: 12px;
    overflow: auto;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
  }

  .ai-gen-preview__label {
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .ai-gen-preview__body {
    margin: 0;
    font-size: 13px;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .ai-gen-preview__svg :deep(svg) {
    max-width: 100%;
    height: auto;
  }
</style>
