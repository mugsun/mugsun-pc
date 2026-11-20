import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpPost = vi.fn()
vi.mock('@/utils/http', () => ({ default: { post: (...a: unknown[]) => httpPost(...a) } }))

import { RICH_TEXT_IMAGE_UPLOAD_TIMEOUT, uploadRichTextImage } from '@/api/attach'
import {
  EDITOR_IMAGE_ACCEPT,
  EDITOR_IMAGE_MAX_BYTES,
  checkEditorImage,
  createEditorImageUploader,
  editorImageLimit,
  editorImageSrc,
  formatEditorImageLimit,
  withoutVideoUpload
} from '@/components/core/forms/art-wang-editor/image-upload'

const nginx = readFileSync(
  resolve(__dirname, '../../../docker/nginx/default.conf.template'),
  'utf-8'
)

/** 一张指定名字和大小的图片；大小用属性覆盖，不真的分配几 MB 内存 */
function picture(name = 'a.png', size = 10): File {
  const file = new File([new Uint8Array(1)], name, { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', '/')
})

afterEach(() => {
  vi.unstubAllEnvs()
  httpPost.mockReset()
})

describe('编辑器图片：类型和大小检查', () => {
  it('接受 png / jpg / jpeg / gif / webp，不分大小写', () => {
    for (const name of ['a.png', 'b.JPG', 'c.jpeg', 'd.Gif', 'e.webp', '截图 2026.11.20.PNG']) {
      expect(checkEditorImage({ name, size: 1 })).toEqual({ ok: true })
    }
  })

  it('其他类型不收：svg 能带脚本，视频和文档不是图片', () => {
    for (const name of ['a.svg', 'a.bmp', 'a.mp4', 'a.pdf', 'a.png.exe', 'noext', '']) {
      expect(checkEditorImage({ name, size: 1 })).toEqual({ ok: false, reason: 'type' })
    }
  })

  it('空文件和超过上限的不收，刚好等于上限的收', () => {
    expect(checkEditorImage({ name: 'a.png', size: 0 })).toEqual({ ok: false, reason: 'empty' })
    expect(checkEditorImage({ name: 'a.png', size: EDITOR_IMAGE_MAX_BYTES })).toEqual({ ok: true })
    expect(checkEditorImage({ name: 'a.png', size: EDITOR_IMAGE_MAX_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'size'
    })
    expect(checkEditorImage({ name: 'a.png', size: 2048 }, 1024)).toEqual({
      ok: false,
      reason: 'size'
    })
  })

  it('上限和后端一致（5MB），比网关允许的请求体小', () => {
    expect(EDITOR_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024)
    const gatewayMb = Number(/client_max_body_size\s+(\d+)m/.exec(nginx)?.[1])
    expect(gatewayMb * 1024 * 1024).toBeGreaterThan(EDITOR_IMAGE_MAX_BYTES)
  })

  it('调用方只能把上限调小，不填或填错用默认值', () => {
    expect(editorImageLimit()).toBe(EDITOR_IMAGE_MAX_BYTES)
    expect(editorImageLimit(1024 * 1024)).toBe(1024 * 1024)
    expect(editorImageLimit(50 * 1024 * 1024)).toBe(EDITOR_IMAGE_MAX_BYTES)
    expect(editorImageLimit(0)).toBe(EDITOR_IMAGE_MAX_BYTES)
    expect(editorImageLimit(-1)).toBe(EDITOR_IMAGE_MAX_BYTES)
  })

  it('提示里的上限写成 5MB、512KB 这样', () => {
    expect(formatEditorImageLimit(5 * 1024 * 1024)).toBe('5MB')
    expect(formatEditorImageLimit(1.5 * 1024 * 1024)).toBe('1.5MB')
    expect(formatEditorImageLimit(512 * 1024)).toBe('512KB')
  })

  it('选择文件的对话框只列出能上传的类型', () => {
    expect(EDITOR_IMAGE_ACCEPT).toEqual(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
  })
})

describe('编辑器图片：写进正文的地址', () => {
  it('后端给的相对地址补成本站地址', () => {
    expect(
      editorImageSrc('/system/richtext/image/raw/9/0123456789abcdef0123456789abcdef.png')
    ).toBe('/api/system/richtext/image/raw/9/0123456789abcdef0123456789abcdef.png')
  })

  it('已经是完整地址的不动', () => {
    expect(editorImageSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })
})

describe('编辑器图片：上传并插入', () => {
  function setup(
    upload: (file: File) => Promise<unknown>,
    extra: { maxBytes?: number; canInsert?: () => boolean } = {}
  ) {
    const hooks = {
      onRejected: vi.fn(),
      onInserted: vi.fn(),
      onMissingUrl: vi.fn(),
      onSettled: vi.fn()
    }
    const insert = vi.fn()
    const run = createEditorImageUploader({ ...extra, upload: upload as never, ...hooks })
    return { run, insert, hooks }
  }

  it('上传成功：把本站地址插进正文', async () => {
    const upload = vi.fn().mockResolvedValue({ url: '/system/richtext/image/raw/9/abc.png' })
    const { run, insert, hooks } = setup(upload)
    const file = picture('a.png')
    await run(file, insert)
    expect(upload).toHaveBeenCalledWith(file)
    expect(insert).toHaveBeenCalledWith('/api/system/richtext/image/raw/9/abc.png', '', '')
    expect(hooks.onInserted).toHaveBeenCalledTimes(1)
    expect(hooks.onSettled).toHaveBeenCalledTimes(1)
    expect(hooks.onRejected).not.toHaveBeenCalled()
  })

  it('类型不对或太大：不发请求，告诉调用方原因', async () => {
    const upload = vi.fn()
    const { run, insert, hooks } = setup(upload)
    await run(picture('a.svg'), insert)
    await run(picture('big.png', EDITOR_IMAGE_MAX_BYTES + 1), insert)
    await run(picture('empty.png', 0), insert)
    expect(upload).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
    expect(hooks.onRejected.mock.calls.map((c) => c[0])).toEqual(['type', 'size', 'empty'])
    expect(hooks.onSettled).not.toHaveBeenCalled()
  })

  it('调用方可以把上限调小', async () => {
    const upload = vi.fn()
    const { run, insert, hooks } = setup(upload, { maxBytes: 1024 })
    await run(picture('a.png', 2048), insert)
    expect(upload).not.toHaveBeenCalled()
    expect(hooks.onRejected).toHaveBeenCalledWith('size', expect.any(File))
  })

  it('上传失败：不插入，也不把异常抛给编辑器（错误提示由请求封装负责）', async () => {
    const upload = vi.fn().mockRejectedValue(new Error('图片不能超过 5MB'))
    const { run, insert, hooks } = setup(upload)
    await expect(run(picture(), insert)).resolves.toBeUndefined()
    expect(insert).not.toHaveBeenCalled()
    expect(hooks.onInserted).not.toHaveBeenCalled()
    expect(hooks.onSettled).toHaveBeenCalledTimes(1)
  })

  it('上传期间编辑器被关掉：不插入也不提示', async () => {
    const upload = vi.fn().mockResolvedValue({ url: '/system/richtext/image/raw/9/abc.png' })
    const { run, insert, hooks } = setup(upload, { canInsert: () => false })
    await run(picture(), insert)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
    expect(hooks.onInserted).not.toHaveBeenCalled()
    expect(hooks.onMissingUrl).not.toHaveBeenCalled()
    expect(hooks.onSettled).toHaveBeenCalledTimes(1)
  })

  it('后端说成功但没有给地址：不插入，交给调用方提示', async () => {
    const { run, insert, hooks } = setup(vi.fn().mockResolvedValue({ url: null }))
    await run(picture(), insert)
    expect(insert).not.toHaveBeenCalled()
    expect(hooks.onMissingUrl).toHaveBeenCalledTimes(1)
    expect(hooks.onInserted).not.toHaveBeenCalled()
  })
})

describe('编辑器工具栏：没有视频上传接口', () => {
  it('总是去掉「上传视频」，调用方要排除的照旧', () => {
    expect(withoutVideoUpload(['fontFamily'])).toEqual(['fontFamily', 'uploadVideo'])
    expect(withoutVideoUpload()).toEqual(['uploadVideo'])
    expect(withoutVideoUpload(['uploadVideo', 'code'])).toEqual(['uploadVideo', 'code'])
  })
})

describe('正文图片上传接口', () => {
  it('用表单把文件传到 /api/system/richtext/image/upload，等待时间比默认的长', async () => {
    httpPost.mockResolvedValue({ id: '9', url: '/system/richtext/image/raw/9/abc.png' })
    const result = await uploadRichTextImage(picture('a.png'))
    expect(result.url).toBe('/system/richtext/image/raw/9/abc.png')

    const config = httpPost.mock.calls[0][0]
    expect(config.url).toBe('/api/system/richtext/image/upload')
    expect(config.data).toBeInstanceOf(FormData)
    expect((config.data.get('file') as File).name).toBe('a.png')
    expect(config.timeout).toBe(RICH_TEXT_IMAGE_UPLOAD_TIMEOUT)
    // 默认只等 15 秒，几 MB 的图片在慢网络上传不完；也不能比网关转发的等待上限长
    expect(RICH_TEXT_IMAGE_UPLOAD_TIMEOUT).toBeGreaterThan(15_000)
    const proxyMs = Number(/proxy_read_timeout\s+(\d+)s/.exec(nginx)?.[1]) * 1000
    expect(RICH_TEXT_IMAGE_UPLOAD_TIMEOUT).toBeLessThan(proxyMs)
  })

  it('上传进度换算成百分比，总量未知时不报', async () => {
    httpPost.mockResolvedValue({ url: '/x' })
    const onProgress = vi.fn()
    await uploadRichTextImage(picture(), onProgress)
    const config = httpPost.mock.calls[0][0]
    config.onUploadProgress({ loaded: 50, total: 200 })
    config.onUploadProgress({ loaded: 200, total: 200 })
    config.onUploadProgress({ loaded: 10 })
    expect(onProgress.mock.calls.map((c) => c[0])).toEqual([25, 100])
  })

  it('不要进度时不挂进度回调', async () => {
    httpPost.mockResolvedValue({ url: '/x' })
    await uploadRichTextImage(picture())
    expect(httpPost.mock.calls[0][0].onUploadProgress).toBeUndefined()
  })
})
