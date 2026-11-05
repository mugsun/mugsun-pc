import { describe, expect, it } from 'vitest'
import {
  KB_UPLOAD_FILE_MAX_BYTES,
  assetNeedsPoll,
  checkKbUploadFile,
  kbUploadAcceptAttr
} from '../../../modules/ai/views/knowledge/kbUploadFile'

describe('checkKbUploadFile', () => {
  it('接受 pdf/docx/pptx 为 file 模式', () => {
    expect(checkKbUploadFile({ name: 'a.PDF', size: 10 })).toEqual({
      ok: true,
      mode: 'file',
      ext: '.pdf'
    })
    expect(checkKbUploadFile({ name: 'x.docx', size: 1 })).toMatchObject({
      ok: true,
      mode: 'file',
      ext: '.docx'
    })
    expect(checkKbUploadFile({ name: 'd.Pptx', size: 2 })).toMatchObject({
      ok: true,
      mode: 'file',
      ext: '.pptx'
    })
  })

  it('文本类走 text 模式（JSON upload 兼容）', () => {
    expect(checkKbUploadFile({ name: 'n.md', size: 3 })).toEqual({
      ok: true,
      mode: 'text',
      ext: '.md'
    })
    expect(checkKbUploadFile({ name: 'n.txt', size: 3 }).mode).toBe('text')
  })

  it('拒绝类型 / 空文件 / 超限', () => {
    expect(checkKbUploadFile({ name: 'x.exe', size: 10 })).toEqual({
      ok: false,
      reason: 'type'
    })
    expect(checkKbUploadFile({ name: 'a.pdf', size: 0 })).toEqual({
      ok: false,
      reason: 'empty'
    })
    expect(checkKbUploadFile({ name: 'a.pdf', size: KB_UPLOAD_FILE_MAX_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'size'
    })
  })

  it('accept 含文档与文本后缀', () => {
    const a = kbUploadAcceptAttr()
    expect(a).toContain('.pdf')
    expect(a).toContain('.docx')
    expect(a).toContain('.pptx')
    expect(a).toContain('.md')
  })
})

describe('assetNeedsPoll', () => {
  it('仅 pending 需要轮询', () => {
    expect(assetNeedsPoll('pending')).toBe(true)
    expect(assetNeedsPoll('Pending')).toBe(true)
    expect(assetNeedsPoll('success')).toBe(false)
    expect(assetNeedsPoll('failed')).toBe(false)
    expect(assetNeedsPoll('keyword')).toBe(false)
    expect(assetNeedsPoll(null)).toBe(false)
  })
})
