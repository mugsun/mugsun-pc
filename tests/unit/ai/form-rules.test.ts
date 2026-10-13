import { describe, expect, it } from 'vitest'
import { requiredRule } from '../../../modules/ai/views/shared/formRules'

describe('AI 表单必填规则 (UX-006 / UX-014)', () => {
  it('输入类：必填、拦纯空格、失焦校验，文案「请输入 X」', () => {
    expect(requiredRule('名称')).toEqual([
      { required: true, whitespace: true, message: '请输入名称', trigger: 'blur' }
    ])
  })
  it('选择类：变更即校验，文案「请选择 X」', () => {
    expect(requiredRule('类型', true)).toEqual([
      { required: true, message: '请选择类型', trigger: 'change' }
    ])
  })
})
