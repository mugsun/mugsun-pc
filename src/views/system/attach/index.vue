<!-- 附件管理页面 -->
<template>
  <div class="attach-page art-full-height">
    <!-- 查询栏：文件名模糊 / 类型精确，条件实时生效、重置回默认 -->
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :span="6"
      @search="handleSearch"
      @reset="handleResetSearch"
    />
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton :loading="uploading" @click="triggerUpload" v-ripple>{{
            $t('pages.system.attach.uploadBtn')
          }}</ElButton>
          <input ref="uploadInput" type="file" style="display: none" @change="handleUpload" />
          <ElProgress
            v-if="uploading && directUploading"
            :percentage="uploadPercent"
            class="attach-progress"
          />
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data as any[]"
        :columns="columns"
        :pagination="pagination"
        border
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { h, ref, watch, onBeforeUnmount } from 'vue'
  import ArtSearchBar from '@/components/core/forms/art-search-bar/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchAttachPage } from '@/api/attach'
  import {
    fetchUploadFile,
    fetchPresignedPut,
    fetchCreateAttach,
    fetchRemoveAttach
  } from '@/api/system-manage'
  import request from '@/utils/http'
  import { formatTableTime } from '@/utils/date'
  import { ElButton, ElImage, ElMessageBox, ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Attach' })

  const { t } = useI18n()

  /** 支持缩略图预览的图片扩展名 */
  const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']

  // ===== 查询栏 =====
  const searchForm = ref({
    filename: '',
    ext: ''
  })
  const searchItems = computed(() => [
    {
      key: 'filename',
      label: t('pages.system.attach.filenameLabel'),
      type: 'input',
      props: { placeholder: t('pages.system.attach.filenamePlaceholder'), clearable: true }
    },
    {
      key: 'ext',
      label: t('pages.system.attach.extLabel'),
      type: 'input',
      props: { placeholder: t('pages.system.attach.extPlaceholder'), clearable: true }
    }
  ])

  const uploadInput = ref<HTMLInputElement>()
  const uploading = ref(false)
  /** 是否命中两段式直传（云存储平台），决定进度条可见性 */
  const directUploading = ref(false)
  const uploadPercent = ref(0)

  const isImage = (row: any): boolean =>
    !!row.ext && IMAGE_EXTS.includes(String(row.ext).toLowerCase())

  // ===== 图片预览（私有附件经 download-stream 鉴权链取字节 → objectURL） =====
  const previewObjectUrls = new Set<string>()

  const loadPreviews = (rows: any[]): void => {
    // 换页/刷新即回收上一批 objectURL，防内存泄漏
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url))
    previewObjectUrls.clear()
    ;(rows || []).forEach(async (row) => {
      // 平台已下线的历史附件（downloadable=false）跳过预览，不制造 404 噪音（下载入口仍在，点击会如实报错）
      if (!isImage(row) || row.previewUrl || row.downloadable === false) return
      try {
        const blob = await request.request<Blob>({
          url: `/api/system/file/download-stream/${row.id}`,
          responseType: 'blob',
          skipEnvelope: true,
          transformResponse: [(d) => d],
          showErrorMessage: false
        })
        // 鉴权失败时后端回 JSON 错误信封而非图片字节，此类 blob 不生成预览
        if (blob instanceof Blob && blob.type.startsWith('image/')) {
          const url = URL.createObjectURL(blob)
          previewObjectUrls.add(url)
          row.previewUrl = url
        }
      } catch {
        /* 预览失败静默（下载入口仍在） */
      }
    })
  }

  onBeforeUnmount(() => {
    previewObjectUrls.forEach((url) => URL.revokeObjectURL(url))
    previewObjectUrls.clear()
  })

  const formatSize = (size: number): string => {
    if (!size) return '-'
    if (size < 1024) return size + ' B'
    if (size < 1048576) return (size / 1024).toFixed(1) + ' KB'
    return (size / 1048576).toFixed(1) + ' MB'
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    fetchData,
    replaceSearchParams,
    resetSearchParams
  } = useTable({
    core: {
      apiFn: fetchAttachPage,
      apiParams: { pageNum: 1, pageSize: 20 },
      // 后端分页参数为 pageNum/pageSize
      paginationKey: { current: 'pageNum', size: 'pageSize' },
      columnsFactory: () => [
        { type: 'index', width: 60, label: t('pages.system.attach.colIndex') },
        {
          prop: 'preview',
          label: t('pages.system.attach.colPreview'),
          width: 80,
          // 图片附件缩略图（el-image 点击放大预览）；非图片/未加载完成显示占位
          formatter: (row: any) =>
            row.previewUrl
              ? h(ElImage, {
                  src: row.previewUrl,
                  previewSrcList: [row.previewUrl],
                  fit: 'cover',
                  previewTeleported: true,
                  style: 'width:44px;height:44px;border-radius:4px;display:block'
                })
              : h('span', { style: 'color:var(--el-text-color-secondary)' }, '—')
        },
        {
          prop: 'name',
          label: t('pages.system.attach.filenameLabel'),
          minWidth: 220,
          showOverflowTooltip: true
        },
        { prop: 'ext', label: t('pages.system.attach.extLabel'), width: 90 },
        {
          prop: 'size',
          label: t('pages.system.attach.colSize'),
          width: 110,
          formatter: (row: any) => formatSize(row.size)
        },
        { prop: 'platform', label: t('pages.system.attach.colPlatform'), width: 130 },
        {
          prop: 'createTime',
          label: t('pages.system.attach.colUploadTime'),
          minWidth: 170,
          formatter: (row: any) => formatTableTime(row.createTime)
        },
        {
          prop: 'operation',
          label: t('pages.system.attach.colOperation'),
          width: 130,
          fixed: 'right',
          formatter: (row: any) =>
            h('div', { class: 'flex gap-1' }, [
              h(
                ElButton,
                { link: true, type: 'primary', size: 'small', onClick: () => download(row) },
                () => t('pages.system.attach.downloadBtn')
              ),
              h(
                ElButton,
                {
                  link: true,
                  type: 'danger',
                  size: 'small',
                  onClick: () => deleteRow(row)
                },
                () => t('common.delete')
              )
            ])
        }
      ]
    },
    transform: {
      // 适配后端 mybatis-flex Page：records + totalRow
      responseAdapter: (resp: any) => ({
        records: resp?.records ?? [],
        total: resp?.totalRow ?? 0,
        current: resp?.pageNumber ?? 1,
        size: resp?.pageSize ?? 20
      })
    }
  })

  // 数据到位后懒加载图片缩略图（每页图片数量有限，逐条取流）
  watch(data, (rows) => loadPreviews(rows as any[]))

  // ===== 查询栏联动 =====
  const handleSearch = async (params: Record<string, any>): Promise<void> => {
    // 替换全部查询参数（防旧条件残留），回到第一页
    replaceSearchParams({ ...params, pageNum: 1, pageSize: 20 })
    await fetchData()
  }

  const handleResetSearch = async (): Promise<void> => {
    searchForm.value = {
      filename: '',
      ext: ''
    }
    resetSearchParams()
    await fetchData()
  }

  const triggerUpload = (): void => {
    uploadInput.value?.click()
  }

  /** XHR PUT 直传云存储（带上传进度；仅携带签发回执的 headers） */
  const putToCloud = (url: string, headers: Record<string, string>, file: File): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      Object.entries(headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value))
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) uploadPercent.value = Math.round((e.loaded / e.total) * 100)
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`直传失败 HTTP ${xhr.status}`))
      xhr.onerror = () => reject(new Error('直传网络错误'))
      xhr.send(file)
    })

  /**
   * 两段式直传：先求 presigned-put 签发 → 命中（云存储平台）则 PUT 直传 + create 回填；
   * supported=false（本地存储不支持预签名）回退既有 multipart 上传。
   */
  const handleUpload = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    uploading.value = true
    directUploading.value = false
    uploadPercent.value = 0
    try {
      const sign = await fetchPresignedPut({ filename: file.name, access: 'private' })
      if (sign?.supported && sign.uploadUrl && sign.ticket) {
        directUploading.value = true
        try {
          await putToCloud(sign.uploadUrl, sign.headers || {}, file)
        } catch {
          // 直传走裸 XHR、不经 http 拦截器，失败须自行提示，避免静默失败（finally 仍会复位状态）
          ElMessage.error(t('pages.system.attach.directUploadFailed'))
          return
        }
        await fetchCreateAttach({ ticket: sign.ticket, size: file.size })
      } else {
        await fetchUploadFile(file)
      }
      ElMessage.success(t('pages.system.attach.uploadSuccess'))
      refreshData()
    } finally {
      uploading.value = false
      directUploading.value = false
      input.value = ''
    }
  }

  const download = (row: any): Promise<void> =>
    // 授权流式下载：统一走 request.download（带 token + 真实文件名 + 失败 toast）
    request.download({
      url: `/api/system/file/download-stream/${row.id}`,
      filename: row.name || row.filename
    })

  const deleteRow = (row: any): void => {
    ElMessageBox.confirm(
      t('pages.system.attach.deleteConfirm', { name: row.name }),
      t('pages.system.attach.deleteTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    ).then(async () => {
      await fetchRemoveAttach(row.id)
      ElMessage.success(t('pages.system.attach.deleteSuccess'))
      refreshData()
    })
  }
</script>

<style scoped>
  .attach-progress {
    flex: 1;
    max-width: 320px;
    margin-left: 12px;
  }
</style>
