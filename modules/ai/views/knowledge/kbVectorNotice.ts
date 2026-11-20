/**
 * 上传、重分段、改分段、向量化之后给用户看的提示。
 * 有分段没向量化成功时不报成功，改成警告并带上后端给的原因。
 */
export interface KbNotice {
  type: 'success' | 'warning'
  message: string
}

type Translate = (key: string, params?: Record<string, unknown>) => string

export interface KbAssetResult {
  segmentCount?: number | null
  vectorStatus?: string | null
  failReason?: string | null
}

export interface KbVectorizeResult {
  /** 这次写进向量表的分段数 */
  count?: number | null
  pending?: number | null
  success?: number | null
  /** 知识库里现在标成失败的分段数 */
  failed?: number | null
  message?: string | null
  vectorAvailable?: boolean | null
}

const FAILED = 'failed'

function reasonOf(value: unknown, t: Translate): string {
  const reason = String(value ?? '').trim()
  return reason || t('aiKbDetail.vecFailed')
}

export function kbUploadNotice(asset: KbAssetResult | null | undefined, t: Translate): KbNotice {
  const n = asset?.segmentCount ?? 0
  if (asset?.vectorStatus === FAILED) {
    return {
      type: 'warning',
      message: t('aiKbDetail.uploadVectorFailed', { n, reason: reasonOf(asset.failReason, t) })
    }
  }
  return {
    type: 'success',
    message: t('aiKbDetail.uploadOk', { n, status: asset?.vectorStatus || '' })
  }
}

export function kbResegNotice(asset: KbAssetResult | null | undefined, t: Translate): KbNotice {
  const n = asset?.segmentCount ?? '?'
  if (asset?.vectorStatus === FAILED) {
    return {
      type: 'warning',
      message: t('aiKbDetail.resegVectorFailed', { n, reason: reasonOf(asset.failReason, t) })
    }
  }
  return { type: 'success', message: t('aiKbDetail.resegOk', { n }) }
}

export function kbSegmentSavedNotice(
  segment: { vectorStatus?: string | null } | null | undefined,
  t: Translate
): KbNotice {
  if (segment?.vectorStatus === FAILED) {
    return { type: 'warning', message: t('aiKbDetail.savedVectorFailed') }
  }
  return { type: 'success', message: t('aiKbDetail.savedRevectorized') }
}

export function kbVectorizeNotice(
  act: 'start' | 'rebuild',
  result: KbVectorizeResult | null | undefined,
  t: Translate
): KbNotice {
  const count = result?.count ?? 0
  const failed = Number(result?.failed ?? 0)
  if (failed > 0) {
    return {
      type: 'warning',
      message: t('aiKbDetail.vecPartFailed', {
        success: count,
        failed,
        reason: reasonOf(result?.message, t)
      })
    }
  }
  // 没装向量扩展时后端一段向量也没写，照后端的说明提示，不说「向量化完成」
  const note = String(result?.message ?? '').trim()
  if (result?.vectorAvailable === false && note) {
    return { type: 'warning', message: note }
  }
  return {
    type: 'success',
    message:
      act === 'rebuild'
        ? t('aiKbDetail.rebuildOk', { n: count })
        : t('aiKbDetail.vecOk', {
            n: count,
            pending: result?.pending ?? 0,
            success: result?.success ?? 0
          })
  }
}
