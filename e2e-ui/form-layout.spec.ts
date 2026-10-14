/**
 * UI 自检：管理台所有新增/编辑弹窗与表单页，空提交后校验提示必须完整可见。
 *
 * - 页面从运行中的 vue-router 自动发现（getRoutes），不手写清单
 * - 接口全部在浏览器内 mock（列表返回一条 mock 行，用于打开「编辑」弹窗）
 * - 断言：Playwright 自带 toBeVisible / toBeInViewport / boundingBox，
 *   祖先 overflow 裁切与标签溢出用 DOM 尺寸（scrollWidth/clientWidth）判断
 */
import { expect, type Page, type Locator } from '@playwright/test'
import {
  test,
  mockAll,
  seedSession,
  ADD_RE,
  EDIT_RE,
  SUBMIT_RE,
  SKIP_ROUTE
} from './support/session'

/** 断言当前可见表单中的每条校验提示与标签都完整可见 */
async function checkForms(page: Page, where: string, problems: string[]) {
  // 与用户操作一致：点「保存/提交/确定」（弹窗取 footer 主按钮），空表单即触发全部必填校验
  const scope = page
    .locator('.el-overlay:visible .el-dialog, .el-overlay:visible .el-drawer')
    .last()
  const inDialog = (await scope.count()) > 0
  const submit = inDialog
    ? scope
        .locator(
          '.el-dialog__footer .el-button--primary:visible, .el-drawer__footer .el-button--primary:visible'
        )
        .last()
    : page.locator('button:visible').filter({ hasText: SUBMIT_RE }).first()
  if (await submit.count()) await submit.click({ timeout: 3_000 }).catch(() => {})
  await page.waitForTimeout(300)
  const root = inDialog ? scope : page.locator('body')
  const errors = root.locator('.el-form-item__error:visible')
  const count = await errors.count()
  for (let i = 0; i < count; i++) {
    const err = errors.nth(i)
    const text = ((await err.textContent()) || '').trim()
    const tag = `${where} · 「${text}」`
    await err.scrollIntoViewIfNeeded().catch(() => {})
    // 1) 完整在视口内
    try {
      await expect(err).toBeInViewport({ ratio: 1, timeout: 1_000 })
    } catch {
      problems.push(`${tag}：未完整出现在视口内`)
    }
    // 2) 不与相邻元素重叠（下一个表单项、同表单项内的输入控件）
    const box = await err.boundingBox()
    const item = err.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " el-form-item ")][1]'
    )
    const next = item.locator('xpath=following-sibling::*[1]')
    if (box && (await next.count())) {
      const nb = await next.boundingBox()
      if (
        nb &&
        nb.height > 0 &&
        box.y + box.height > nb.y + 1 &&
        box.x < nb.x + nb.width &&
        box.x + box.width > nb.x
      ) {
        problems.push(`${tag}：与下一个表单项重叠 ${Math.round(box.y + box.height - nb.y)}px`)
      }
    }
    // 3) 不被祖先 overflow 裁掉，自身不溢出
    const clip = await err.evaluate((el) => {
      const out: string[] = []
      if (el.scrollWidth > el.clientWidth + 1)
        out.push(`自身横向溢出 ${el.scrollWidth}>${el.clientWidth}`)
      const r = el.getBoundingClientRect()
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p)
        // fixed 定位（弹窗遮罩层）脱离外层 overflow 的裁切范围，再往上不必检查
        if (s.position === 'fixed') break
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
        const q = p.getBoundingClientRect()
        const scrollable = /(auto|scroll)/.test(s.overflowY)
        if (
          r.left < q.left - 1 ||
          r.right > q.right + 1 ||
          (!scrollable && (r.top < q.top - 1 || r.bottom > q.bottom + 1))
        ) {
          out.push(`被 .${(p.className || p.tagName).toString().split(' ')[0]} 的 overflow 裁切`)
          break
        }
      }
      return out
    })
    for (const c of clip) problems.push(`${tag}：${c}`)
  }
  // 4) 表单标签文字不溢出
  const labels = await root
    .locator('.el-form:visible .el-form-item__label')
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent && el.scrollWidth > el.clientWidth + 1)
        .map((el) => (el.textContent || '').trim())
    )
  for (const l of labels) problems.push(`${where} · 标签「${l}」文字溢出`)
  return count
}

