import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  buildGenPrompt,
  categoryForModel,
  outputLanguage,
  POSTER_STYLES,
  PRODUCT_CATEGORIES,
  styleForModel
} from '../../../modules/ai/views/gen/genPrompt'

const dropLocale = (s: string) =>
  s
    .split('\n')
    .filter((l) => !l.startsWith('输出语言: '))
    .join('\n')

const base = {
  topic: '',
  title: '  春季新品发布 ',
  subtitle: 'Spring launch',
  style: 'cyberpunk',
  category: 'electronics',
  extra: '面向 Z 世代',
  width: 794,
  height: 1123
}

describe('内容生成发给模型的文本不跟界面语言变', () => {
  it('切换语言后，除「输出语言」一行外完全一致', () => {
    for (const type of ['poster', 'product', 'article', 'layout']) {
      const zhP = buildGenPrompt(type, { ...base, topic: '主题 A' }, 'zh')
      const enP = buildGenPrompt(type, { ...base, topic: '主题 A' }, 'en')
      expect(zhP).not.toEqual(enP)
      expect(dropLocale(zhP)).toEqual(dropLocale(enP))
      expect(zhP).toContain('输出语言: 简体中文')
      expect(enP).toContain('输出语言: English')
    }
  })

  it('行格式与后端 AiGenController.buildPrompt 模板一致（固定中文标签）', () => {
    expect(buildGenPrompt('poster', base, 'en')).toBe(
      [
        '标题: 春季新品发布',
        '副标题: Spring launch',
        '风格: 赛博朋克',
        '类目: 电子产品',
        '补充: 面向 Z 世代',
        '尺寸: 794x1123',
        '输出语言: English',
        '请按 poster 类型输出可用结果。'
      ].join('\n')
    )
    expect(buildGenPrompt('article', { ...base, topic: 'AI 周报', style: '轻松' }, 'zh')).toContain(
      '主题: AI 周报\n标题: 春季新品发布\n副标题: Spring launch\n风格: 轻松\n'
    )
  })

  it('主题和标题和后端一样两行都发，与类型无关', () => {
    for (const type of ['poster', 'article']) {
      const p = buildGenPrompt(type, { ...base, topic: ' 主题 A ' }, 'zh').split('\n')
      expect(p.slice(0, 2)).toEqual(['主题: 主题 A', '标题: 春季新品发布'])
    }
  })

  it('尺寸只有一边有值时不拼出 undefined / null', () => {
    const only = (w?: number, h?: number) =>
      buildGenPrompt('poster', { ...base, width: w, height: h }, 'zh')
    expect(only(800, undefined)).toContain('宽: 800')
    expect(only(800, undefined)).not.toMatch(/尺寸|undefined|null/)
    expect(only(undefined, 600)).toContain('高: 600')
    expect(only(undefined, 600)).not.toMatch(/尺寸|undefined|null/)
    expect(only(undefined, undefined)).not.toMatch(/尺寸|宽:|高:|undefined/)
    expect(only(800, 600)).toContain('尺寸: 800x600')
  })

  it('输出语言行与其他行一样用「: 」，取值简体中文 / English', () => {
    expect(outputLanguage('zh')).toBe('简体中文')
    expect(outputLanguage('zh-CN')).toBe('简体中文')
    expect(outputLanguage('en')).toBe('English')
    const p = buildGenPrompt('poster', base, 'zh')
    expect(p).not.toContain('：')
    for (const l of p.split('\n').slice(0, -1)) expect(l).toMatch(/^[^:]+: \S/)
  })

  it('下拉 key 映射成固定中文，用户自填内容原样', () => {
    expect(styleForModel('poster', 'guochao')).toBe('国潮东方')
    expect(styleForModel('article', 'my own style')).toBe('my own style')
    expect(categoryForModel('software')).toBe('软件服务')
    expect(categoryForModel('自定义类目')).toBe('自定义类目')
  })

  it('下拉显示 key 在 zh / en 都存在且 en 不含中文', () => {
    for (const o of [...POSTER_STYLES, ...PRODUCT_CATEGORIES]) {
      const k = o.i18n.split('.')[1]
      expect((zh as any).aiGen[k]).toBe(o.zh)
      expect(typeof (en as any).aiGen[k]).toBe('string')
      expect(/[\u4e00-\u9fff]/.test((en as any).aiGen[k])).toBe(false)
    }
  })
})
