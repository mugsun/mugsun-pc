import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

// boot#92 下线 MCP「对外暴露」：/system/ai/mcp/server/* 返回 404，ai:mcp:server 按钮隐藏
const root = resolve(__dirname, '../../../')
const read = (f: string) => readFileSync(resolve(root, f), 'utf-8')

describe('AI MCP「对外暴露」已下线', () => {
  it('api.ts 不再调用 /mcp/server 接口', () => {
    const src = read('modules/ai/api.ts')
    expect(src).not.toMatch(/mcp\/server/)
    expect(src).not.toMatch(/McpServer/)
  })

  it('MCP 页没有 server 标签页和相关表格', () => {
    const src = read('modules/ai/views/mcp/index.vue')
    expect(src).not.toMatch(/name="server"/)
    expect(src).not.toMatch(/'server'/)
    expect(src).not.toMatch(/McpServer|serverColumns|tabServer|emptyServer/)
  })

  it('其余 6 个分类标签页保留', () => {
    const src = read('modules/ai/views/mcp/index.vue')
    const names = [...src.matchAll(/<ElTabPane[^>]*name="([^"]*)"/g)].map((m) => m[1])
    expect(names).toEqual(['', 'map', 'chat', 'browser', 'file', 'custom'])
  })

  it('中英文案不再包含对外暴露相关 key', () => {
    for (const pack of [zh, en] as any[]) {
      const list = pack.aiMcpList
      for (const k of ['tabServer', 'emptyServer', 'colTool', 'colDescription', 'colEnabled']) {
        expect(list[k]).toBeUndefined()
      }
      expect(typeof list.tabAll).toBe('string')
    }
  })
})
