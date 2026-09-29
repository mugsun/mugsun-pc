<template>
  <div class="art-full-height ai-dataset-run">
    <ElCard class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.back()">返回</ElButton>
        <h3>问数对话 #{{ datasetId }}</h3>
      </div>
      <div class="suggest">
        <ElTag v-for="s in suggests" :key="s" class="tag" @click="ask(s)">{{ s }}</ElTag>
      </div>
      <div ref="boxRef" class="msgs">
        <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
          <div class="role">{{ m.role === 'user' ? '问' : '答' }}</div>
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
              <ElButton link size="small" @click="analyze(m)">数据分析</ElButton>
              <ElButton link size="small" @click="predict(m)">数据预测</ElButton>
              <ElButton link size="small" @click="editSql(m)">编辑 SQL 重跑</ElButton>
            </div>
          </div>
        </div>
      </div>
      <div class="input">
        <ElInput
          v-model="question"
          type="textarea"
          :rows="2"
          placeholder="用自然语言提问"
          @keydown.enter.exact.prevent="ask()"
        />
        <ElButton type="primary" :loading="asking" @click="ask()">提问</ElButton>
      </div>
    </ElCard>
  </div>
</template>
<script setup lang="ts">
  import { computed, nextTick, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    fetchDatasetAnalyze,
    fetchDatasetAsk,
    fetchDatasetPredict,
    fetchDatasetSqlRerun,
    fetchDatasetSuggest
  } from '../../api'
  defineOptions({ name: 'AiDatasetRun' })
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
      bot.content = Array.isArray(bot.rows) ? `查询完成，共 ${bot.rows.length} 行` : '查询完成'
    } catch (e: any) {
      ElMessage.error(e?.message || '问数失败')
      bot.content = '问数失败'
    } finally {
      asking.value = false
      await scroll()
    }
  }
  async function analyze(m: any) {
    const r = await fetchDatasetAnalyze({
      datasetId: datasetId.value,
      question: m.sql ? `基于 SQL 分析：${m.sql}` : question.value
    })
    m.content += '\n[分析] ' + (r?.analysis || JSON.stringify(r))
  }
  async function predict(m: any) {
    const r = await fetchDatasetPredict({
      datasetId: datasetId.value,
      question: m.sql ? `基于 SQL 预测：${m.sql}` : question.value
    })
    m.content += '\n[预测] ' + (r?.prediction || JSON.stringify(r))
  }
  async function editSql(m: any) {
    const { value } = await ElMessageBox.prompt('编辑 SQL 后重跑', 'SQL', {
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
    m.content = r?.message || '已重跑'
  }
  onMounted(loadSuggest)
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
