/**
 * 富文本编辑器的图片上传
 *
 * 给 wangEditor 配了 customUpload 以后，它不再检查类型、大小和数量，选文件、粘贴、拖拽都直接把文件交过来，
 * 所以检查放在这里；后端（/system/richtext/image/upload）按同样的口径再查一遍。
 *
 * @module components/core/forms/art-wang-editor/image-upload
 * @author Mugsun
 */
import { resolveAvatarUrl } from '@/utils/avatar'

/** 单张图片上限，和后端 RichTextImageService.MAX_SIZE 一致 */
export const EDITOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** 只收位图；svg 能带脚本，后端不收 */
const EDITOR_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

/** 选择文件对话框的过滤条件（wangEditor 把它写到 input 的 accept 上） */
export const EDITOR_IMAGE_ACCEPT = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export type EditorImageRejectReason = 'type' | 'empty' | 'size'

export type EditorImageCheck = { ok: true } | { ok: false; reason: EditorImageRejectReason }

/** 按扩展名和大小检查一张图片能不能传 */
export function checkEditorImage(
  file: { name: string; size: number },
  maxBytes = EDITOR_IMAGE_MAX_BYTES
): EditorImageCheck {
  const dot = file.name.lastIndexOf('.')
  const ext = dot < 0 ? '' : file.name.slice(dot + 1).toLowerCase()
  if (!EDITOR_IMAGE_EXTS.includes(ext)) return { ok: false, reason: 'type' }
  if (file.size <= 0) return { ok: false, reason: 'empty' }
  if (file.size > maxBytes) return { ok: false, reason: 'size' }
  return { ok: true }
}

/** 调用方可以把上限调小；调大没有用，后端只收 EDITOR_IMAGE_MAX_BYTES 以内的图片 */
export function editorImageLimit(custom?: number): number {
  return custom && custom > 0 ? Math.min(custom, EDITOR_IMAGE_MAX_BYTES) : EDITOR_IMAGE_MAX_BYTES
}

/** 提示里用的上限文字：5MB、1.5MB、512KB */
export function formatEditorImageLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${Number(mb.toFixed(1))}MB`
  return `${Math.round(bytes / 1024)}KB`
}

/**
 * 后端返回的是相对后端根的读取地址（/system/richtext/image/raw/{id}/{文件名}），
 * 写进正文前补成浏览器能直接请求的地址。规则和头像相同（baseURL + /api），所以直接用头像的解析。
 */
export function editorImageSrc(url: string): string {
  return resolveAvatarUrl(url)
}

/** 没有视频上传接口：工具栏里总是去掉「上传视频」，「插入视频」（填地址）不受影响 */
export function withoutVideoUpload(excludeKeys: string[] = []): string[] {
  return excludeKeys.includes('uploadVideo') ? [...excludeKeys] : [...excludeKeys, 'uploadVideo']
}

/** wangEditor 交给 customUpload 的插入函数 */
export type EditorImageInsertFn = (url: string, alt: string, href: string) => void

export interface EditorImageUploaderOptions {
  /** 单张图片上限（字节），不传用 EDITOR_IMAGE_MAX_BYTES */
  maxBytes?: number
  /** 把图片传到后端；失败时的提示由它自己负责（请求封装会弹出后端或网络的错误） */
  upload: (file: File) => Promise<{ url?: string | null } | null | undefined>
  /** 图片没通过检查，没有发请求 */
  onRejected: (reason: EditorImageRejectReason, file: File) => void
  /** 上传完以后编辑器还在不在；上传期间弹窗被关掉时返回 false，这时不插入也不提示 */
  canInsert?: () => boolean
  /** 图片已经插进正文 */
  onInserted?: (file: File) => void
  /** 后端说成功但没有给地址 */
  onMissingUrl?: (file: File) => void
  /** 一次上传结束，成功失败都会调，用来收起进度条 */
  onSettled?: () => void
}

/** 生成给 wangEditor 用的 customUpload：检查 → 上传 → 把读取地址插进正文 */
export function createEditorImageUploader(options: EditorImageUploaderOptions) {
  return async (file: File, insert: EditorImageInsertFn): Promise<void> => {
    const check = checkEditorImage(file, options.maxBytes)
    if (!check.ok) {
      options.onRejected(check.reason, file)
      return
    }
    let url: string | null | undefined
    try {
      url = (await options.upload(file))?.url
    } catch {
      // 请求封装已经提示过（被取消的请求不提示）；这里只保证不往正文里插东西，也不把异常抛给编辑器
      return
    } finally {
      options.onSettled?.()
    }
    if (options.canInsert && !options.canInsert()) return
    if (!url) {
      options.onMissingUrl?.(file)
      return
    }
    insert(editorImageSrc(url), '', '')
    options.onInserted?.(file)
  }
}
