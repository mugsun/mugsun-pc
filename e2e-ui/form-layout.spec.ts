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

/** 覆盖下限：低于这个数说明有弹窗/提示没被打开或没被查到，直接判失败（基线 2026-10-14：77 / 140） */
const MIN_DIALOGS = 77
const MIN_ERRORS = 140

/** 等动画/过渡结束（自检注入了 transition:none，这里兜底等 Web Animations 与两帧渲染） */
async function settle(page: Page) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== 'running'),
    null,
    { timeout: 5_000 }
  )
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  )
}

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
  // 点击失败直接抛出，由调用方记入 broken 并判失败，不静默跳过
  if (await submit.count()) await submit.click({ timeout: 5_000 })
  await settle(page)
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
    // 2) 不与同一表单内任何其他表单项重叠（覆盖多列网格：右侧/下方/斜下方的项都比）
    const box = await err.boundingBox()
    if (box) {
      const hits = await err.evaluate((el, b) => {
        const own = el.closest('.el-form-item')
        const form = el.closest('.el-form')
        if (!own || !form) return [] as string[]
        const out: string[] = []
        for (const it of form.querySelectorAll<HTMLElement>('.el-form-item')) {
          if (it === own || it.contains(own) || own.contains(it) || !it.offsetParent) continue
          const q = it.getBoundingClientRect()
          const dx = Math.min(b.x + b.width, q.right) - Math.max(b.x, q.left)
          const dy = Math.min(b.y + b.height, q.bottom) - Math.max(b.y, q.top)
          if (dx > 1 && dy > 1) {
            const label = it.querySelector('.el-form-item__label')?.textContent?.trim() || '?'
            out.push(`与表单项「${label}」重叠 ${Math.round(dy)}px`)
          }
        }
        return out
      }, box)
      for (const h of hits) problems.push(`${tag}：${h}`)
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
    await settle(page)
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
  const stats = {
    pages: 0,
    pageForms: 0,
    dialogs: 0,
    errors: 0,
    broken: [] as string[],
    navigations: [] as string[]
  }
  page.on('pageerror', () => {})

  for (const path of targets) {
    await test.step(path, async () => {
      try {
        await page.goto('/#' + path)
        await page.waitForLoadState('networkidle', { timeout: 15_000 })
        await settle(page)
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
          const dlg = page.locator('.el-overlay:visible .el-dialog, .el-overlay:visible .el-drawer')
          const before = page.url()
          let opened = false
          // 找到按钮却没出弹窗：重试一次，仍不出来就判失败（不静默跳过）
          for (let attempt = 0; attempt < 2 && !opened; attempt++) {
            await btn.click({ timeout: 5_000 })
            opened = await dlg
              .first()
              .waitFor({ timeout: 10_000 })
              .then(() => true)
              .catch(() => false)
            if (!opened && page.url() !== before) break
          }
          if (!opened) {
            if (page.url() !== before) {
              // 按钮跳到了独立表单页而不是弹窗：记录，不算弹窗
              stats.navigations.push(`${path} ${kind} → ${new URL(page.url()).hash}`)
              continue
            }
            throw new Error(`「${kind}」按钮已点击两次，弹窗仍未出现`)
          }
          await settle(page)
          stats.dialogs++
          stats.errors += await checkForms(page, `${path} ${kind}弹窗`, problems)
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
  for (const b of stats.broken) console.log(`  ⚠ 无法检查 ${b}`)
  for (const n of stats.navigations) console.log(`  → 跳转页面 ${n}`)
  expect
    .soft(stats.broken, `${info.project.name}: ${stats.broken.length} 个页面/弹窗无法检查`)
    .toEqual([])
  expect
    .soft(stats.dialogs, `${info.project.name}: 弹窗数 ${stats.dialogs} 低于下限 ${MIN_DIALOGS}`)
    .toBeGreaterThanOrEqual(MIN_DIALOGS)
  expect
    .soft(stats.errors, `${info.project.name}: 校验提示数 ${stats.errors} 低于下限 ${MIN_ERRORS}`)
    .toBeGreaterThanOrEqual(MIN_ERRORS)
  expect(problems, `${info.project.name}: 发现 ${problems.length} 处表单布局问题`).toEqual([])
})
