/**
 * 冒烟：除主应用外，每个用 createApp 独立挂载的 app（如 AI 助手抽屉）都打开一次，
 * 控制台不得有 error，也不得有 pageerror。
 *
 * 自动发现：扫描 src/ 与 modules/ 中调用 createApp 的源码（排除 src/main.ts），
 * 从同文件里的 `xxx.id = '...'` 取挂载节点 id。新增独立 app 时请沿用这个约定，
 * 否则本测试会因找不到挂载节点而失败。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect } from '@playwright/test'
import { test, mockAll, seedSession } from './support/session'
import { waitFiniteAnimations } from './support/animations'

const ROOT = process.cwd()
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|vue)$/.test(f) && !/\.(spec|test)\.ts$/.test(f)) out.push(p)
  }
  return out
}
const apps = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'modules'))]
  .filter((p) => relative(ROOT, p) !== join('src', 'main.ts'))
  .map((p) => ({ file: relative(ROOT, p), code: readFileSync(p, 'utf-8') }))
  .filter(({ code }) => /\bcreateApp\s*\(/.test(code))
  .map(({ file, code }) => ({ file, id: code.match(/\.id\s*=\s*['"]([\w-]+)['"]/)?.[1] }))

test('发现独立挂载的 app', () => {
  expect(apps.length, '未发现任何独立 createApp，确认扫描路径').toBeGreaterThan(0)
  for (const a of apps) expect(a.id, `${a.file} 未按约定设置挂载节点 id`).toBeTruthy()
})

for (const app of apps) {
  test(`独立 app 打开无报错：${app.file}`, async ({ page, uiLang, uiTheme }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      // mock 环境没有消息推送 WebSocket，属预期噪声
      if (/WebSocket|\[Socket\]/.test(t)) return
      errors.push(`console.error: ${t.slice(0, 300)}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`))
    await seedSession(page, uiLang, uiTheme)
    await mockAll(page)
    await page.goto('/#/dashboard/console')
    await page.waitForLoadState('networkidle')
    const host = page.locator(`#${app.id}`)
    await expect(host, `挂载节点 #${app.id} 不存在`).toBeAttached({ timeout: 15_000 })
    const trigger = host.locator('button:visible, [role="button"]:visible').first()
    await expect(trigger, `#${app.id} 内没有可点击的入口`).toBeVisible()
    await trigger.click()
    // 等抽屉/弹窗出现并且过渡结束；没出现也继续，先断言控制台错误（通常就是根因）
    await page
      .locator('.el-drawer:visible, .el-dialog:visible')
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {})
    // 与 form-layout 共用：排除无限循环动画，超时不判失败（下面有可见性断言兜底）
    await waitFiniteAnimations(page, 10_000)
    await page.waitForLoadState('networkidle')
    // 先报控制台错误（根因），再检查抽屉/弹窗是否真的打开
    expect(errors, `${app.file} 打开后有报错`).toEqual([])
    await expect(page.locator('.el-drawer:visible, .el-dialog:visible').first()).toBeVisible()
  })
}
