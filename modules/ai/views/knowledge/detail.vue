<template>
  <div class="art-full-height kb-detail">
    <ElCard class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.push('/ai/knowledge')">返回</ElButton>
        <div class="hd-main">
          <h3>{{ kb?.name || `知识库 #${kbId}` }}</h3>
          <div class="hd-meta">
            <ElTag :type="kb?.status === 1 ? 'success' : 'info'" size="small">
              {{ kb?.status === 1 ? '启用' : '停用' }}
            </ElTag>
            <span>{{ kb?.retrievalMode || 'hybrid' }}</span>
            <span>TopK {{ kb?.topK ?? 6 }}</span>
            <span>最低分 {{ kb?.minScore ?? '-' }}</span>
          </div>
          <p v-if="kb?.description" class="hd-desc">{{ kb.description }}</p>
        </div>
      </div>

      <ElTabs v-model="tab">
        <ElTabPane label="资料" name="asset">
          <div class="toolbar">
            <ElButton type="primary" @click="uploadVisible = true">上传资料</ElButton>
            <ElButton @click="loadAssets">刷新</ElButton>
          </div>
          <ArtTable
            :loading="assetLoading"
            :data="assets"
            :columns="assetCols"
            :pagination="assetPager"
            @pagination:size-change="
              (s: number) => {
                assetSize = s
                loadAssets()
              }
            "
            @pagination:current-change="
              (p: number) => {
                assetPage = p
                loadAssets()
              }
            "
          />
        </ElTabPane>

        <ElTabPane label="分段" name="segment">
          <div class="toolbar">
            <ElButton @click="loadSegs">刷新</ElButton>
            <span class="hint">共 {{ segTotal }} 段 · 编辑后会自动重新向量化</span>
          </div>
          <ArtTable
            :loading="segLoading"
            :data="segments"
            :columns="segCols"
            :pagination="segPager"
            @pagination:size-change="
              (s: number) => {
                segSize = s
                loadSegs()
              }
            "
            @pagination:current-change="
              (p: number) => {
                segPage = p
                loadSegs()
              }
            "
          />
        </ElTabPane>

        <ElTabPane label="向量化" name="vector">
          <div class="vec-stats" v-loading="vecLoading">
            <div class="stat"
              ><b>{{ vecStats.total }}</b
              ><span>总分段</span></div
            >
            <div class="stat ok"
              ><b>{{ vecStats.success }}</b
              ><span>已向量化</span></div
            >
            <div class="stat warn"
              ><b>{{ vecStats.pending }}</b
              ><span>待处理</span></div
            >
            <div class="stat err"
              ><b>{{ vecStats.failed }}</b
              ><span>失败</span></div
            >
          </div>
          <div class="toolbar">
            <ElButton type="primary" :loading="vecActing === 'start'" @click="vec('start')">
              开始向量化（仅待处理）
            </ElButton>
            <ElButton type="warning" :loading="vecActing === 'rebuild'" @click="vec('rebuild')">
              全量重建
            </ElButton>
            <ElButton @click="loadVecStats">刷新统计</ElButton>
          </div>
          <ElAlert
            type="info"
            :closable="false"
            title="向量化为同步执行：完成后统计会更新。不支持暂停。全量重建会先清理旧向量再重新 Embedding。"
          />
        </ElTabPane>

        <ElTabPane label="命中测试" name="hit">
          <ElInput
            v-model="hitQuery"
            type="textarea"
            :rows="3"
            placeholder="输入业务问题，例如：创建知识库时推荐什么检索模式？"
          />
          <div class="toolbar" style="margin-top: 8px">
            <span>TopK</span>
            <ElInputNumber v-model="hitTopK" :min="1" :max="20" size="small" />
            <ElButton type="primary" :loading="hitting" @click="runHit">命中测试</ElButton>
          </div>
          <ElTable
            :data="hitResults"
            style="margin-top: 12px"
            max-height="420"
            empty-text="暂无命中，请先上传资料并完成向量化"
          >
            <ElTableColumn label="分数" width="100">
              <template #default="{ row }">{{ formatScore(row.score) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="source" label="来源" width="140" show-overflow-tooltip />
            <ElTableColumn prop="content" label="内容" min-width="320" show-overflow-tooltip />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDialog v-model="uploadVisible" title="上传资料" width="520px" destroy-on-close>
      <ElForm label-width="100px">
        <ElFormItem label="文件" required>
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.log,.html,.htm"
            @change="onFilePicked"
          />
          <div v-if="uploadForm.fileName" class="hint"
            >已选：{{ uploadForm.fileName }}（{{ uploadForm.contentText?.length || 0 }} 字）</div
          >
        </ElFormItem>
        <ElFormItem label="分段策略">
          <ElSelect v-model="uploadForm.segmentType" style="width: 100%">
            <ElOption label="Markdown 标题" value="markdown" />
            <ElOption label="段落" value="paragraph" />
            <ElOption label="定长" value="length" />
            <ElOption label="按行" value="newline" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="分段长度">
          <ElInputNumber v-model="uploadForm.segmentLength" :min="100" :max="4000" />
        </ElFormItem>
        <ElFormItem label="重叠">
          <ElInputNumber v-model="uploadForm.segmentOverlap" :min="0" :max="500" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="uploadVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="uploading"
          :disabled="!uploadForm.contentText"
          @click="doUpload"
        >
          上传并向量化
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { ColumnOption } from '@/types/component'
  import { computed, h, onMounted, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElButton, ElMessage, ElMessageBox, ElSwitch, ElTag } from 'element-plus'
  import {
    fetchAiKnowledgeDetail,
    fetchKbAssetPage,
    fetchKbHitTest,
    fetchKbSegmentPage,
    fetchKbVectorRebuild,
    fetchKbVectorStart,
    fetchKbVectorStats,
    fetchRemoveKbAsset,
    fetchResegmentKbAsset,
    fetchSaveKbSegment,
    fetchStatusKbSegment,
    fetchUploadKbAsset
  } from '../../api'

  defineOptions({ name: 'AiKnowledgeDetail' })

  const route = useRoute()
  const kbId = computed(() => String(route.params.id || ''))
  const kb = ref<any>(null)
  const tab = ref('asset')

  const assetLoading = ref(false)
  const assets = ref<any[]>([])
  const assetPage = ref(1)
  const assetSize = ref(20)
  const assetTotal = ref(0)
  const assetPager = computed(() => ({
    current: assetPage.value,
    size: assetSize.value,
    total: assetTotal.value
  }))

  const statusTag = (st: string) => {
    const s = (st || '').toLowerCase()
    if (s === 'success') return { type: 'success' as const, label: '已向量化' }
    if (s === 'failed') return { type: 'danger' as const, label: '失败' }
    if (s === 'pending') return { type: 'warning' as const, label: '待处理' }
    return { type: 'info' as const, label: st || '未知' }
  }

  const assetCols: ColumnOption[] = [
    { prop: 'fileName', label: '文件名', minWidth: 200 },
    { prop: 'fileType', label: '类型', width: 100 },
    { prop: 'segmentCount', label: '分段数', width: 90 },
    {
      prop: 'vectorStatus',
      label: '向量状态',
      width: 110,
      formatter: (row: any) => {
        const t = statusTag(row.vectorStatus)
        return h(ElTag, { type: t.type, size: 'small' }, () => t.label)
      }
    },
    {
      prop: 'progress',
      label: '进度',
      width: 80,
      formatter: (row: any) => `${row.progress ?? 0}%`
    },
    {
      prop: 'operation',
      label: '操作',
      width: 180,
      formatter: (row: any) =>
        h('div', [
          h(ElButton, { link: true, size: 'small', onClick: () => reseg(row) }, () => '重分段'),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => rmAsset(row) },
            () => '删除'
          )
        ])
    }
  ]

  const segLoading = ref(false)
  const segments = ref<any[]>([])
  const segPage = ref(1)
  const segSize = ref(20)
  const segTotal = ref(0)
  const segPager = computed(() => ({
    current: segPage.value,
    size: segSize.value,
    total: segTotal.value
  }))
  const allSegs = ref<any[]>([])

  const segCols: ColumnOption[] = [
    { prop: 'seq', label: '#', width: 60 },
    { prop: 'content', label: '内容', minWidth: 280, showOverflowTooltip: true },
    { prop: 'tokenCount', label: 'Tokens', width: 90 },
    {
      prop: 'vectorStatus',
      label: '向量',
      width: 100,
      formatter: (row: any) => {
        const t = statusTag(row.vectorStatus)
        return h(ElTag, { type: t.type, size: 'small' }, () => t.label)
      }
    },
    {
      prop: 'enabled',
      label: '启用',
      width: 80,
      formatter: (row: any) =>
        h(ElSwitch, {
          modelValue: row.enabled === 1,
          'onUpdate:modelValue': (v: string | number | boolean) => {
            const on = v === true || v === 1 || v === '1'
            row.enabled = on ? 1 : 0
            toggleSeg(row, on)
          },
          size: 'small'
        })
    },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      formatter: (row: any) =>
        h(ElButton, { link: true, size: 'small', onClick: () => editSeg(row) }, () => '编辑')
    }
  ]

  const vecLoading = ref(false)
  const vecActing = ref('')
  const vecStats = reactive({ total: 0, success: 0, pending: 0, failed: 0 })

  const hitQuery = ref('')
  const hitTopK = ref(6)
  const hitting = ref(false)
  const hitResults = ref<any[]>([])

  const uploadVisible = ref(false)
  const uploading = ref(false)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const uploadForm = reactive({
    fileName: '',
    contentText: '',
    segmentType: 'markdown',
    segmentLength: 800,
    segmentOverlap: 80
  })

  function formatScore(v: unknown) {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(3) : '-'
  }

  async function loadKb() {
    kb.value = await fetchAiKnowledgeDetail(kbId.value)
  }

  async function loadAssets() {
    assetLoading.value = true
    try {
      const res = await fetchKbAssetPage({ knowledgeId: kbId.value })
      const list = Array.isArray(res) ? res : (res?.records ?? [])
      assetTotal.value = list.length
      const start = (assetPage.value - 1) * assetSize.value
      assets.value = list.slice(start, start + assetSize.value)
    } finally {
      assetLoading.value = false
    }
  }

  async function loadSegs() {
    segLoading.value = true
    try {
      const res = await fetchKbSegmentPage({ knowledgeId: kbId.value })
      const list = Array.isArray(res) ? res : (res?.records ?? [])
      allSegs.value = list
      segTotal.value = list.length
      const start = (segPage.value - 1) * segSize.value
      segments.value = list.slice(start, start + segSize.value)
    } finally {
      segLoading.value = false
    }
  }

  async function loadVecStats() {
    vecLoading.value = true
    try {
      const s = await fetchKbVectorStats(kbId.value)
      Object.assign(vecStats, {
        total: s?.total ?? 0,
        success: s?.success ?? 0,
        pending: s?.pending ?? 0,
        failed: s?.failed ?? 0
      })
    } finally {
      vecLoading.value = false
    }
  }

  function onFilePicked(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!/\.(txt|md|markdown|csv|json|log|html?)$/.test(lower)) {
      ElMessage.warning('当前仅支持文本类：txt / md / csv / json / log / html')
      input.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      uploadForm.fileName = file.name
      uploadForm.contentText = String(reader.result || '')
      if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
        uploadForm.segmentType = 'markdown'
        uploadForm.segmentLength = 800
      } else {
        uploadForm.segmentType = 'paragraph'
        uploadForm.segmentLength = 500
      }
    }
    reader.readAsText(file)
  }

  async function doUpload() {
    if (!uploadForm.contentText?.trim()) {
      ElMessage.warning('请选择文件')
      return
    }
    uploading.value = true
    try {
      const r = await fetchUploadKbAsset({
        knowledgeId: kbId.value,
        fileName: uploadForm.fileName,
        fileType: uploadForm.segmentType === 'markdown' ? 'markdown' : 'text',
        contentText: uploadForm.contentText,
        segmentType: uploadForm.segmentType,
        segmentLength: uploadForm.segmentLength,
        segmentOverlap: uploadForm.segmentOverlap
      })
      ElMessage.success(`上传成功，分段 ${r?.segmentCount ?? 0}，向量状态 ${r?.vectorStatus || ''}`)
      uploadVisible.value = false
      uploadForm.fileName = ''
      uploadForm.contentText = ''
      if (fileInputRef.value) fileInputRef.value.value = ''
      await Promise.all([loadAssets(), loadSegs(), loadVecStats(), loadKb()])
    } finally {
      uploading.value = false
    }
  }

  async function reseg(row: any) {
    await ElMessageBox.confirm(`对「${row.fileName}」重新分段并向量化？`, '重分段')
    const r = await fetchResegmentKbAsset(row.id)
    ElMessage.success(`重分段完成，共 ${r?.segmentCount ?? '?'} 段`)
    await Promise.all([loadAssets(), loadSegs(), loadVecStats()])
  }

  async function rmAsset(row: any) {
    await ElMessageBox.confirm(`删除「${row.fileName}」后，资料和分段都会清掉`, '确认')
    await fetchRemoveKbAsset(row.id)
    await Promise.all([loadAssets(), loadSegs(), loadVecStats(), loadKb()])
  }

  async function editSeg(row: any) {
    const { value } = await ElMessageBox.prompt('编辑分段内容（保存后自动重新向量化）', '分段', {
      inputValue: row.content,
      inputType: 'textarea',
      customClass: 'kb-seg-edit'
    })
    await fetchSaveKbSegment({ id: row.id, content: value })
    ElMessage.success('已保存并重新向量化')
    await Promise.all([loadSegs(), loadVecStats()])
  }

  async function toggleSeg(row: any, enabled: boolean) {
    await fetchStatusKbSegment({ id: row.id, enabled: enabled ? 1 : 0 })
    row.enabled = enabled ? 1 : 0
    ElMessage.success(enabled ? '已启用' : '已禁用')
    await loadVecStats()
  }

  async function vec(act: 'start' | 'rebuild') {
    if (act === 'rebuild') {
      await ElMessageBox.confirm(
        '将清除全部向量并重新 Embedding，耗时取决于分段数量。继续？',
        '全量重建'
      )
    }
    vecActing.value = act
    try {
      const fn = act === 'start' ? fetchKbVectorStart : fetchKbVectorRebuild
      const r = await fn({ knowledgeId: kbId.value })
      ElMessage.success(
        act === 'rebuild'
          ? `重建完成，处理 ${r?.count ?? 0} 段`
          : `向量化完成，处理 ${r?.count ?? 0} 段（待处理 ${r?.pending ?? 0} → 成功 ${r?.success ?? 0}）`
      )
      await Promise.all([loadAssets(), loadSegs(), loadVecStats()])
    } catch (e: any) {
      ElMessage.error(e?.message || '向量化失败')
    } finally {
      vecActing.value = ''
    }
  }

  async function runHit() {
    if (!hitQuery.value.trim()) {
      ElMessage.warning('请输入测试问题')
      return
    }
    hitting.value = true
    try {
      const r = await fetchKbHitTest({
        knowledgeId: kbId.value,
        query: hitQuery.value.trim(),
        topK: hitTopK.value
      })
      hitResults.value = Array.isArray(r) ? r : r?.hits || r?.records || []
      if (!hitResults.value.length) {
        ElMessage.warning('未命中分段：检查是否已向量化、最低分是否过高')
      }
    } finally {
      hitting.value = false
    }
  }

  watch(tab, (t) => {
    if (t === 'asset') void loadAssets()
    if (t === 'segment') void loadSegs()
    if (t === 'vector') void loadVecStats()
  })

  onMounted(async () => {
    await loadKb()
    await loadAssets()
  })
</script>

<style scoped>
  .hd {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .hd-main h3 {
    margin: 0;
    font-size: 16px;
  }

  .hd-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .hd-desc {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  .toolbar {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }

  .hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .vec-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .stat {
    padding: 12px;
    text-align: center;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .stat b {
    display: block;
    font-size: 20px;
  }

  .stat span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .stat.ok b {
    color: var(--el-color-success);
  }

  .stat.warn b {
    color: var(--el-color-warning);
  }

  .stat.err b {
    color: var(--el-color-danger);
  }
</style>
