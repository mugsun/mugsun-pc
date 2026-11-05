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
            <ElButton v-if="canUpload" type="primary" @click="openUpload">{{
              $t('aiKbDetail.upload')
            }}</ElButton>
            <ElButton @click="() => loadAssets()">{{ $t('aiKbDetail.refresh') }}</ElButton>
            <span v-if="polling" class="hint">{{ $t('aiKbDetail.polling') }}</span>
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
            <ElSelect
              v-model="segAssetId"
              clearable
              filterable
              :placeholder="$t('aiKbDetail.filterAsset')"
              style="width: 240px"
              @change="onSegAssetChange"
            >
              <ElOption :label="$t('aiKbDetail.allAssets')" value="" />
              <ElOption
                v-for="a in assetOptions"
                :key="a.id"
                :label="a.fileName || String(a.id)"
                :value="String(a.id)"
              />
            </ElSelect>
            <ElButton @click="() => loadSegs()">{{ $t('aiKbDetail.refresh') }}</ElButton>
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
            <ElButton @click="() => loadVecStats()">{{ $t('aiKbDetail.refreshStats') }}</ElButton>
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
      width="560px"
      destroy-on-close
      @closed="resetUpload"
    >
      <ElForm label-width="auto">
        <ElFormItem :label="$t('aiKbDetail.file')" required>
          <ElUpload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :accept="acceptAttr"
            :disabled="uploading"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :on-exceed="handleFileExceed"
          >
            <ElButton :disabled="uploading">{{ $t('aiKbDetail.pickFileBtn') }}</ElButton>
            <template #tip>
              <div class="el-upload__tip">{{ $t('aiKbDetail.uploadTip') }}</div>
            </template>
          </ElUpload>
          <div v-if="pickedFile" class="hint">{{
            $t('aiKbDetail.pickedFile', {
              name: pickedFile.name,
              size: formatBytes(pickedFile.size)
            })
          }}</div>
        </ElFormItem>
        <ElFormItem :label="$t('aiKbDetail.segStrategy')">
          <ElSelect v-model="uploadForm.segmentType" style="width: 100%" :disabled="uploading">
            <ElOption :label="$t('aiKbDetail.segMarkdown')" value="markdown" />
            <ElOption :label="$t('aiKbDetail.segParagraph')" value="paragraph" />
            <ElOption :label="$t('aiKbDetail.segLength')" value="length" />
            <ElOption :label="$t('aiKbDetail.segNewline')" value="newline" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="$t('aiKbDetail.segLengthLabel')">
          <ElInputNumber
            v-model="uploadForm.segmentLength"
            :min="100"
            :max="4000"
            :disabled="uploading"
          />
        </ElFormItem>
        <ElFormItem :label="$t('aiKbDetail.overlap')">
          <ElInputNumber
            v-model="uploadForm.segmentOverlap"
            :min="0"
            :max="500"
            :disabled="uploading"
          />
        </ElFormItem>
        <ElFormItem v-if="uploading" :label="$t('aiKbDetail.colProgress')">
          <ElProgress :percentage="uploadPercent" :stroke-width="14" />
          <div class="hint">{{ $t('aiKbDetail.uploading') }}</div>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="uploading" @click="uploadVisible = false">{{
          $t('aiKbDetail.cancel')
        }}</ElButton>
        <ElButton type="primary" :loading="uploading" :disabled="!pickedFile" @click="doUpload">
          {{ $t('aiKbDetail.uploadAndVectorize') }}
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import type { ColumnOption } from '@/types/component'
  import { computed, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
  import AiNotFound from '../shared/AiNotFound.vue'
  import { useRoute } from 'vue-router'
  import {
    ElButton,
    ElMessage,
    ElMessageBox,
    ElProgress,
    ElSwitch,
    ElTag,
    type UploadFile,
    type UploadInstance,
    type UploadRawFile
  } from 'element-plus'
  import { hasPerm } from '@/utils/permission'
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
    fetchUploadKbAsset,
    fetchUploadKbAssetFile
  } from '../../api'
  import { assetNeedsPoll, checkKbUploadFile, kbUploadAcceptAttr } from './kbUploadFile'

  defineOptions({ name: 'AiKnowledgeDetail' })
  const { t } = useI18n()
  /** id 不存在或已删除时只显示占位与返回入口（UX-105） */
  const notFound = ref(false)

  const route = useRoute()
  const kbId = computed(() => String(route.params.id || ''))
  const kb = ref<any>(null)
  const tab = ref('asset')
  const canUpload = computed(() => hasPerm('ai:kb-asset:upload'))

  const assetLoading = ref(false)
  const assets = ref<any[]>([])
  const allAssets = ref<any[]>([])
  const assetPage = ref(1)
  const assetSize = ref(20)
  const assetTotal = ref(0)
  const assetPager = computed(() => ({
    current: assetPage.value,
    size: assetSize.value,
    total: assetTotal.value
  }))
  const assetOptions = computed(() => allAssets.value)

  const polling = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const statusTag = (st: string) => {
    const s = (st || '').toLowerCase()
    if (s === 'success') return { type: 'success' as const, label: t('aiKbDetail.statSuccess') }
    if (s === 'failed') return { type: 'danger' as const, label: t('aiKbDetail.statFailed') }
    if (s === 'pending') return { type: 'warning' as const, label: t('aiKbDetail.statPending') }
    if (s === 'keyword') return { type: 'info' as const, label: t('aiKbDetail.statKeyword') }
    return { type: 'info' as const, label: st || t('aiKbDetail.unknown') }
  }

  const assetCols = computed<ColumnOption[]>(() => [
    { prop: 'fileName', label: t('aiKbDetail.colFileName'), minWidth: 180 },
    { prop: 'fileType', label: t('aiKbDetail.colType'), width: 90 },
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
      width: 120,
      formatter: (row: any) => {
        const pct = Number(row.progress ?? 0)
        const pending = assetNeedsPoll(row.vectorStatus)
        if (pending) {
          return h(ElProgress, { percentage: Math.min(100, Math.max(0, pct)), strokeWidth: 10 })
        }
        return `${pct}%`
      }
    },
    {
      prop: 'failReason',
      label: t('aiKbDetail.colFailReason'),
      minWidth: 160,
      formatter: (row: any) => {
        const reason = String(row.failReason || '').trim()
        if (!reason) return '—'
        return h(
          'span',
          {
            class: 'kb-fail-reason',
            title: reason
          },
          reason
        )
      }
    },
    {
      prop: 'operation',
      label: t('aiKbDetail.colActions'),
      width: 220,
      formatter: (row: any) =>
        h('div', [
          h(ElButton, { link: true, size: 'small', onClick: () => viewSegs(row) }, () =>
            t('aiKbDetail.viewSegs')
          ),
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
  const segAssetId = ref('')
  const segPager = computed(() => ({
    current: segPage.value,
    size: segSize.value,
    total: segTotal.value
  }))

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
      width: 100,
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
  const uploadPercent = ref(0)
  const uploadRef = ref<UploadInstance>()
  const pickedFile = ref<File | null>(null)
  const uploadMode = ref<'file' | 'text' | ''>('')
  const acceptAttr = kbUploadAcceptAttr()
  const uploadForm = reactive({
    segmentType: 'paragraph',
    segmentLength: 800,
    segmentOverlap: 80
  })

  function formatScore(v: unknown) {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(3) : '-'
  }

  function formatBytes(n: number) {
    if (!Number.isFinite(n) || n < 0) return '-'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
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

  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    polling.value = false
  }

  function maybeStartPoll(list: any[]) {
    const need = list.some((a) => assetNeedsPoll(a?.vectorStatus))
    if (!need) {
      stopPoll()
      return
    }
    if (pollTimer) return
    polling.value = true
    pollTimer = setInterval(() => {
      void loadAssets({ quiet: true })
    }, 2500)
  }

  async function loadAssets(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) assetLoading.value = true
    try {
      const res = await fetchKbAssetPage({ knowledgeId: kbId.value })
      const list = Array.isArray(res) ? res : (res?.records ?? [])
      allAssets.value = list
      assetTotal.value = list.length
      const start = (assetPage.value - 1) * assetSize.value
      assets.value = list.slice(start, start + assetSize.value)
      maybeStartPoll(list)
    } finally {
      if (!opts?.quiet) assetLoading.value = false
    }
  }

  async function loadSegs() {
    segLoading.value = true
    try {
      const params: Record<string, any> = { knowledgeId: kbId.value }
      if (segAssetId.value) params.assetId = segAssetId.value
      const res = await fetchKbSegmentPage(params)
      const list = Array.isArray(res) ? res : (res?.records ?? [])
      segTotal.value = list.length
      const start = (segPage.value - 1) * segSize.value
      segments.value = list.slice(start, start + segSize.value)
    } finally {
      segLoading.value = false
    }
  }

  function onSegAssetChange() {
    segPage.value = 1
    void loadSegs()
  }

  function viewSegs(row: any) {
    segAssetId.value = row?.id != null ? String(row.id) : ''
    tab.value = 'segment'
    segPage.value = 1
    void loadSegs()
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

  function openUpload() {
    if (!canUpload.value) {
      ElMessage.warning(t('aiKbDetail.noUploadPerm'))
      return
    }
    uploadVisible.value = true
  }

  function resetUpload() {
    uploadRef.value?.clearFiles()
    pickedFile.value = null
    uploadMode.value = ''
    uploading.value = false
    uploadPercent.value = 0
    uploadForm.segmentType = 'paragraph'
    uploadForm.segmentLength = 800
    uploadForm.segmentOverlap = 80
  }

  function warnCheck(reason: 'type' | 'empty' | 'size') {
    if (reason === 'empty') ElMessage.warning(t('aiKbDetail.fileEmpty'))
    else if (reason === 'size') ElMessage.warning(t('aiKbDetail.fileTooLarge'))
    else ElMessage.warning(t('aiKbDetail.onlyDocs'))
  }

  function applyPicked(raw: File) {
    const check = checkKbUploadFile(raw)
    if (!check.ok) {
      warnCheck(check.reason)
      uploadRef.value?.clearFiles()
      pickedFile.value = null
      uploadMode.value = ''
      return false
    }
    pickedFile.value = raw
    uploadMode.value = check.mode
    if (check.mode === 'text' && (check.ext === '.md' || check.ext === '.markdown')) {
      uploadForm.segmentType = 'markdown'
      uploadForm.segmentLength = 800
    } else {
      uploadForm.segmentType = 'paragraph'
      uploadForm.segmentLength = check.mode === 'file' ? 800 : 500
    }
    return true
  }

  const handleFileChange = (uploadFile: UploadFile): void => {
    const raw = uploadFile.raw
    if (!raw || !applyPicked(raw)) return
  }

  const handleFileRemove = (): void => {
    pickedFile.value = null
    uploadMode.value = ''
  }

  const handleFileExceed = (files: File[]): void => {
    uploadRef.value?.clearFiles()
    const raw = files[0] as UploadRawFile
    if (!applyPicked(raw)) return
    uploadRef.value?.handleStart(raw)
  }

  async function doUpload() {
    if (!pickedFile.value || !uploadMode.value) {
      ElMessage.warning(t('aiKbDetail.pickFile'))
      return
    }
    if (!canUpload.value) {
      ElMessage.warning(t('aiKbDetail.noUploadPerm'))
      return
    }
    uploading.value = true
    uploadPercent.value = 0
    try {
      let r: any
      if (uploadMode.value === 'file') {
        const form = new FormData()
        form.append('knowledgeId', kbId.value)
        form.append('file', pickedFile.value)
        form.append('segmentType', uploadForm.segmentType)
        form.append('segmentLength', String(uploadForm.segmentLength))
        form.append('segmentOverlap', String(uploadForm.segmentOverlap))
        r = await fetchUploadKbAssetFile(form, {
          onUploadProgress: (e) => {
            const total = e.total && e.total > 0 ? e.total : pickedFile.value?.size || 0
            if (total > 0) {
              uploadPercent.value = Math.min(99, Math.round((e.loaded / total) * 100))
            }
          }
        })
        uploadPercent.value = 100
      } else {
        const contentText = await pickedFile.value.text()
        if (!contentText.trim()) {
          ElMessage.warning(t('aiKbDetail.fileEmpty'))
          return
        }
        uploadPercent.value = 30
        r = await fetchUploadKbAsset({
          knowledgeId: kbId.value,
          fileName: pickedFile.value.name,
          fileType: uploadForm.segmentType === 'markdown' ? 'markdown' : 'text',
          contentText,
          segmentType: uploadForm.segmentType,
          segmentLength: uploadForm.segmentLength,
          segmentOverlap: uploadForm.segmentOverlap
        })
        uploadPercent.value = 100
      }
      ElMessage.success(
        t('aiKbDetail.uploadOk', { n: r?.segmentCount ?? 0, status: r?.vectorStatus || '' })
      )
      uploadVisible.value = false
      await Promise.all([loadAssets(), loadSegs(), loadVecStats(), loadKb()])
    } catch (e: any) {
      // 业务错误文案由 http 层 toast；此处保留列表态
      const msg = e?.message || e?.msg
      if (msg) {
        // 已由 showError 提示时避免重复；仅兜底
      }
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

  watch(tab, (tName) => {
    if (tName === 'asset') void loadAssets()
    if (tName === 'segment') void loadSegs()
    if (tName === 'vector') void loadVecStats()
  })

  onMounted(async () => {
    if (!(await probeKb())) {
      notFound.value = true
      return
    }
    await loadAssets()
  })

  onUnmounted(() => {
    stopPoll()
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

  :deep(.kb-fail-reason) {
    font-size: 12px;
    color: var(--el-color-danger);
  }
</style>