async function closeDialogs(page: Page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.locator('.el-overlay:visible').count())) return
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }
}

test('表单校验提示与标签完整可见', async ({ page, uiLang, uiTheme }, info) => {
  test.setTimeout(30 * 60_000)
  await seedSession(page, uiLang, uiTheme)
  await mockAll(page)
  await page.goto('/')
  await page.waitForFunction(() => (document.querySelector('#app') as any)?.__vue_app__, null, {
    timeout: 60_000
  })
  await page.waitForLoadState('networkidle')
  if (uiTheme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)

  // 自动发现：所有已注册、带组件、无动态参数的叶子路由
  const paths: string[] = await page.evaluate(() => {
    const router = (document.querySelector('#app') as any).__vue_app__.config.globalProperties
      .$router
    return [
      ...new Set<string>(
        router
          .getRoutes()
          .filter(
            (r: any) =>
              r.components?.default && !r.children?.length && !r.meta?.link && !r.meta?.isIframe
          )
          .map((r: any) => r.path)
      )
    ]
  })
  const targets = paths.filter((p) => p !== '/' && !SKIP_ROUTE.test(p)).sort()
  expect(targets.length, '未发现任何路由').toBeGreaterThan(10)

  const problems: string[] = []
  const stats = { pages: 0, pageForms: 0, dialogs: 0, errors: 0, broken: [] as string[] }
  page.on('pageerror', () => {})

  for (const path of targets) {
    await test.step(path, async () => {
      try {
        await page.goto('/#' + path)
        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
        await page.waitForTimeout(400)
        await closeDialogs(page)
        stats.pages++
        // 页面本身的表单（排除查询栏：没有必填项的表单不会出错，自然跳过）
        if (await page.locator('.el-form:visible .el-form-item.is-required').count()) {
          stats.pageForms++
          stats.errors += await checkForms(page, `${path} 页面表单`, problems)
        }
        // 新增 + 编辑弹窗
        for (const [kind, re] of [
          ['新增', ADD_RE],
          ['编辑', EDIT_RE]
        ] as const) {
          const btn: Locator = page
            .locator('button:visible, a.el-link:visible')
            .filter({ hasText: re })
            .first()
          if (!(await btn.count())) continue
          await btn.click({ timeout: 3_000 }).catch(() => {})
          const dlg = page.locator('.el-overlay:visible .el-dialog, .el-overlay:visible .el-drawer')
          // dev server 首次编译弹窗组件可能较慢，等弹窗出现而不是固定等待
          await dlg
            .first()
            .waitFor({ timeout: 5_000 })
            .catch(() => {})
          await page.waitForTimeout(300)
          if (await dlg.count()) {
            stats.dialogs++
            stats.errors += await checkForms(page, `${path} ${kind}弹窗`, problems)
          }
          await closeDialogs(page)
        }
      } catch (e) {
        stats.broken.push(`${path}: ${(e as Error).message.split('\n')[0]}`)
      }
    })
  }

  const summary = `路由 ${targets.length}，访问 ${stats.pages}，页面表单 ${stats.pageForms}，弹窗 ${stats.dialogs}，校验提示 ${stats.errors}，问题 ${problems.length}`
  await info.attach('summary', {
    body: [summary, ...problems, '', '无法检查：', ...stats.broken].join('\n'),
    contentType: 'text/plain'
  })
  console.log(`[${info.project.name}] ${summary}`)
  for (const p of problems) console.log(`  ✗ ${p}`)
  expect(problems, `${info.project.name}: 发现 ${problems.length} 处表单布局问题`).toEqual([])
})
