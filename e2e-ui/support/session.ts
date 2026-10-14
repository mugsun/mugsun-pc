import { test as base, type Page } from '@playwright/test'

type Opts = { uiLang: 'zh' | 'en'; uiTheme: 'light' | 'dark' }
export const test = base.extend<Opts>({
  uiLang: ['zh', { option: true }],
  uiTheme: ['light', { option: true }]
})

const VERSION = '3.0.2'
const INFO = {
  userId: 1,
  userName: 'admin',
  nickName: 'Admin',
  roles: ['R_SUPER'],
  buttons: ['*:*:*'],
  perms: ['*:*:*'],
  permissions: ['*:*:*'],
  menus: null
}
const ROW = {
  id: '1',
  name: 'mock',
  title: 'mock',
  code: 'mock',
  status: 1,
  createTime: '2026-01-01 00:00:00'
}
export const ADD_RE = /^\s*(\+\s*)?(新增|添加|新建|创建|Add|New|Create)/i
export const SUBMIT_RE = /^\s*(保存|提交|确定|确认|Save|Submit|OK|Confirm)\s*$/i
export const EDIT_RE = /^\s*(编辑|修改|Edit)\s*$/i
/** 只读/外链/示例路由不检查 */
export const SKIP_ROUTE = /^\/(auth|exception|outside|iframe|lock|redirect)\b|:/

export async function mockAll(page: Page) {
  const ok = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg: 'ok', data })
  })
  await page.route(
    (u) => u.pathname.startsWith('/api/'),
    (r) => {
      const u = r.request().url()
      if (u.includes('/auth/info')) return r.fulfill(ok(INFO))
      if (/\/(page|list)\b/.test(u))
        return r.fulfill(
          ok({ records: [ROW], list: [ROW], rows: [ROW], total: 1, current: 1, size: 10 })
        )
      if (/\/(detail|info|get)\b/.test(u)) return r.fulfill(ok(ROW))
      return r.fulfill(ok([]))
    }
  )
  await page.routeWebSocket(/\/api\/ws\//, () => {})
}

/** 注入登录态、语言、主题（mock 会话，不走后端） */
export async function seedSession(page: Page, uiLang: string, uiTheme: string) {
  await page.addInitScript(
    ([v, lang, theme, info]) => {
      sessionStorage.setItem(
        `sys-v${v}-user-session`,
        JSON.stringify({ accessToken: 'mock', refreshToken: 'mock', isLogin: true })
      )
      localStorage.setItem(
        `sys-v${v}-user`,
        JSON.stringify({ language: lang, info, searchHistory: [] })
      )
      const key = `sys-v${v}-setting`
      const cur = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(
        key,
        JSON.stringify({ ...cur, systemThemeType: theme, systemThemeMode: theme })
      )
      localStorage.setItem('sys-version', v as string)
      const s = document.createElement('style')
      s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s))
    },
    [VERSION, uiLang, uiTheme, INFO] as const
  )
}
