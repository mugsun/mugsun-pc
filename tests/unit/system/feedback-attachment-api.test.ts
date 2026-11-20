import { afterEach, describe, expect, it, vi } from 'vitest'

const httpPost = vi.fn()
const httpRequest = vi.fn()
const httpDownload = vi.fn()
vi.mock('@/utils/http', () => ({
  default: {
    post: (...a: unknown[]) => httpPost(...a),
    request: (...a: unknown[]) => httpRequest(...a),
    download: (...a: unknown[]) => httpDownload(...a)
  }
}))

import {
  downloadFeedbackAttachment,
  fetchFeedbackAttachment,
  uploadFeedbackFile
} from '@/api/feedback'

afterEach(() => {
  httpPost.mockReset()
  httpRequest.mockReset()
  httpDownload.mockReset()
})

describe('意见反馈的附件（PC-019）', () => {
  it('图片按私有文件上传：表单里只有文件，不要求公开', async () => {
    httpPost.mockResolvedValue({ id: '9101', name: 'shot.png' })
    await uploadFeedbackFile(new File(['x'], 'shot.png', { type: 'image/png' }))

    const { url, data } = httpPost.mock.calls[0][0] as { url: string; data: FormData }
    expect(url).toBe('/api/system/file/upload')
    expect([...data.keys()]).toEqual(['file'])
  })

  it('管理员看图：按反馈编号取图片内容，失败由页面自己提示', async () => {
    httpRequest.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    await fetchFeedbackAttachment('501')

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/system/feedback/attachment/501',
        responseType: 'blob',
        skipEnvelope: true,
        showErrorMessage: false
      })
    )
  })

  it('不是图片的附件：按反馈编号保存到本地', async () => {
    await downloadFeedbackAttachment('501', 'notes.pdf')

    expect(httpDownload).toHaveBeenCalledWith({
      url: '/api/system/feedback/attachment/501',
      filename: 'notes.pdf'
    })
  })
})
