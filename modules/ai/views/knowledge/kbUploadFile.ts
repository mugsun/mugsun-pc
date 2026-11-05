/**
 * 知识库资料上传前端预检（与 boot upload-file 白名单对齐；JSON upload 文本路径另走）。
 * 纯函数便于 vitest；服务端校验仍是最终裁定。
 */

export const KB_UPLOAD_FILE_MAX_BYTES = 20 * 1024 * 1024

/** multipart upload-file：PDF / Word / PPT */
export const KB_UPLOAD_DOC_EXTS = ['.pdf', '.docx', '.pptx'] as const

/** 既有 JSON upload 文本类（仍兼容） */
export const KB_UPLOAD_TEXT_EXTS = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.log',
  '.html',
  '.htm'
] as const

export type KbUploadMode = 'file' | 'text'

export type KbUploadCheckOk = { ok: true; mode: KbUploadMode; ext: string }
export type KbUploadCheckFail = { ok: false; reason: 'type' | 'empty' | 'size' }
export type KbUploadCheck = KbUploadCheckOk | KbUploadCheckFail

function extOf(name: string): string {
  const n = name.toLowerCase()
  const i = n.lastIndexOf('.')
  return i >= 0 ? n.slice(i) : ''
}

export function isKbUploadDocExt(ext: string): boolean {
  return (KB_UPLOAD_DOC_EXTS as readonly string[]).includes(ext.toLowerCase())
}

export function isKbUploadTextExt(ext: string): boolean {
  return (KB_UPLOAD_TEXT_EXTS as readonly string[]).includes(ext.toLowerCase())
}

/** accept 属性：文档 + 文本 */
export function kbUploadAcceptAttr(): string {
  return [...KB_UPLOAD_DOC_EXTS, ...KB_UPLOAD_TEXT_EXTS].join(',')
}

/**
 * 前端预检。空文件 / 超 20MB / 后缀不在白名单 → fail。
 * 文档 → mode=file（multipart）；文本 → mode=text（JSON）。
 */
export function checkKbUploadFile(file: { name: string; size: number }): KbUploadCheck {
  const ext = extOf(file.name || '')
  if (!ext || (!isKbUploadDocExt(ext) && !isKbUploadTextExt(ext))) {
    return { ok: false, reason: 'type' }
  }
  if (!file.size || file.size <= 0) {
    return { ok: false, reason: 'empty' }
  }
  if (file.size > KB_UPLOAD_FILE_MAX_BYTES) {
    return { ok: false, reason: 'size' }
  }
  return { ok: true, mode: isKbUploadDocExt(ext) ? 'file' : 'text', ext }
}

/** 列表里是否还有处理中（需轮询） */
export function assetNeedsPoll(status: unknown): boolean {
  const s = String(status || '').toLowerCase()
  return s === 'pending'
}
