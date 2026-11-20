import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newTraceId } from '@/utils/http/traceId'
import { buildOpenApiSignHeaders } from '@/utils/open-api-sign'
import { newTraceId as newAiTraceId } from '../../../modules/ai/views/shared/traceId'

const read = (file: string) => readFileSync(resolve(__dirname, '../../..', file), 'utf-8')

/** 内网 HTTP（非安全上下文）下的 crypto：有 getRandomValues，没有 randomUUID */
function stubInsecureCrypto() {
  const real = globalThis.crypto
  vi.stubGlobal('crypto', {
    getRandomValues: (array: Uint8Array) => real.getRandomValues(array)
  })
}

describe('内网 HTTP 部署下没有 crypto.randomUUID', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('没有 randomUUID 时照样能生成请求编号：32 位十六进制，每次不同', () => {
    stubInsecureCrypto()
    expect((globalThis.crypto as any).randomUUID).toBeUndefined()
    for (const make of [newTraceId, newAiTraceId]) {
      const id = make()
      expect(id).toMatch(/^[0-9a-f]{32}$/)
      expect(make()).not.toBe(id)
    }
  })

  it('没有 randomUUID 时开放接口签名照样能算', () => {
    stubInsecureCrypto()
    const headers = buildOpenApiSignHeaders('post', '/open/v1/ping', 'a=1', '{"x":1}', 'secret')
    expect(headers['X-Nonce']).toMatch(/^[0-9a-f]{32}$/)
    expect(headers['X-Sign']).toMatch(/^[0-9a-f]{64}$/)
    expect(headers['X-Timestamp']).toMatch(/^\d{13}$/)
  })

  it('对话面板和抽屉里的请求编号用 newTraceId，不再调 randomUUID', () => {
    for (const file of [
      'modules/ai/views/assistant/ChatPanel.vue',
      'modules/ai/views/assistant/drawer/AiDrawerChat.vue'
    ]) {
      const source = read(file)
      expect(source).not.toContain('randomUUID')
      expect(source.match(/requestId\.value = newTraceId\(\)/g)).toHaveLength(2)
    }
    expect(read('src/utils/open-api-sign.ts')).not.toContain('randomUUID')
  })
})
