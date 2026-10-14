<template>
  <div class="ai-gen-page art-full-height">
    <ElCard class="art-table-card" shadow="never">
      <div class="ai-gen-toolbar">
        <h3>{{ title }}</h3>
        <ElSelect
          v-model="modelId"
          :placeholder="$t('aiGen.selectModel')"
          clearable
          filterable
          style="width: 220px"
        >
          <ElOption v-for="m in models" :key="m.id" :label="m.modelName" :value="m.id" />
        </ElSelect>
        <ElButton @click="fillDemo">{{ $t('aiGen.fillDemo') }}</ElButton>
        <ElButton @click="reset">{{ $t('aiGen.reset') }}</ElButton>
        <ElButton type="primary" :loading="streaming" @click="generate">{{
          $t('aiGen.generate')
        }}</ElButton>
        <ElButton :disabled="!output" @click="doExport">{{ $t('aiGen.export') }}</ElButton>
      </div>
      <div class="ai-gen-body" :class="{ stacked: type === 'layout' }">
        <div class="ai-gen-settings">
          <ElForm label-width="96px">
            <ElFormItem v-if="type === 'poster'" :label="$t('aiGen.title')" required>
              <ElInput
                v-model="form.title"
                maxlength="15"
                show-word-limit
                :placeholder="$t('aiGen.titlePlaceholder')"
              />
            </ElFormItem>
            <ElFormItem v-else :label="$t('aiGen.topic')" required>
              <ElInput v-model="form.topic" :placeholder="$t('aiGen.topicPlaceholder')" />
            </ElFormItem>
            <ElFormItem v-if="type === 'poster'" :label="$t('aiGen.subtitle')">
              <ElInput v-model="form.subtitle" />
            </ElFormItem>
            <ElFormItem v-if="type === 'product'" :label="$t('aiGen.category')">
              <ElSelect v-model="form.category" style="width: 100%">
                <ElOption v-for="c in productCategories" :key="c" :label="c" :value="c" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem :label="$t('aiGen.style')">
              <ElSelect
                v-if="type === 'poster'"
                v-model="form.style"
                filterable
                style="width: 100%"
              >
                <ElOption v-for="s in posterStyles" :key="s" :label="s" :value="s" />
              </ElSelect>
              <ElInput v-else v-model="form.style" :placeholder="$t('aiGen.stylePlaceholder')" />
            </ElFormItem>
            <ElFormItem v-if="type === 'layout'" :label="$t('aiGen.preset')">
              <ElSelect v-model="form.preset" style="width: 100%" @change="onPreset">
                <ElOption label="A4 794×1123" value="a4" />
                <ElOption :label="$t('aiGen.sizeSocial')" value="social" />
                <ElOption :label="$t('aiGen.sizeBanner')" value="banner" />
                <ElOption :label="$t('aiGen.sizePhone')" value="phone" />
                <ElOption :label="$t('aiGen.sizeSquare')" value="square" />
                <ElOption :label="$t('aiGen.sizePoster')" value="poster" />
                <ElOption :label="$t('aiGen.sizeCustom')" value="custom" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem v-if="type === 'layout'" :label="$t('aiGen.size')">
              <div style="display: flex; gap: 8px; width: 100%">
                <ElInputNumber v-model="form.width" :min="100" :max="2000" />
                <ElInputNumber v-model="form.height" :min="100" :max="2000" />
              </div>
            </ElFormItem>
            <ElFormItem :label="$t('aiGen.extra')">
              <ElInput
                v-model="form.extra"
                type="textarea"
                :rows="4"
                :placeholder="$t('aiGen.extraPlaceholder')"
              />
            </ElFormItem>
          </ElForm>
        </div>
        <div class="ai-gen-preview">
          <div class="ai-gen-preview__label">{{ $t('aiGen.preview') }}</div>
          <div v-if="type === 'svg' && svgSafe" class="ai-gen-preview__svg" v-html="svgSafe" />
          <pre v-else class="ai-gen-preview__body">{{
            output || $t('aiGen.outputPlaceholder')
          }}</pre>
        </div>
      </div>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import DOMPurify from 'dompurify'
  import { fetchAiGenExport, fetchAiGenStream, fetchAiModelPage } from '../../api'

  const props = defineProps<{ type: string; title: string }>()
  const { t } = useI18n()

  const posterStyles = computed(() => [
    t('aiGen.styleRedParty'),
    t('aiGen.styleGovElegant'),
    t('aiGen.styleNeoExpressionism'),
    t('aiGen.stylePop'),
    t('aiGen.styleSurrealCollage'),
    t('aiGen.styleMinimalism'),
    t('aiGen.styleBoldModern'),
    t('aiGen.styleSwissDecon'),
    t('aiGen.styleJapaneseMinimal'),
    t('aiGen.styleScandinavian'),
    t('aiGen.styleElegantRetro'),
    t('aiGen.styleCyberpunk'),
    t('aiGen.styleNeoFuturism'),
    t('aiGen.styleFutureTech'),
    t('aiGen.styleGuochao')
  ])
  const productCategories = computed(() => [
    t('aiGen.catElectronics'),
    t('aiGen.catHome'),
    t('aiGen.catApparel'),
    t('aiGen.catBeauty'),
    t('aiGen.catFood'),
    t('aiGen.catBaby'),
    t('aiGen.catSports'),
    t('aiGen.catDigital'),
    t('aiGen.catOffice'),
    t('aiGen.catHealth'),
    t('aiGen.catAuto'),
    t('aiGen.catBooks'),
    t('aiGen.catPet'),
    t('aiGen.catToys'),
    t('aiGen.catSoftware')
  ])

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
    form.topic = t('aiGen.demoTopic', { title: props.title })
    form.title = t('aiGen.demoTitle')
    form.subtitle = t('aiGen.demoSubtitle')
    form.style = props.type === 'poster' ? posterStyles.value[0] : t('aiGen.demoStyle')
    form.category = productCategories.value[0]
    form.extra = t('aiGen.demoExtra')
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
      ElMessage.warning(props.type === 'poster' ? t('aiGen.enterTitle') : t('aiGen.enterTopic'))
      return
    }
    output.value = ''
    streaming.value = true
    const promptParts = [
      props.type === 'poster'
        ? t('aiGen.pTitle', { v: form.title })
        : t('aiGen.pTopic', { v: form.topic }),
      form.subtitle ? t('aiGen.pSubtitle', { v: form.subtitle }) : '',
      form.style ? t('aiGen.pStyle', { v: form.style }) : '',
      form.category ? t('aiGen.pCategory', { v: form.category }) : '',
      form.extra ? t('aiGen.pExtra', { v: form.extra }) : '',
      form.width || form.height ? t('aiGen.pSize', { w: form.width, h: form.height }) : '',
      t('aiGen.pAsk', { type: props.type })
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
        onChunk: (chunk) => {
          output.value += chunk
        },
        onError: (m) => {
          const raw = String(m || '')
          const refused = /ECONNREFUSED|Connection refused|finishConnect|connect timed out/i.test(
            raw
          )
          ElMessage.error(refused ? t('aiGen.modelUnreachable') : raw)
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
    ElMessage.success(t('aiGen.exported'))
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
