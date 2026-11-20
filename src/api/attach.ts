import request from '@/utils/http'

/** 附件分页（真分页：pageNum/pageSize + filename 模糊 / ext 精确） */
export function fetchAttachPage(params: Record<string, any>) {
  return request.get<any>({ url: '/api/system/file/page', params })
}

/** 正文图片上传的等待上限：默认只等 15 秒，几 MB 的图片在慢网络上传不完 */
export const RICH_TEXT_IMAGE_UPLOAD_TIMEOUT = 60_000

/**
 * 上传一张富文本正文图片（公告、帮助文档、更新日志的编辑器）。
 * 返回的 url 是相对后端根的读取地址（/system/richtext/image/raw/{id}/{文件名}），不登录也能读。
 */
export function uploadRichTextImage(file: File, onProgress?: (percent: number) => void) {
  const form = new FormData()
  form.append('file', file)
  return request.post<{ id: string; name: string; url: string }>({
    url: '/api/system/richtext/image/upload',
    data: form,
    timeout: RICH_TEXT_IMAGE_UPLOAD_TIMEOUT,
    onUploadProgress: onProgress
      ? (event) => {
          if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
        }
      : undefined
  })
}
