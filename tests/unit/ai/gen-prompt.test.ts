import { describe, expect, it } from 'vitest'
import en from '@/locales/langs/en.json'
import zh from '@/locales/langs/zh.json'
import {
  buildGenPrompt,
  categoryForModel,
  POSTER_STYLES,
  PRODUCT_CATEGORIES,
  styleForModel
} from '../../../modules/ai/views/gen/genPrompt'

const dropLocale = (s: string) =>
  s
    .split('\n')
    .filter((l) => !l.startsWith('输出语言：'))
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
      expect(zhP).toContain('输出语言：zh')
      expect(enP).toContain('输出语言：en')
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
        '输出语言：en',
        '请按 poster 类型输出可用结果。'
      ].join('\n')
    )
    expect(buildGenPrompt('article', { ...base, topic: 'AI 周报', style: '轻松' }, 'zh')).toContain(
      '主题: AI 周报\n副标题: Spring launch\n风格: 轻松\n'
    )
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
