import { describe, expect, it, vi } from 'vitest'
import zh from '@/locales/langs/zh.json'
import en from '@/locales/langs/en.json'

// 真实 i18n 实例依赖 store / 自动导入，这里用语言包本身模拟 $t，验证词条与插值
const state = vi.hoisted(() => ({ locale: 'zh' }))
vi.mock('@/locales', () => ({
  $t: (key: string, params: Record<string, string>) => {
    const pack: any = state.locale === 'en' ? en : zh
    const tpl: string = key.split('.').reduce((o, k) => o?.[k], pack)
    return tpl.replace(/\{(\w+)\}/g, (_, k) => params[k])
  }
}))

import { requiredRule } from '../../../modules/ai/views/shared/formRules'

const msg = (r: any) => (typeof r.message === 'function' ? r.message() : r.message)

describe('AI 表单必填规则 (UX-006 / UX-014)', () => {
  it('输入类：必填、拦纯空格、失焦校验，文案「请输入 X」', () => {
    state.locale = 'zh'
    const [r] = requiredRule('名称')
    expect(r).toMatchObject({ required: true, whitespace: true, trigger: 'blur' })
    expect(msg(r)).toBe('请输入名称')
  })
  it('选择类：变更即校验，文案「请选择 X」', () => {
    state.locale = 'zh'
    const [r] = requiredRule('类型', true)
    expect(r).toMatchObject({ required: true, trigger: 'change' })
    expect(r).not.toHaveProperty('whitespace')
    expect(msg(r)).toBe('请选择类型')
  })
  it('英文语言包有对应词条，切换语言后文案随之变化', () => {
    const rule = requiredRule('Name')[0]
    state.locale = 'en'
    expect(msg(rule)).toBe('Please enter Name')
    expect(msg(requiredRule('Type', true)[0])).toBe('Please select Type')
  })
})
