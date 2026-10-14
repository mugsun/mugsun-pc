<template>
  <div class="art-full-height kb-detail">
    <AiNotFound
      v-if="notFound"
      :what="$t('aiKbDetail.what')"
      :id="kbId"
      back-path="/ai/knowledge"
      :back-text="$t('aiKbDetail.backToList')"
    />
    <ElCard v-else class="art-table-card" shadow="never">
      <div class="hd">
        <ElButton @click="$router.push('/ai/knowledge')">{{ $t('aiKbDetail.back') }}</ElButton>
        <div class="hd-main">
          <h3>{{ kb?.name || $t('aiKbDetail.titleFallback', { id: kbId }) }}</h3>
          <div class="hd-meta">
            <ElTag :type="kb?.status === 1 ? 'success' : 'info'" size="small">
              {{ kb?.status === 1 ? $t('aiKbDetail.enabled') : $t('aiKbDetail.disabled') }}
            </ElTag>
            <span>{{ kb?.retrievalMode || 'hybrid' }}</span>
            <span>TopK {{ kb?.topK ?? 6 }}</span>
            <span>{{ $t('aiKbDetail.minScore') }} {{ kb?.minScore ?? '-' }}</span>
          </div>
          <p v-if="kb?.description" class="hd-desc">{{ kb.description }}</p>
        </div>
      </div>

      <ElTabs v-model="tab">
        <ElTabPane :label="$t('aiKbDetail.tabAssets')" name="asset">
          <div class="toolbar">
            <ElButton type="primary" @click="uploadVisible = true">{{
              $t('aiKbDetail.upload')
            }}</ElButton>
            <ElButton @click="loadAssets">{{ $t('aiKbDetail.refresh') }}</ElButton>
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

        <ElTabPane :label="$t('aiKbDetail.tabSegments')" name="segment">
          <div class="toolbar">
            <ElButton @click="loadSegs">{{ $t('aiKbDetail.refresh') }}</ElButton>
            <span class="hint">{{ $t('aiKbDetail.segHint', { n: segTotal }) }}</span>
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

        <ElTabPane :label="$t('aiKbDetail.tabVector')" name="vector">
          <div class="vec-stats" v-loading="vecLoading">
            <div class="stat"
              ><b>{{ vecStats.total }}</b
              ><span>{{ $t('aiKbDetail.statTotal') }}</span></div
            >
            <div class="stat ok"
              ><b>{{ vecStats.success }}</b
              ><span>{{ $t('aiKbDetail.statSuccess') }}</span></div
            >
            <div class="stat warn"
              ><b>{{ vecStats.pending }}</b
              ><span>{{ $t('aiKbDetail.statPending') }}</span></div
            >
            <div class="stat err"
              ><b>{{ vecStats.failed }}</b
              ><span>{{ $t('aiKbDetail.statFailed') }}</span></div
            >
          </div>
          <div class="toolbar">
            <ElButton type="primary" :loading="vecActing === 'start'" @click="vec('start')">
              {{ $t('aiKbDetail.vecStart') }}
            </ElButton>
            <ElButton type="warning" :loading="vecActing === 'rebuild'" @click="vec('rebuild')">
              {{ $t('aiKbDetail.vecRebuild') }}
            </ElButton>
            <ElButton @click="loadVecStats">{{ $t('aiKbDetail.refreshStats') }}</ElButton>
          </div>
          <ElAlert type="info" :closable="false" :title="$t('aiKbDetail.vecTip')" />
        </ElTabPane>

        <ElTabPane :label="$t('aiKbDetail.tabHit')" name="hit">
          <ElInput
            v-model="hitQuery"
            type="textarea"
            :rows="3"
            :placeholder="$t('aiKbDetail.hitPlaceholder')"
          />
          <div class="toolbar" style="margin-top: 8px">
            <span>TopK</span>
            <ElInputNumber v-model="hitTopK" :min="1" :max="20" size="small" />
            <ElButton type="primary" :loading="hitting" @click="runHit">{{
              $t('aiKbDetail.tabHit')
            }}</ElButton>
          </div>
          <ElTable
            :data="hitResults"
            style="margin-top: 12px"
            max-height="420"
            :empty-text="$t('aiKbDetail.hitEmpty')"
          >
            <ElTableColumn :label="$t('aiKbDetail.score')" width="100">
              <template #default="{ row }">{{ formatScore(row.score) }}</template>
            </ElTableColumn>
            <ElTableColumn
              prop="source"
              :label="$t('aiKbDetail.source')"
              width="140"
              show-overflow-tooltip
            />
            <ElTableColumn
              prop="content"
              :label="$t('aiKbDetail.content')"
              min-width="320"
              show-overflow-tooltip
            />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDialog
      v-model="uploadVisible"
      :title="$t('aiKbDetail.upload')"
      width="520px"
      destroy-on-close
    >
      <ElForm label-width="auto">
        <ElFormItem :label="$t('aiKbDetail.file')" required>
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt,.md,.markdown,.csv,.json,.log,.html,.htm"
            @change="onFilePicked"
          />
          <div v-if="uploadForm.fileName" class="hint">{{
            $t('aiKbDetail.picked', {
              name: uploadForm.fileName,
              n: uploadForm.contentText?.length || 0
            })
          }}</div>
        </ElFormItem>
        <ElFormItem :label="$t('aiKbDetail.segStrategy')">
          <ElSelect v-model="uploadForm.segmentType" style="width: 100%">
            <ElOption :label="$t('aiKbDetail.segMarkdown')" value="markdown" />
            <ElOption :label="$t('aiKbDetail.segParagraph')" value="paragraph" />
            <ElOption :label="$t('aiKbDetail.segLength')" value="length" />
            <ElOption :label="$t('aiKbDetail.segNewline')" value="newline" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiKbDetail.segLengthLabel')">
          <ElInputNumber v-model="uploadForm.segmentLength" :min="100" :max="4000" />
        </ElFormItem>
        <ElFormItem :label="$t('aiKbDetail.overlap')">
          <ElInputNumber v-model="uploadForm.segmentOverlap" :min="0" :max="500" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="uploadVisible = false">{{ $t('aiKbDetail.cancel') }}</ElButton>
        <ElButton
          type="primary"
          :loading="uploading"
          :disabled="!uploadForm.contentText"
          @click="doUpload"
        >
          {{ $t('aiKbDetail.uploadAndVectorize') }}
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { ColumnOption } from '@/types/component'
  import { computed, h, nextTick, onMounted, reactive, ref, watch } from 'vue'
  import AiNotFound from '../shared/AiNotFound.vue'
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
  const { t } = useI18n()
  /** id 不存在或已删除时只显示占位与返回入口（UX-105） */
  const notFound = ref(false)

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
    if (s === 'success') return { type: 'success' as const, label: t('aiKbDetail.statSuccess') }
    if (s === 'failed') return { type: 'danger' as const, label: t('aiKbDetail.statFailed') }
    if (s === 'pending') return { type: 'warning' as const, label: t('aiKbDetail.statPending') }
    return { type: 'info' as const, label: st || t('aiKbDetail.unknown') }
  }

  const assetCols = computed<ColumnOption[]>(() => [
    { prop: 'fileName', label: t('aiKbDetail.colFileName'), minWidth: 200 },
    { prop: 'fileType', label: t('aiKbDetail.colType'), width: 100 },
    { prop: 'segmentCount', label: t('aiKbDetail.colSegments'), width: 90 },
    {
      prop: 'vectorStatus',
      label: t('aiKbDetail.colVectorStatus'),
      width: 110,
      formatter: (row: any) => {
        const tag = statusTag(row.vectorStatus)
        return h(ElTag, { type: tag.type, size: 'small' }, () => tag.label)
      }
    },
    {
      prop: 'progress',
      label: t('aiKbDetail.colProgress'),
      width: 80,
      formatter: (row: any) => `${row.progress ?? 0}%`
    },
    {
      prop: 'operation',
      label: t('aiKbDetail.colActions'),
      width: 180,
      formatter: (row: any) =>
        h('div', [
          h(ElButton, { link: true, size: 'small', onClick: () => reseg(row) }, () =>
            t('aiKbDetail.reseg')
          ),
          h(
            ElButton,
            { link: true, type: 'danger', size: 'small', onClick: () => rmAsset(row) },
            () => t('aiKbDetail.delete')
          )
        ])
    }
  ])

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

  const segCols = computed<ColumnOption[]>(() => [
    { prop: 'seq', label: '#', width: 60 },
    { prop: 'content', label: t('aiKbDetail.content'), minWidth: 280, showOverflowTooltip: true },
    { prop: 'tokenCount', label: 'Tokens', width: 90 },
    {
      prop: 'vectorStatus',
      label: t('aiKbDetail.colVector'),
      width: 100,
      formatter: (row: any) => {
        const tag = statusTag(row.vectorStatus)
        return h(ElTag, { type: tag.type, size: 'small' }, () => tag.label)
      }
    },
    {
      prop: 'enabled',
      label: t('aiKbDetail.enabled'),
      width: 80,
      formatter: (row: any) =>
        h(ElSwitch, {
          modelValue: row.enabled === 1,
          'onUpdate:modelValue': (v: string | number | boolean) => {
            const on = v === true || v === 1 || v === '1'
            void toggleSeg(row, on)
          },
          size: 'small'
        })
    },
    {
      prop: 'operation',
      label: t('aiKbDetail.colActions'),
      width: 100,
      formatter: (row: any) =>
        h(ElButton, { link: true, size: 'small', onClick: () => editSeg(row) }, () =>
          t('aiKbDetail.edit')
        )
    }
  ])

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

  /** 首次进入静默探测：报错或空都算不存在，不再弹 toast 后照常渲染假页面 */
  async function probeKb(): Promise<boolean> {
    try {
      kb.value = await fetchAiKnowledgeDetail(kbId.value, { showErrorMessage: false })
    } catch {
      kb.value = null
    }
    return !!kb.value?.id
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
      ElMessage.warning(t('aiKbDetail.onlyText'))
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
      ElMessage.warning(t('aiKbDetail.pickFile'))
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
      ElMessage.success(
        t('aiKbDetail.uploadOk', { n: r?.segmentCount ?? 0, status: r?.vectorStatus || '' })
      )
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
    await ElMessageBox.confirm(
      t('aiKbDetail.resegConfirm', { name: row.fileName }),
      t('aiKbDetail.reseg')
    )
    const r = await fetchResegmentKbAsset(row.id)
    ElMessage.success(t('aiKbDetail.resegOk', { n: r?.segmentCount ?? '?' }))
    await Promise.all([loadAssets(), loadSegs(), loadVecStats()])
  }

  async function rmAsset(row: any) {
    await ElMessageBox.confirm(
      t('aiKbDetail.removeConfirm', { name: row.fileName }),
      t('aiKbDetail.confirmTitle')
    )
    await fetchRemoveKbAsset(row.id)
    await Promise.all([loadAssets(), loadSegs(), loadVecStats(), loadKb()])
  }

  async function editSeg(row: any) {
    const { value } = await ElMessageBox.prompt(
      t('aiKbDetail.editSegPrompt'),
      t('aiKbDetail.tabSegments'),
      {
        inputValue: row.content,
        inputType: 'textarea',
        customClass: 'kb-seg-edit'
      }
    )
    await fetchSaveKbSegment({ id: row.id, content: value })
    ElMessage.success(t('aiKbDetail.savedRevectorized'))
    await Promise.all([loadSegs(), loadVecStats()])
  }

  async function toggleSeg(row: any, enabled: boolean) {
    const prev = row.enabled
    try {
      await fetchStatusKbSegment({ id: row.id, enabled: enabled ? 1 : 0 })
      row.enabled = enabled ? 1 : 0
    } catch {
      row.enabled = enabled ? 0 : 1
      await nextTick()
      row.enabled = prev
    }
  }

  async function vec(act: 'start' | 'rebuild') {
    if (act === 'rebuild') {
      await ElMessageBox.confirm(t('aiKbDetail.rebuildConfirm'), t('aiKbDetail.vecRebuild'))
    }
    vecActing.value = act
    try {
      const fn = act === 'start' ? fetchKbVectorStart : fetchKbVectorRebuild
      const r = await fn({ knowledgeId: kbId.value })
      ElMessage.success(
        act === 'rebuild'
          ? t('aiKbDetail.rebuildOk', { n: r?.count ?? 0 })
          : t('aiKbDetail.vecOk', {
              n: r?.count ?? 0,
              pending: r?.pending ?? 0,
              success: r?.success ?? 0
            })
      )
      await Promise.all([loadAssets(), loadSegs(), loadVecStats()])
    } catch (e: any) {
      ElMessage.error(e?.message || t('aiKbDetail.vecFailed'))
    } finally {
      vecActing.value = ''
    }
  }

  async function runHit() {
    if (!hitQuery.value.trim()) {
      ElMessage.warning(t('aiKbDetail.enterQuestion'))
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
        ElMessage.warning(t('aiKbDetail.noHitTip'))
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
    if (!(await probeKb())) {
      notFound.value = true
      return
    }
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
