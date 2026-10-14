import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'

/**
 * 语言包里的每条消息都要能被 vue-i18n 编译。
 * `@`、`{`、`}`、`|`、`$` 等是消息语法字符，字面量须写成 {'@'} 这类插值。
 */
type Tree = { [k: string]: unknown }

function collectKeys(obj: Tree, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') keys.push(key)
    else if (v && typeof v === 'object' && !Array.isArray(v))
      keys.push(...collectKeys(v as Tree, key))
  }
  return keys
}

describe.each([
  ['zh', zh],
  ['en', en]
])('locale %s', (locale, messages) => {
  it('所有消息都能被 vue-i18n 编译且无告警', () => {
    const problems: string[] = []
    const i18n = createI18n({
      legacy: false,
      locale,
      messages: { [locale]: messages },
      missingWarn: false,
      fallbackWarn: false,
      warnHtmlMessage: false
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation((...args) => {
      problems.push(args.map(String).join(' '))
    })
    const error = vi.spyOn(console, 'error').mockImplementation((...args) => {
      problems.push(args.map(String).join(' '))
    })
    for (const key of collectKeys(messages as Tree)) {
      const before = problems.length
      try {
        i18n.global.t(key, { n: 1, count: 1 })
      } catch (e) {
        problems.push((e as Error).message)
      }
      if (problems.length > before) {
        problems.splice(
          before,
          problems.length - before,
          `${key}: ${problems[before].split('\n')[0]}`
        )
      }
    }
    warn.mockRestore()
    error.mockRestore()
    expect(problems).toEqual([])
  })
})

describe('转义后的字面量原样显示', () => {
  const i18n = createI18n({ legacy: false, locale: 'zh', messages: { zh, en } })
  const t = i18n.global.t
  it('邮箱提示里的 @', () => {
    expect(t('pages.system.user.rules.emailFormat')).toContain('name@example.com')
  })
  it('通知渠道占位里的 JSON 花括号', () => {
    expect(t('pages.system.notifyChannel.configPlaceholder')).toContain(
      '{"host":"smtp.example.com","port":465}'
    )
  })
  it('流程条件值提示里的 | 和 @@', () => {
    expect(t('pages.system.flowGraph.errValueInvalid')).toContain('不能包含 | 或 @@ 或换行')
  })
})
