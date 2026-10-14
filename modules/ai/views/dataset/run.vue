<template>
  <div class="art-full-height ai-dataset-run">
    <AiNotFound
      v-if="notFound"
      :what="$t('aiDatasetRun.what')"
      :id="datasetId"
      back-path="/ai/dataset"
      :back-text="$t('aiDatasetRun.backToList')"
    />
    <ElCard v-else class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.back()">{{ $t('aiDatasetRun.back') }}</ElButton>
        <h3>{{ $t('aiDatasetRun.title', { id: datasetId }) }}</h3>
      </div>
      <div class="suggest">
        <ElTag v-for="s in suggests" :key="s" class="tag" @click="ask(s)">{{ s }}</ElTag>
      </div>
      <div ref="boxRef" class="msgs">
        <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
          <div class="role">{{
            m.role === 'user' ? $t('aiDatasetRun.question') : $t('aiDatasetRun.answer')
          }}</div>
          <div class="body">
            <div>{{ m.content }}</div>
            <pre v-if="m.sql" class="sql">{{ m.sql }}</pre>
            <ElTable
              v-if="m.rows?.length"
              :data="m.rows"
              size="small"
              max-height="220"
              style="margin-top: 8px"
            >
              <ElTableColumn
                v-for="c in Object.keys(m.rows[0] || {})"
                :key="c"
                :prop="c"
                :label="c"
                min-width="100"
              />
            </ElTable>
            <div v-if="m.role === 'assistant'" class="ops">
              <ElButton link size="small" @click="analyze(m)">{{
                $t('aiDatasetRun.analyze')
              }}</ElButton>
              <ElButton link size="small" @click="predict(m)">{{
                $t('aiDatasetRun.predict')
              }}</ElButton>
              <ElButton link size="small" @click="editSql(m)">{{
                $t('aiDatasetRun.editSql')
              }}</ElButton>
            </div>
          </div>
        </div>
      </div>
      <div class="input">
        <ElInput
          v-model="question"
          type="textarea"
          :rows="2"
          :placeholder="$t('aiDatasetRun.askPlaceholder')"
          @keydown.enter.exact.prevent="ask()"
        />
        <ElButton type="primary" :loading="asking" @click="ask()">{{
          $t('aiDatasetRun.ask')
        }}</ElButton>
      </div>
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { computed, nextTick, onMounted, ref } from 'vue'
  import { analyzeQuestion, predictQuestion } from './askText'
  import AiNotFound from '../shared/AiNotFound.vue'
  import { useRoute } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import {
    fetchDatasetAnalyze,
    fetchDatasetAsk,
    fetchDatasetPredict,
    fetchDatasetSqlRerun,
    fetchDatasetSuggest,
    aiDatasetExists
  } from '../../api'
  defineOptions({ name: 'AiDatasetRun' })
  const { t } = useI18n()
  /** id 不存在或已删除时只显示占位与返回入口（UX-105） */
  const notFound = ref(false)
  const route = useRoute()
  const datasetId = computed(() => route.params.id as string)
  const suggests = ref<string[]>([])
  const messages = ref<any[]>([])
  const question = ref('')
  const asking = ref(false)
  const boxRef = ref<HTMLElement | null>(null)

  async function loadSuggest() {
    try {
      suggests.value = (await fetchDatasetSuggest(datasetId.value)) || []
    } catch {
      suggests.value = []
    }
  }
  async function scroll() {
    await nextTick()
    if (boxRef.value) boxRef.value.scrollTop = boxRef.value.scrollHeight
  }
  async function ask(q?: string) {
    const text = (q || question.value).trim()
    if (!text || asking.value) return
    question.value = ''
    messages.value.push({ role: 'user', content: text })
    const bot: any = { role: 'assistant', content: '', sql: '', rows: [] as any[] }
    messages.value.push(bot)
    asking.value = true
    await scroll()
    try {
      const r = await fetchDatasetAsk({ datasetId: datasetId.value, question: text })
      bot.sql = r?.sql || ''
      bot.rows = r?.rows || []
      bot.content = Array.isArray(bot.rows)
        ? t('aiDatasetRun.queryDoneRows', { n: bot.rows.length })
        : t('aiDatasetRun.queryDone')
    } catch (e: any) {
      bot.content = e?.message || t('aiDatasetRun.askFailed')
    } finally {
      asking.value = false
      await scroll()
    }
  }
  async function analyze(m: any) {
    const r = await fetchDatasetAnalyze({
      datasetId: datasetId.value,
      question: m.sql ? analyzeQuestion(m.sql) : question.value
    })
    m.content += '\n' + t('aiDatasetRun.analysisPrefix') + ' ' + (r?.analysis || JSON.stringify(r))
  }
  async function predict(m: any) {
    const r = await fetchDatasetPredict({
      datasetId: datasetId.value,
      question: m.sql ? predictQuestion(m.sql) : question.value
    })
    m.content +=
      '\n' + t('aiDatasetRun.predictionPrefix') + ' ' + (r?.prediction || JSON.stringify(r))
  }
  async function editSql(m: any) {
    const { value } = await ElMessageBox.prompt(t('aiDatasetRun.editSqlPrompt'), 'SQL', {
      inputValue: m.sql,
      inputType: 'textarea'
    })
    const r = await fetchDatasetSqlRerun({
      datasetId: datasetId.value,
      id: datasetId.value,
      sql: value
    })
    m.sql = value
    m.rows = r?.rows || []
    m.content = r?.message || t('aiDatasetRun.rerun')
  }
  onMounted(async () => {
    if (!(await aiDatasetExists(datasetId.value))) {
      notFound.value = true
      return
    }
    await loadSuggest()
  })
</script>
<style scoped>
  .ai-dataset-run :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 160px);
  }

  .hd {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
  }

  .hd h3 {
    margin: 0;
    font-size: 16px;
  }

  .suggest {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .tag {
    cursor: pointer;
  }

  .msgs {
    flex: 1;
    padding: 8px 0;
    overflow: auto;
  }

  .msg {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }

  .msg.user {
    flex-direction: row-reverse;
  }

  .role {
    width: 32px;
    height: 32px;
    font-size: 12px;
    line-height: 32px;
    text-align: center;
    background: var(--el-fill-color);
    border-radius: 50%;
  }

  .body {
    max-width: 80%;
    padding: 10px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .sql {
    padding: 8px;
    margin: 8px 0 0;
    white-space: pre-wrap;
    background: var(--el-fill-color-light);
  }

  .ops {
    margin-top: 6px;
  }

  .input {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
</style>
