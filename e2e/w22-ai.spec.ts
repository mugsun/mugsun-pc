import type { Page, APIResponse } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from './fixtures/auth'

/**
 * AI 主路径：缺模型要说清原因，模型与密钥不回明文，危险 SQL 在执行前被拒绝，知识库能分段。
 */

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await login(page)
})

test.afterAll(async () => {
  await page?.close()
})

async function jsonOf(resp: APIResponse) {
  const body = await resp.json()
  expect(resp.status(), JSON.stringify(body)).toBeLessThan(500)
  return body as { code: number; msg?: string; data?: any }
}

test('缺模型时生成接口说明原因，不返回成功正文', async () => {
  const body = await jsonOf(
    await page.request.post('/api/system/ai/gen/article/stream', {
      data: { topic: '验收用一句话' }
    })
  )
  expect(body.code).not.toBe(200)
  expect(body.msg || '').toContain('模型')
})

test('保存模型后列表不回 API Key 明文', async () => {
  const secret = 'sk-e2e-must-not-leak'
  const saved = await jsonOf(
    await page.request.post('/api/system/ai/model/submit', {
      data: {
        modelName: 'e2e-chat',
        modelType: 'chat',
        baseUrl: 'http://127.0.0.1:1/v1',
        apiKey: secret
      }
    })
  )
  expect(saved.code).toBe(200)
  expect(JSON.stringify(saved.data)).not.toContain(secret)
  const pageBody = await jsonOf(
    await page.request.get('/api/system/ai/model/page?pageNum=1&pageSize=20')
  )
  expect(pageBody.code).toBe(200)
  expect(JSON.stringify(pageBody.data)).not.toContain(secret)
})

test('危险 SQL 在问数重跑时被拒绝', async () => {
  const ds = await jsonOf(
    await page.request.post('/api/system/ai/datasource/submit', {
      data: {
        name: 'e2e-ds',
        jdbcUrl: 'jdbc:postgresql://127.0.0.1:1/none',
        username: 'none'
      }
    })
  )
  expect(ds.code).toBe(200)
  const dataset = await jsonOf(
    await page.request.post('/api/system/ai/dataset/submit', {
      data: { name: 'e2e-ask' }
    })
  )
  expect(dataset.code).toBe(200)
  const table = await jsonOf(
    await page.request.post('/api/system/ai/dataset/table/save', {
      data: {
        datasetId: dataset.data.id,
        datasourceId: ds.data.id,
        tableName: 'sys_user'
      }
    })
  )
  expect(table.code).toBe(200)
  for (const sql of [
    'DROP TABLE sys_user',
    'SELECT 1; SELECT 2',
    'SELECT * INTO copy_user FROM sys_user'
  ]) {
    const denied = await jsonOf(
      await page.request.post('/api/system/ai/dataset/sql/rerun', {
        data: { datasetId: dataset.data.id, sql }
      })
    )
    expect(denied.code, sql).not.toBe(200)
    expect(denied.msg || '').toContain('SELECT')
  }
})

test('知识库上传正文后能列出分段', async () => {
  const kb = await jsonOf(
    await page.request.post('/api/system/ai/knowledge/submit', {
      data: { name: 'e2e-kb' }
    })
  )
  expect(kb.code).toBe(200)
  const asset = await jsonOf(
    await page.request.post('/api/system/ai/knowledge/asset/upload', {
      data: {
        knowledgeId: kb.data.id,
        name: 'note.txt',
        contentText: '交付验收分段甲。交付验收分段乙。'
      }
    })
  )
  expect(asset.code).toBe(200)
  const segs = await jsonOf(
    await page.request.get(`/api/system/ai/knowledge/segment/list?knowledgeId=${kb.data.id}`)
  )
  expect(segs.code).toBe(200)
  expect(Array.isArray(segs.data)).toBeTruthy()
  expect(segs.data.length).toBeGreaterThan(0)
})

test('新建密钥只在创建响应出现一次，列表不再带明文', async () => {
  const created = await jsonOf(
    await page.request.post('/api/system/ai/secret/submit', {
      data: { description: 'e2e 密钥' }
    })
  )
  expect(created.code).toBe(200)
  const plain = created.data.secretKey as string
  expect(plain).toBeTruthy()
  const listed = await jsonOf(
    await page.request.get('/api/system/ai/secret/page?pageNum=1&pageSize=20')
  )
  expect(listed.code).toBe(200)
  expect(JSON.stringify(listed.data)).not.toContain(plain)
})
