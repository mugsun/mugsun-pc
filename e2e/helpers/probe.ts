import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * 页面级断言工具：收集一次导航期间的浏览器异常与接口错误。
 * - pageError：未捕获 JS 异常（白屏级问题）
 * - consoleError：console.error（过滤已知良性噪音）
 * - serverError：/api/ 5xx
 * - clientError：/api/ 4xx（记录不硬性断言，供报告分析）
 */
export interface PageIssue {
  pageErrors: string[]
  consoleErrors: string[]
  serverErrors: string[]
  clientErrors: string[]
}

/** 已知良性 console.error 噪音（逐条核实后方可加入，禁止无脑放行） */
const CONSOLE_NOISE: RegExp[] = [
  // Element Plus 在 dev 下的 hydration/弃用告警以 error 形式输出时
  /\[Vue warn\]/i,
  // keepAlive / 快速切路由时，在途请求被 axios 主动 abort——非业务失败
  /请求已取消/i
]

export class PageProbe {
  private page: Page
  readonly issue: PageIssue = {
    pageErrors: [],
    consoleErrors: [],
    serverErrors: [],
    clientErrors: []
  }
  private onPageError = (e: Error) => this.issue.pageErrors.push(String(e))
  private onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!CONSOLE_NOISE.some((re) => re.test(text))) this.issue.consoleErrors.push(text)
  }
  private onResponse = (resp: { url: () => string; status: () => number }) => {
    if (!resp.url().includes('/api/')) return
    if (resp.status() >= 500) this.issue.serverErrors.push(`${resp.status()} ${resp.url()}`)
    else if (resp.status() >= 400) this.issue.clientErrors.push(`${resp.status()} ${resp.url()}`)
  }

  constructor(page: Page) {
    this.page = page
  }

  attach() {
    this.page.on('pageerror', this.onPageError)
    this.page.on('console', this.onConsole)
    this.page.on('response', this.onResponse)
  }

  detach() {
    this.page.off('pageerror', this.onPageError)
    this.page.off('console', this.onConsole)
    this.page.off('response', this.onResponse)
  }
}

/** 断言一次巡访无致命问题，并返回记录到的非致命错误供报告 */
export function assertProbeClean(routePath: string, issue: PageIssue) {
  expect(issue.pageErrors, `${routePath} 出现未捕获异常`).toEqual([])
  expect(issue.serverErrors, `${routePath} 出现 5xx 接口错误`).toEqual([])
  expect(issue.consoleErrors, `${routePath} 出现 console.error`).toEqual([])
}
