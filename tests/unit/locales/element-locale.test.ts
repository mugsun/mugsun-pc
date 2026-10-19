import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import en from 'element-plus/es/locale/lang/en'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { elementLocale } from '@/locales/element'

// 只测映射，不拉起真实 store（它依赖构建期常量）
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ language: 'zh' }) }))

const src = (f: string) => readFileSync(resolve(__dirname, '../../..', f), 'utf8')

describe('Element Plus 自带文案的 locale', () => {
  it('界面语言映射到 Element Plus locale', () => {
    expect(elementLocale('en')).toBe(en)
    expect(elementLocale('zh')).toBe(zhCn)
  })

  it('主应用和 AI 抽屉的独立 app 都走同一份 bindElementLocale', () => {
    expect(src('src/main.ts')).toMatch(/bindElementLocale\(app\)/)
    const plugin = src('modules/ai/plugin.ts')
    expect(plugin).toMatch(/from '@\/locales\/element'/)
    expect(plugin).toMatch(/bindElementLocale\(drawerApp\)/)
    // 不在插件里另写一份映射
    expect(plugin).not.toMatch(/element-plus\/es\/locale\/lang/)
  })
})
