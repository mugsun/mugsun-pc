import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  kbResegNotice,
  kbSegmentSavedNotice,
  kbUploadNotice,
  kbVectorizeNotice
} from '../../../modules/ai/views/knowledge/kbVectorNotice'

/** 用中文文案把占位符填上，得到的就是页面上看到的字 */
const t = (key: string, params: Record<string, unknown> = {}): string => {
  const text = key.split('.').reduce<any>((node, part) => node?.[part], zh)
  if (typeof text !== 'string') throw new Error(`缺少文案：${key}`)
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

const REASON = '向量模型调用失败，这些分段没有向量化。请检查向量模型的地址、密钥和额度'

describe('上传资料之后的提示', () => {
  it('向量化成功：照常提示成功', () => {
    expect(kbUploadNotice({ segmentCount: 5, vectorStatus: 'success' }, t)).toEqual({
      type: 'success',
      message: '上传成功，分段 5，向量状态 success'
    })
  })

  it('分段没向量化成功：改成警告，带上后端给的原因', () => {
    const notice = kbUploadNotice(
      { segmentCount: 5, vectorStatus: 'failed', failReason: REASON },
      t
    )
    expect(notice.type).toBe('warning')
    expect(notice.message).toBe(`已上传并分成 5 段，但没有向量化成功：${REASON}`)
  })

  it('后端没给原因时也不报成功', () => {
    const notice = kbUploadNotice({ segmentCount: 2, vectorStatus: 'failed', failReason: '  ' }, t)
    expect(notice.type).toBe('warning')
    expect(notice.message).toBe('已上传并分成 2 段，但没有向量化成功：向量化失败')
  })

  it('没装向量扩展、只走关键词时还是成功', () => {
    expect(kbUploadNotice({ segmentCount: 3, vectorStatus: 'success' }, t).type).toBe('success')
    expect(kbUploadNotice(undefined, t).type).toBe('success')
  })
})

describe('重新分段、改分段之后的提示', () => {
  it('重新分段', () => {
    expect(kbResegNotice({ segmentCount: 7, vectorStatus: 'success' }, t)).toEqual({
      type: 'success',
      message: '重分段完成，共 7 段'
    })
    const failedAsset = { segmentCount: 7, vectorStatus: 'failed', failReason: REASON }
    expect(kbResegNotice(failedAsset, t)).toEqual({
      type: 'warning',
      message: `重分段完成，共 7 段，但没有向量化成功：${REASON}`
    })
  })

  it('改一个分段', () => {
    expect(kbSegmentSavedNotice({ vectorStatus: 'success' }, t)).toEqual({
      type: 'success',
      message: '已保存并重新向量化'
    })
    expect(kbSegmentSavedNotice({ vectorStatus: 'keyword' }, t).type).toBe('success')
    const failed = kbSegmentSavedNotice({ vectorStatus: 'failed' }, t)
    expect(failed.type).toBe('warning')
    expect(failed.message).toContain('这一段没有向量化成功')
  })
})

describe('点「开始向量化」「全量重建」之后的提示', () => {
  it('有分段失败：警告里写明成功几段、失败几段和原因', () => {
    for (const act of ['start', 'rebuild'] as const) {
      const notice = kbVectorizeNotice(
        act,
        { ok: false, count: 8, failed: 12, pending: 0, success: 8, message: REASON } as any,
        t
      )
      expect(notice.type).toBe('warning')
      expect(notice.message).toBe(`向量化没有全部成功：成功 8 段，失败 12 段。${REASON}`)
    }
  })

  it('全部成功：照常提示', () => {
    expect(kbVectorizeNotice('start', { count: 5, failed: 0, pending: 0, success: 5 }, t)).toEqual({
      type: 'success',
      message: '向量化完成，处理 5 段（待处理 0 → 成功 5）'
    })
    expect(kbVectorizeNotice('rebuild', { count: 5, failed: 0 }, t)).toEqual({
      type: 'success',
      message: '重建完成，处理 5 段'
    })
  })

  it('没装向量扩展：照后端的说明提示，不说向量化完成', () => {
    const note = '未安装向量扩展，已回落关键词检索，未写入向量'
    expect(
      kbVectorizeNotice('start', { count: 0, failed: 0, vectorAvailable: false, message: note }, t)
    ).toEqual({ type: 'warning', message: note })
  })
})

describe('详情页用上了这些提示', () => {
  const src = readFileSync(
    resolve(__dirname, '../../../modules/ai/views/knowledge/detail.vue'),
    'utf-8'
  )

  it('上传、重分段、改分段、向量化都按结果决定提示成功还是警告', () => {
    expect(src).toContain('showNotice(kbUploadNotice(r, t))')
    expect(src).toContain('showNotice(kbResegNotice(r, t))')
    expect(src).toContain('showNotice(kbSegmentSavedNotice(saved, t))')
    expect(src).toContain('showNotice(kbVectorizeNotice(act, r, t))')
    expect(src).not.toContain("ElMessage.success(t('aiKbDetail.uploadOk'")
    expect(src).not.toContain("ElMessage.success(t('aiKbDetail.savedRevectorized'))")
  })

  it('命中测试报错时清掉上一次的结果', () => {
    const runHit = src.slice(src.indexOf('async function runHit()'), src.indexOf('watch(tab,'))
    expect(runHit).toMatch(/catch \{[\s\S]*hitResults\.value = \[\]/)
  })

  it('提示文案中英文都有，占位符一致', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) || []).sort()
    for (const key of [
      'uploadVectorFailed',
      'resegVectorFailed',
      'savedVectorFailed',
      'vecPartFailed'
    ] as const) {
      expect(zh.aiKbDetail[key].length).toBeGreaterThan(0)
      expect(en.aiKbDetail[key].length).toBeGreaterThan(0)
      expect(placeholders(en.aiKbDetail[key])).toEqual(placeholders(zh.aiKbDetail[key]))
    }
    expect(placeholders(zh.aiKbDetail.uploadVectorFailed)).toEqual(['{n}', '{reason}'])
    expect(placeholders(zh.aiKbDetail.vecPartFailed)).toEqual(['{failed}', '{reason}', '{success}'])
  })
})
